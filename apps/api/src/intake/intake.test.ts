import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PdfExtractionPipeline } from './pdf-extractor.js';
import { INVOICE_FIXTURES } from './fixtures/invoice-layouts.fixture.js';
import { ContractorMatchingService } from './contractor-matcher.js';
import { ContractMatchingService } from './contract-matcher.js';
import { ImapInvoicePoller } from './imap-poller.js';
import { InvoiceProcessingPipeline } from './invoice-pipeline.js';
import { LocalDiskFileStore } from '../storage/file-store.js';
import { ExtractedInvoice } from '@paypilot/ai';

describe('Invoice Intake, OCR & LLM Extraction Pipeline', () => {
  describe('PDF & OCR Extraction Pipeline (3 Layout Fixtures)', () => {
    const pipeline = new PdfExtractionPipeline();

    it('extracts Layout 1 (Modern Tech Consulting) via PDF text with high confidence', async () => {
      const fixture = INVOICE_FIXTURES.MODERN_TECH!;
      const result = await pipeline.extract(Buffer.from(fixture.rawText), 'application/pdf');

      expect(result.method).toBe('pdf_text');
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0.95);
      expect(result.text).toContain('CLOUDCRAFT DEVOPS');
      expect(result.text).toContain('INV-2026-104');
      expect(result.text).toContain('$5,250.00');
    });

    it('extracts Layout 2 (International European Agency with IBAN) via PDF text', async () => {
      const fixture = INVOICE_FIXTURES.INTERNATIONAL_AGENCY!;
      const result = await pipeline.extract(Buffer.from(fixture.rawText), 'application/pdf');

      expect(result.text).toContain('ALPINE ENGINEERING');
      expect(result.text).toContain('DE89370400440532013000');
      expect(result.text).toContain('5,950.00 EUR');
    });

    it('falls back to OCR for Layout 3 (Scanned / Rasterized Receipt) and returns confidence score', async () => {
      const fixture = INVOICE_FIXTURES.SCANNED_RECEIPT!;
      const ocrPipeline = new PdfExtractionPipeline({ forceOcr: true });
      const result = await ocrPipeline.extract(Buffer.from(fixture.rawText), 'image/png');

      expect(result.method).toBe('ocr');
      expect(result.confidenceScore).toBeGreaterThan(0.5);
      expect(result.text).toContain('QUICKPRINT');
      expect(result.text).toContain('267.00');
    });
  });

  describe('Contractor Matching (Fuse.js, Tax ID, Bank Account, Email)', () => {
    const matchingService = new ContractorMatchingService();
    const candidates = [
      {
        id: 'c-1',
        companyId: 'comp-1',
        legalName: 'CloudCraft DevOps Consulting Ltd',
        displayName: 'CloudCraft DevOps',
        email: 'billing@cloudcraft-devops.io',
        taxId: 'US-94-3829104',
        countryCode: 'US',
        bankAccountNumber: '9876543210',
        bankRoutingNumber: '021000021',
      },
      {
        id: 'c-2',
        companyId: 'comp-1',
        legalName: 'Alpine Engineering Solutions GmbH',
        displayName: 'Alpine Engineering',
        email: 'billing@alpine-eng.de',
        taxId: 'DE314892105',
        countryCode: 'DE',
        bankIban: 'DE89370400440532013000',
        bankSwiftBic: 'DEUTDEDDFXX',
      },
    ];

    it('matches contractor by exact Tax ID / VAT number with very high confidence', () => {
      const extracted: ExtractedInvoice = {
        vendorName: 'Alpine Solutions',
        invoiceNumber: 'INV-001',
        issueDate: '2026-10-01',
        dueDate: '2026-10-31',
        currency: 'EUR',
        lineItems: [{ description: 'Engineering', quantity: 1, unitPriceMinor: 1000, amountMinor: 1000 }],
        subtotalMinor: 1000,
        taxMinor: 0,
        totalMinor: 1000,
        uncertainFields: [],
      };

      // Pass raw text with VAT ID
      (extracted as any).taxIdMentioned = 'DE 314 892 105';
      const result = matchingService.match(extracted, undefined, candidates);

      expect(result.matched).toBe(true);
      expect(result.contractor?.id).toBe('c-2');
      expect(result.matchStrategy).toBe('tax_id');
      expect(result.matchConfidence).toBeGreaterThanOrEqual(0.95);
    });

    it('matches contractor by IBAN banking details', () => {
      const extracted: ExtractedInvoice = {
        vendorName: 'Unknown Vendor',
        invoiceNumber: 'INV-002',
        issueDate: '2026-10-01',
        dueDate: '2026-10-31',
        currency: 'EUR',
        lineItems: [{ description: 'Consulting', quantity: 1, unitPriceMinor: 1000, amountMinor: 1000 }],
        subtotalMinor: 1000,
        taxMinor: 0,
        totalMinor: 1000,
        bankDetails: { iban: 'DE89370400440532013000' },
        uncertainFields: [],
      };

      const result = matchingService.match(extracted, undefined, candidates);

      expect(result.matched).toBe(true);
      expect(result.contractor?.id).toBe('c-2');
      expect(result.matchStrategy).toBe('bank_iban');
      expect(result.matchConfidence).toBe(0.95);
    });

    it('matches contractor by email domain', () => {
      const extracted: ExtractedInvoice = {
        vendorName: 'Some Contractor',
        invoiceNumber: 'INV-003',
        issueDate: '2026-10-01',
        dueDate: '2026-10-31',
        currency: 'USD',
        lineItems: [{ description: 'DevOps', quantity: 1, unitPriceMinor: 1000, amountMinor: 1000 }],
        subtotalMinor: 1000,
        taxMinor: 0,
        totalMinor: 1000,
        uncertainFields: [],
      };

      const result = matchingService.match(extracted, 'invoice@cloudcraft-devops.io', candidates);

      expect(result.matched).toBe(true);
      expect(result.contractor?.id).toBe('c-1');
      expect(result.matchStrategy).toBe('email_domain');
      expect(result.matchConfidence).toBeGreaterThanOrEqual(0.85);
    });

    it('fuzzy-matches contractor name using Fuse.js', () => {
      const extracted: ExtractedInvoice = {
        vendorName: 'CloudCraft DevOps Consulting',
        invoiceNumber: 'INV-004',
        issueDate: '2026-10-01',
        dueDate: '2026-10-31',
        currency: 'USD',
        lineItems: [{ description: 'DevOps', quantity: 1, unitPriceMinor: 1000, amountMinor: 1000 }],
        subtotalMinor: 1000,
        taxMinor: 0,
        totalMinor: 1000,
        uncertainFields: [],
      };

      const result = matchingService.match(extracted, undefined, candidates);

      expect(result.matched).toBe(true);
      expect(result.contractor?.id).toBe('c-1');
      expect(result.matchStrategy).toBe('fuzzy_name');
      expect(result.matchConfidence).toBeGreaterThanOrEqual(0.75);
    });

    it('routes low confidence matches below threshold to manual review', () => {
      const extracted: ExtractedInvoice = {
        vendorName: 'Completely Unrelated Global Enterprises',
        invoiceNumber: 'INV-005',
        issueDate: '2026-10-01',
        dueDate: '2026-10-31',
        currency: 'USD',
        lineItems: [{ description: 'Random', quantity: 1, unitPriceMinor: 1000, amountMinor: 1000 }],
        subtotalMinor: 1000,
        taxMinor: 0,
        totalMinor: 1000,
        uncertainFields: [],
      };

      const result = matchingService.match(extracted, undefined, candidates, 0.75);

      expect(result.matched).toBe(false);
      expect(result.reason).toContain('below required threshold');
    });
  });

  describe('Contract Matching, Rate, Monthly Cap & 30-Day Duplicate Checks', () => {
    const contractMatcher = new ContractMatchingService();

    const sampleContract = {
      id: 'contract-1',
      contractorId: 'c-1',
      companyId: 'comp-1',
      status: 'ACTIVE',
      rateType: 'HOURLY',
      rateMinor: 15000, // $150.00 / hr
      currency: 'USD',
      monthlyCapMinor: 1000000, // $10,000.00 / month cap
      effectiveDate: '2026-01-01',
    };

    it('passes checks for a clean invoice within rate and cap', () => {
      const extracted: ExtractedInvoice = {
        vendorName: 'CloudCraft DevOps',
        invoiceNumber: 'INV-2026-104',
        issueDate: '2026-10-10',
        dueDate: '2026-10-24',
        currency: 'USD',
        lineItems: [{ description: 'DevOps', quantity: 35, unitPriceMinor: 15000, amountMinor: 525000 }],
        subtotalMinor: 525000,
        taxMinor: 0,
        totalMinor: 525000,
        uncertainFields: [],
      };

      const result = contractMatcher.checkInvoiceAgainstContracts(extracted, 'c-1', [sampleContract], []);

      expect(result.isClean).toBe(true);
      expect(result.anomalies).toHaveLength(0);
      expect(result.matchedContract?.id).toBe('contract-1');
    });

    it('flags rate discrepancy when invoiced rate exceeds contract rate', () => {
      const extracted: ExtractedInvoice = {
        vendorName: 'CloudCraft DevOps',
        invoiceNumber: 'INV-2026-105',
        issueDate: '2026-10-10',
        dueDate: '2026-10-24',
        currency: 'USD',
        lineItems: [{ description: 'DevOps', quantity: 10, unitPriceMinor: 25000, amountMinor: 250000 }], // $250/hr vs $150/hr!
        subtotalMinor: 250000,
        taxMinor: 0,
        totalMinor: 250000,
        uncertainFields: [],
      };

      const result = contractMatcher.checkInvoiceAgainstContracts(extracted, 'c-1', [sampleContract], []);

      expect(result.isClean).toBe(false);
      expect(result.anomalies.some((a) => a.rule === 'invoice.rate_discrepancy')).toBe(true);
    });

    it('flags anomaly when invoice total exceeds contract monthly cap', () => {
      const extracted: ExtractedInvoice = {
        vendorName: 'CloudCraft DevOps',
        invoiceNumber: 'INV-2026-106',
        issueDate: '2026-10-28',
        dueDate: '2026-11-10',
        currency: 'USD',
        lineItems: [{ description: 'DevOps', quantity: 40, unitPriceMinor: 15000, amountMinor: 600000 }],
        subtotalMinor: 600000,
        taxMinor: 0,
        totalMinor: 600000,
        uncertainFields: [],
      };

      const pastInvoices = [
        {
          id: 'inv-prev',
          invoiceNumber: 'INV-2026-101',
          contractorId: 'c-1',
          totalMinor: 550000, // $5,500 already billed in October. $5,500 + $6,000 = $11,500 > $10,000 cap!
          currency: 'USD',
          issueDate: '2026-10-05',
          createdAt: '2026-10-05',
        },
      ];

      const result = contractMatcher.checkInvoiceAgainstContracts(extracted, 'c-1', [sampleContract], pastInvoices);

      expect(result.isClean).toBe(false);
      expect(result.anomalies.some((a) => a.rule === 'invoice.monthly_cap_exceeded')).toBe(true);
    });

    it('detects duplicate invoices within 30 days', () => {
      const extracted: ExtractedInvoice = {
        vendorName: 'CloudCraft DevOps',
        invoiceNumber: 'INV-2026-999',
        issueDate: '2026-10-20',
        dueDate: '2026-11-05',
        currency: 'USD',
        lineItems: [{ description: 'DevOps', quantity: 20, unitPriceMinor: 15000, amountMinor: 300000 }],
        subtotalMinor: 300000,
        taxMinor: 0,
        totalMinor: 300000,
        uncertainFields: [],
      };

      const pastInvoices = [
        {
          id: 'inv-old',
          invoiceNumber: 'INV-2026-888',
          contractorId: 'c-1',
          totalMinor: 300000, // Identical amount $3,000 billed 8 days ago!
          currency: 'USD',
          issueDate: '2026-10-12',
          createdAt: '2026-10-12',
        },
      ];

      const result = contractMatcher.checkInvoiceAgainstContracts(extracted, 'c-1', [sampleContract], pastInvoices);

      expect(result.isClean).toBe(false);
      expect(result.anomalies.some((a) => a.rule === 'invoice.duplicate_amount_30_days')).toBe(true);
    });
  });

  describe('End-to-End Invoice Processing & Automatic PaymentDraft Creation', () => {
    it('creates PaymentDraft in AWAITING_APPROVAL for clean high-confidence invoices and never pays automatically', async () => {
      // Mock Prisma with in-memory stores
      const inboundDocs = new Map<string, any>();
      const invoices = new Map<string, any>();
      const paymentDrafts = new Map<string, any>();
      const contractors = [
        {
          id: 'c0000000-0000-0000-0000-000000000001',
          companyId: 'comp-1',
          legalName: 'CloudCraft DevOps Consulting Ltd',
          displayName: 'CloudCraft DevOps',
          email: 'billing@cloudcraft-devops.io',
          countryCode: 'US',
          status: 'ACTIVE',
          bankAccountNumber: '9876543210',
          bankRoutingNumber: '021000021',
        },
      ];
      const contracts = [
        {
          id: 'contract-1',
          contractorId: 'c0000000-0000-0000-0000-000000000001',
          companyId: 'comp-1',
          status: 'ACTIVE',
          rateType: 'HOURLY',
          rateMinor: 15000,
          currency: 'USD',
          monthlyCapMinor: 1000000,
          effectiveDate: new Date('2026-01-01'),
        },
      ];

      const mockPrisma: any = {
        inboundDocument: {
          findUnique: async ({ where }: any) => inboundDocs.get(where.id),
          update: async ({ where, data }: any) => {
            const entry = inboundDocs.get(where.id);
            Object.assign(entry, data);
            return entry;
          },
        },
        contractor: {
          findMany: async () => contractors,
        },
        contract: {
          findMany: async () => contracts,
        },
        invoice: {
          findMany: async () => Array.from(invoices.values()),
          create: async ({ data }: any) => {
            const id = randomUUID();
            const rec = { id, ...data };
            invoices.set(id, rec);
            return rec;
          },
        },
        paymentDraft: {
          create: async ({ data }: any) => {
            const id = randomUUID();
            const rec = { id, ...data };
            paymentDrafts.set(id, rec);
            return rec;
          },
        },
        anomaly: {
          create: async ({ data }: any) => data,
        },
        auditLog: {
          create: async ({ data }: any) => data,
        },
      };

      const fileStore = new LocalDiskFileStore({
        baseDir: './scratch/test-storage-' + randomUUID(),
      });
      const savedFile = await fileStore.save({
        filename: 'invoice-104.pdf',
        content: Buffer.from(INVOICE_FIXTURES.MODERN_TECH!.rawText),
        mimeType: 'application/pdf',
        companyId: 'comp-1',
      });

      const docId = randomUUID();
      inboundDocs.set(docId, {
        id: docId,
        companyId: 'comp-1',
        fileId: savedFile.id,
        file: savedFile,
        senderEmail: 'billing@cloudcraft-devops.io',
        status: 'PENDING',
      });

      const pipeline = new InvoiceProcessingPipeline(mockPrisma, fileStore);
      const result = await pipeline.processInboundDocument(docId);

      expect(result.status).toBe('PROCESSED');
      expect(result.invoiceId).toBeDefined();
      expect(result.paymentDraftId).toBeDefined();

      const createdDraft = paymentDrafts.get(result.paymentDraftId!);
      expect(createdDraft).toBeDefined();
      expect(createdDraft.status).toBe('AWAITING_APPROVAL'); // Awaiting approval! Never executed automatically!
      expect(createdDraft.amountMinor).toBe(525000);
      expect(createdDraft.currency).toBe('USD');
    });
  });
});
