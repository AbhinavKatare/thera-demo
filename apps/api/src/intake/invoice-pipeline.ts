import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import {
  InvoiceLLMExtractor,
  LLMProvider,
  createLLMProvider,
} from '@paypilot/ai';
import { FileStore } from '../storage/file-store.js';
import { PdfExtractionPipeline } from './pdf-extractor.js';
import { ContractorMatchingService } from './contractor-matcher.js';
import { ContractMatchingService } from './contract-matcher.js';
import { writeAuditLog } from '../services/audit-log.service.js';

export interface ProcessInvoiceResult {
  inboundDocumentId: string;
  status: 'PROCESSED' | 'NEEDS_REVIEW' | 'FAILED';
  invoiceId?: string;
  paymentDraftId?: string;
  contractorId?: string;
  matchConfidence?: number;
  anomaliesCount: number;
  reasons: string[];
}

export class InvoiceProcessingPipeline {
  private readonly pdfExtractor = new PdfExtractionPipeline();
  private readonly llmExtractor: InvoiceLLMExtractor;
  private readonly contractorMatcher = new ContractorMatchingService();
  private readonly contractMatcher = new ContractMatchingService();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly fileStore: FileStore,
    llmProvider?: LLMProvider,
  ) {
    const llm = llmProvider ?? createLLMProvider(process.env.LLM_PROVIDER ?? 'mock');
    this.llmExtractor = new InvoiceLLMExtractor(llm);
  }

  public async processInboundDocument(inboundDocumentId: string): Promise<ProcessInvoiceResult> {
    const doc = await this.prisma.inboundDocument.findUnique({
      where: { id: inboundDocumentId },
      include: { file: true },
    });

    if (!doc) {
      throw new Error(`InboundDocument '${inboundDocumentId}' not found.`);
    }

    const companyId = doc.companyId ?? 'c0000000-0000-0000-0000-000000000001';
    const reasons: string[] = [];

    // 1. Fetch file content from FileStore
    const fileResult = await this.fileStore.get(doc.file.sha256Hash);
    if (!fileResult) {
      const errReason = `Stored file '${doc.fileId}' could not be read from disk.`;
      await this.prisma.inboundDocument.update({
        where: { id: inboundDocumentId },
        data: { status: 'FAILED', failureReason: errReason },
      });
      return { inboundDocumentId, status: 'FAILED', anomaliesCount: 0, reasons: [errReason] };
    }

    // 2. Extract raw text via PDF / OCR pipeline
    const textExtraction = await this.pdfExtractor.extract(fileResult.buffer, doc.file.mimeType);

    // 3. LLM Extraction with Zod validation and uncertain fields
    const extractionResult = await this.llmExtractor.extractFromText(textExtraction.text);
    const extracted = extractionResult.data;
    const validation = extractionResult.validation;

    // 4. Save extracted data to InboundDocument
    await this.prisma.inboundDocument.update({
      where: { id: inboundDocumentId },
      data: {
        extractedData: JSON.parse(JSON.stringify(extracted)),
        uncertainFields: extracted.uncertainFields,
      },
    });

    // 5. Deterministic validation check
    if (!validation.isValid) {
      reasons.push(...validation.reasons);
      await this.prisma.inboundDocument.update({
        where: { id: inboundDocumentId },
        data: {
          status: 'NEEDS_REVIEW',
          failureReason: reasons.join('; '),
        },
      });
      return {
        inboundDocumentId,
        status: 'NEEDS_REVIEW',
        anomaliesCount: 0,
        reasons,
      };
    }

    // 6. Contractor Matching
    const activeContractors = await this.prisma.contractor.findMany({
      where: { companyId, deletedAt: null },
    });

    const matchResult = this.contractorMatcher.match(
      extracted,
      doc.senderEmail ?? undefined,
      activeContractors.map((c) => ({
        id: c.id,
        companyId: c.companyId,
        legalName: c.legalName,
        displayName: c.displayName,
        email: c.email,
        taxId: c.taxId,
        countryCode: c.countryCode,
        bankAccountNumber: c.bankAccountNumber,
        bankRoutingNumber: c.bankRoutingNumber,
        bankIban: c.bankIban,
        bankSwiftBic: c.bankSwiftBic,
        bankName: c.bankName,
      })),
      0.75, // Matching threshold
    );

    if (!matchResult.matched || !matchResult.contractor) {
      const matchReason = matchResult.reason ?? 'Contractor could not be matched with high confidence.';
      reasons.push(matchReason);

      await this.prisma.inboundDocument.update({
        where: { id: inboundDocumentId },
        data: {
          status: 'NEEDS_REVIEW',
          matchConfidence: matchResult.matchConfidence,
          failureReason: matchReason,
        },
      });

      return {
        inboundDocumentId,
        status: 'NEEDS_REVIEW',
        matchConfidence: matchResult.matchConfidence,
        anomaliesCount: 0,
        reasons,
      };
    }

    const matchedContractor = matchResult.contractor;

    // 7. Contract Matching & Anomaly Checks
    const contractorContracts = await this.prisma.contract.findMany({
      where: { contractorId: matchedContractor.id, companyId, deletedAt: null },
    });

    const existingCompanyInvoices = await this.prisma.invoice.findMany({
      where: { companyId, deletedAt: null },
      take: 100,
    });

    const contractCheck = this.contractMatcher.checkInvoiceAgainstContracts(
      extracted,
      matchedContractor.id,
      contractorContracts.map((c) => ({
        id: c.id,
        contractorId: c.contractorId,
        companyId: c.companyId,
        status: c.status,
        rateType: c.rateType,
        rateMinor: c.rateMinor,
        currency: c.currency,
        monthlyCapMinor: c.monthlyCapMinor,
        effectiveDate: c.effectiveDate,
        endDate: c.endDate,
      })),
      existingCompanyInvoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        contractorId: inv.contractorId,
        totalMinor: inv.totalMinor,
        currency: inv.currency,
        issueDate: inv.issueDate,
        createdAt: inv.createdAt,
      })),
    );

    // Persist any detected anomalies
    if (contractCheck.anomalies.length > 0) {
      reasons.push(...contractCheck.reasons);
      for (const anom of contractCheck.anomalies) {
        await this.prisma.anomaly.create({
          data: {
            companyId,
            entityType: 'invoice',
            entityId: randomUUID(),
            rule: anom.rule,
            severity: anom.severity.toUpperCase() as any,
            detector: 'RULES',
            summary: anom.summary,
            details: JSON.parse(JSON.stringify(anom.evidence)),
            status: 'OPEN',
          },
        });
      }
    }

    // If contract matching failed or anomalies flagged -> route to manual review
    if (!contractCheck.isClean || !contractCheck.matchedContract) {
      await this.prisma.inboundDocument.update({
        where: { id: inboundDocumentId },
        data: {
          status: 'NEEDS_REVIEW',
          contractorId: matchedContractor.id,
          matchConfidence: matchResult.matchConfidence,
          failureReason: reasons.join('; '),
        },
      });

      return {
        inboundDocumentId,
        status: 'NEEDS_REVIEW',
        contractorId: matchedContractor.id,
        matchConfidence: matchResult.matchConfidence,
        anomaliesCount: contractCheck.anomalies.length,
        reasons,
      };
    }

    const matchedContract = contractCheck.matchedContract;

    // 8. High-confidence clean invoice: Create Invoice & PaymentDraft
    const invoice = await this.prisma.invoice.create({
      data: {
        companyId,
        contractorId: matchedContractor.id,
        contractId: matchedContract.id,
        invoiceNumber: extracted.invoiceNumber,
        status: 'SUBMITTED',
        periodStart: new Date(extracted.issueDate),
        periodEnd: new Date(extracted.dueDate),
        issueDate: new Date(extracted.issueDate),
        dueDate: new Date(extracted.dueDate),
        currency: extracted.currency.toUpperCase(),
        subtotalMinor: extracted.subtotalMinor,
        taxMinor: extracted.taxMinor,
        totalMinor: extracted.totalMinor,
        fileId: doc.fileId,
        lineItems: {
          create: extracted.lineItems.map((li) => ({
            description: li.description,
            quantity: li.quantity,
            unitPriceMinor: li.unitPriceMinor,
            amountMinor: li.amountMinor,
          })),
        },
      },
    });

    // 9. Automatically create PaymentDraft in status AWAITING_APPROVAL (Never send automatically!)
    const paymentDraft = await this.prisma.paymentDraft.create({
      data: {
        companyId,
        source: 'INVOICE',
        sourceId: invoice.id,
        invoiceId: invoice.id,
        amountMinor: invoice.totalMinor,
        currency: invoice.currency,
        status: 'AWAITING_APPROVAL',
        idempotencyKey: `draft-inv-${invoice.id}`,
      },
    });

    // 10. Update InboundDocument as PROCESSED
    await this.prisma.inboundDocument.update({
      where: { id: inboundDocumentId },
      data: {
        status: 'PROCESSED',
        invoiceId: invoice.id,
        contractorId: matchedContractor.id,
        matchConfidence: matchResult.matchConfidence,
      },
    });

    // Audit log
    await writeAuditLog(this.prisma, {
      actor: {
        id: 'invoice-intake-pipeline',
        type: 'SERVICE',
      },
      action: 'invoice.intake_processed',
      resourceType: 'invoice',
      resourceId: invoice.id,
      companyId,
      after: {
        invoiceId: invoice.id,
        paymentDraftId: paymentDraft.id,
        contractorId: matchedContractor.id,
        amountMinor: invoice.totalMinor,
      },
    });

    return {
      inboundDocumentId,
      status: 'PROCESSED',
      invoiceId: invoice.id,
      paymentDraftId: paymentDraft.id,
      contractorId: matchedContractor.id,
      matchConfidence: matchResult.matchConfidence,
      anomaliesCount: 0,
      reasons: [],
    };
  }
}
