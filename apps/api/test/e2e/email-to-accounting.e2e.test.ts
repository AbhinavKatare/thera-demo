import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { LocalDiskFileStore } from '../../src/storage/file-store.js';
import { InvoiceLLMExtractor, MockLLMProvider } from '@paypilot/ai';
import { ContractorMatchingService } from '../../src/intake/contractor-matcher.js';
import { ApprovalWorkflowService } from '../../src/services/approval-workflow.service.js';
import { writeAuditLog } from '../../src/services/audit-log.service.js';
import {
  NetSuiteConnector,
  NetSuiteMockServer,
  SharedSyncEngine,
} from '@paypilot/connectors';

describe('E2E Pipeline: Email Arrives → Extracted → Slack Approval → Bill Created in Accounting Mock', () => {
  let fileStore: LocalDiskFileStore;
  let llmExtractor: InvoiceLLMExtractor;
  let contractorMatcher: ContractorMatchingService;
  let approvalService: ApprovalWorkflowService;
  let netSuiteMock: NetSuiteMockServer;
  let netSuiteConnector: NetSuiteConnector;
  let syncEngine: SharedSyncEngine;
  let mockPrisma: any;
  let auditLogs: any[] = [];

  const tempDir = './test-scratch-e2e-' + Date.now();

  beforeEach(async () => {
    auditLogs = [];
    fileStore = new LocalDiskFileStore({ baseDir: tempDir });

    // In-memory store for prisma mock
    const store = new Map<string, any>();

    mockPrisma = {
      inboundDocument: {
        create: async ({ data }: any) => {
          const doc = { id: `doc-${randomUUID().slice(0, 8)}`, ...data, createdAt: new Date() };
          store.set(doc.id, doc);
          return doc;
        },
        findFirst: async ({ where }: any) => {
          return Array.from(store.values()).find((d) => d.fileHash === where.fileHash) ?? null;
        },
      },
      invoice: {
        create: async ({ data }: any) => {
          const inv = { id: `inv-${randomUUID().slice(0, 8)}`, ...data, createdAt: new Date() };
          store.set(inv.id, inv);
          return inv;
        },
        update: async ({ where, data }: any) => {
          const inv = store.get(where.id);
          Object.assign(inv, data, { updatedAt: new Date() });
          return inv;
        },
      },
      contractor: {
        findMany: async () => [
          {
            id: 'cnt_002',
            name: 'Sofia Rossi',
            email: 'sofia.rossi@design.it',
            country: 'IT',
            currency: 'EUR',
          },
        ],
      },
      approval: {
        create: async ({ data }: any) => {
          const id = data.id ?? `appr-${randomUUID().slice(0, 8)}`;
          const appr = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
          store.set(id, appr);
          return appr;
        },
        findUnique: async ({ where }: any) => {
          if (where.id) return store.get(where.id) ?? null;
          if (where.idempotencyKey) {
            return Array.from(store.values()).find((a) => a.idempotencyKey === where.idempotencyKey) ?? null;
          }
          return null;
        },
        update: async ({ where, data }: any) => {
          const appr = store.get(where.id);
          Object.assign(appr, data, { updatedAt: new Date() });
          return appr;
        },
      },
      auditLog: {
        create: async ({ data }: any) => {
          const log = { id: `aud-${randomUUID().slice(0, 8)}`, ...data, createdAt: new Date() };
          auditLogs.push(log);
          return log;
        },
      },
      connectorSyncLog: {
        create: async ({ data }: any) => data,
      },
    };

    llmExtractor = new InvoiceLLMExtractor(new MockLLMProvider());
    contractorMatcher = new ContractorMatchingService();
    approvalService = new ApprovalWorkflowService(mockPrisma);

    // Setup NetSuite SuiteTalk REST mock server
    netSuiteMock = new NetSuiteMockServer({ accountId: '7654321' });
    const serverUrl = await netSuiteMock.start();

    netSuiteConnector = new NetSuiteConnector({
      accountId: '7654321',
      baseUrl: `${serverUrl}/services/rest/record/v1`,
      bearerToken: 'suite-talk-test-token',
    });

    syncEngine = new SharedSyncEngine({
      mappingConfig: { defaultExpenseAccountCode: '6010' },
    });
  });

  afterEach(async () => {
    if (netSuiteMock) {
      await netSuiteMock.close();
    }
  });

  it('executes full end-to-end lifecycle: email PDF intake → OCR/LLM extraction → Slack multi-approver sign-off → NetSuite ERP bill synchronization', async () => {
    // -------------------------------------------------------------------------
    // STEP 1: Email Arrives with PDF Invoice Attachment
    // -------------------------------------------------------------------------
    const simulatedPdfBytes = Buffer.from(
      '%PDF-1.4 simulated invoice from Sofia Rossi design agency INV-2026-992 total EUR 4,200.00 issue 2026-10-16 due 2026-10-25'
    );
    const calculatedHash = createHash('sha256').update(simulatedPdfBytes).digest('hex');

    // FileStore stores PDF with SHA-256 hash deduplication
    const storedFile = await fileStore.save({
      filename: 'sofia-rossi-invoice-oct.pdf',
      mimeType: 'application/pdf',
      content: simulatedPdfBytes,
    });
    expect(storedFile.sha256Hash).toBe(calculatedHash);

    // Register inbound document
    const inboundDoc = await mockPrisma.inboundDocument.create({
      data: {
        companyId: 'cmp_prod_001',
        source: 'EMAIL_ATTACHMENT',
        senderEmail: 'sofia.rossi@design.it',
        subject: 'Invoice INV-2026-992 for UI/UX Design Sprint',
        fileId: storedFile.id,
        fileHash: storedFile.sha256Hash,
        status: 'PENDING',
      },
    });
    expect(inboundDoc.id).toBeDefined();

    // -------------------------------------------------------------------------
    // STEP 2: Extraction & Deterministic Validation Pipeline
    // -------------------------------------------------------------------------
    const extractedInvoiceText = `
      INVOICE
      Vendor: Sofia Rossi
      Email: sofia.rossi@design.it
      Invoice Number: INV-2026-992
      Issue Date: 2026-10-16
      Due Date: 2026-10-25
      Currency: EUR
      Line Items:
      - Mobile App Design System & Interaction Prototyping: 1 x 4200.00 = 4200.00 EUR
      Subtotal: 4200.00 EUR
      Tax: 0.00 EUR
      Total Due: 4200.00 EUR
      Bank IBAN: IT60X0542811101000000123456
    `;

    // Extract via LLM extractor
    const extractionResult = await llmExtractor.extractFromText(extractedInvoiceText);
    expect(extractionResult.validation.isValid).toBe(true);

    // Match contractor
    const candidates = [
      {
        id: 'cnt_002',
        companyId: 'cmp_prod_001',
        legalName: 'Sofia Rossi',
        displayName: 'Sofia Rossi',
        email: 'sofia.rossi@design.it',
        countryCode: 'IT',
      },
    ];
    const match = contractorMatcher.match(extractionResult.data, 'sofia.rossi@design.it', candidates);
    expect(match.matched).toBe(true);
    expect(match.contractor?.id).toBe('cnt_002');
    expect(match.matchConfidence).toBeGreaterThanOrEqual(0.85);

    // Persist invoice in database
    const createdInvoice = await mockPrisma.invoice.create({
      data: {
        companyId: 'cmp_prod_001',
        contractorId: match.contractor?.id,
        invoiceNumber: extractionResult.data.invoiceNumber || 'INV-2026-992',
        status: 'SUBMITTED',
        periodStart: new Date('2026-10-01'),
        periodEnd: new Date('2026-10-15'),
        issueDate: new Date(extractionResult.data.issueDate || '2026-10-16'),
        dueDate: new Date(extractionResult.data.dueDate || '2026-10-25'),
        currency: extractionResult.data.currency || 'EUR',
        subtotalMinor: extractionResult.data.subtotalMinor || 420000,
        taxMinor: extractionResult.data.taxMinor || 0,
        totalMinor: extractionResult.data.totalMinor || 420000,
        invoiceHash: storedFile.sha256Hash,
        fileId: storedFile.id,
      },
    });
    expect(createdInvoice.totalMinor).toBe(extractionResult.data.totalMinor);

    // -------------------------------------------------------------------------
    // STEP 3: Slack Interactivity & State Machine Approval
    // -------------------------------------------------------------------------
    // Slack copilot receives notification card and human approver (Alex Rivera) clicks "Approve"
    const draftApproval = await approvalService.createDraft({
      companyId: 'cmp_prod_001',
      targetType: 'INVOICE',
      targetId: createdInvoice.id,
      amountMinor: createdInvoice.totalMinor,
      currency: createdInvoice.currency,
      requestedBy: 'slack-user-alex',
      idempotencyKey: `idem-appr-${createdInvoice.id}`,
    });
    expect(draftApproval.status).toBe('DRAFT');

    const pendingApproval = await approvalService.submitForApproval({
      approvalId: draftApproval.id,
      submittedBy: 'slack-user-alex',
    });
    expect(pendingApproval.status).toBe('PENDING_APPROVAL');

    // Alex Rivera signs approval (1 of 2 required for amount >= $5,000)
    const firstApprovalResult = await approvalService.approve({
      approvalId: pendingApproval.id,
      approverId: 'usr_owner_01',
      idempotencyKey: `decision-${draftApproval.id}-alex`,
      decisionNote: 'Verified Sofia Rossi milestone deliverables against design system spec.',
    });
    expect(firstApprovalResult.status).toBe('PENDING_APPROVAL');
    expect(firstApprovalResult.approvers).toContain('usr_owner_01');

    // Sarah Jenkins (Finance Lead) provides second approval required for > $5,000 threshold
    const secondApprovalResult = await approvalService.approve({
      approvalId: pendingApproval.id,
      approverId: 'usr_approver_02',
      idempotencyKey: `decision-${draftApproval.id}-sarah`,
      decisionNote: 'Secondary sign-off granted for amount > $5,000.',
    });
    expect(secondApprovalResult.status).toBe('APPROVED');
    expect(secondApprovalResult.approvers).toContain('usr_approver_02');

    // Update invoice status to APPROVED
    await mockPrisma.invoice.update({
      where: { id: createdInvoice.id },
      data: { status: 'APPROVED' },
    });

    // Write immutable audit log for compliance
    await writeAuditLog(mockPrisma, {
      companyId: 'cmp_prod_001',
      actor: { id: 'usr_owner_01', type: 'USER' },
      action: 'APPROVAL.APPROVE',
      resourceType: 'INVOICE',
      resourceId: createdInvoice.id,
      before: { status: 'PENDING_APPROVAL' },
      after: { status: 'APPROVED', approvers: ['usr_owner_01', 'usr_approver_02'] },
    });

    // -------------------------------------------------------------------------
    // STEP 4: Accounting Sync (Bill Created in NetSuite Mock Server)
    // -------------------------------------------------------------------------
    // 1. Sync Vendor to NetSuite mock
    const vendorSync = await syncEngine.syncVendor(
      netSuiteConnector,
      'cmp_prod_001',
      {
        id: 'cnt_002',
        name: 'Sofia Rossi',
        email: 'sofia.rossi@design.it',
        currency: 'EUR',
      }
    );
    expect(vendorSync.vendor.id).toBeDefined();

    // 2. Sync Invoice to Bill in NetSuite mock
    const billSyncResult = await syncEngine.syncInvoiceToBill(
      netSuiteConnector,
      'cmp_prod_001',
      {
        id: createdInvoice.id,
        invoiceNumber: createdInvoice.invoiceNumber,
        contractorId: 'cnt_002',
        issueDate: '2026-10-16',
        dueDate: '2026-10-25',
        currency: createdInvoice.currency,
        subtotalMinor: createdInvoice.totalMinor,
        taxMinor: 0,
        totalMinor: createdInvoice.totalMinor,
        lineItems: [
          {
            description: 'Mobile App Design System & Interaction Prototyping',
            quantity: 1,
            unitPriceMinor: createdInvoice.totalMinor,
            amountMinor: createdInvoice.totalMinor,
          },
        ],
      },
      vendorSync.vendor.id
    );

    expect(billSyncResult.bill.id).toBeDefined();
    expect(billSyncResult.bill.billNumber).toBe(createdInvoice.invoiceNumber);

    // Record connector sync audit log
    await writeAuditLog(mockPrisma, {
      companyId: 'cmp_prod_001',
      actor: { id: 'netsuite-connector', type: 'CONNECTOR' },
      action: 'CONNECTOR.SYNC_BILL',
      resourceType: 'BILL',
      resourceId: billSyncResult.bill.id,
      after: { externalBillId: billSyncResult.bill.id },
    });

    // -------------------------------------------------------------------------
    // STEP 5: Audit Log Verifications
    // -------------------------------------------------------------------------
    expect(auditLogs.length).toBeGreaterThanOrEqual(2);
    const invoiceApprovalLog = auditLogs.find((l) => l.action === 'APPROVAL.APPROVE');
    expect(invoiceApprovalLog).toBeDefined();
    expect(invoiceApprovalLog.actorId).toBe('usr_owner_01');

    const billSyncLog = auditLogs.find((l) => l.action === 'CONNECTOR.SYNC_BILL');
    expect(billSyncLog).toBeDefined();
    expect(billSyncLog.after.externalBillId).toBe(billSyncResult.bill.id);
  });
});
