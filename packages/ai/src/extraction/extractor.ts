import { LLMProvider } from '../llm/types.js';
import {
  ExtractedInvoice,
  InvoiceExtractionSchema,
  InvoiceValidationResult,
} from './types.js';
import { validateInvoiceExtraction } from './validation.js';

export interface ExtractionResult {
  data: ExtractedInvoice;
  validation: InvoiceValidationResult;
  rawJson: string;
}

export class InvoiceLLMExtractor {
  constructor(private readonly llm: LLMProvider) {}

  public async extractFromText(documentText: string): Promise<ExtractionResult> {
    const trimmedText = documentText.trim();
    if (!trimmedText) {
      throw new Error('Cannot extract invoice from empty document text.');
    }

    const systemPrompt = `
You are an expert financial document data extraction agent at PayPilot.
Your job is to read raw invoice document text and extract all required structured fields with 100% precision.

CRITICAL INSTRUCTIONS:
1. Return ONLY valid RFC 8259 JSON adhering strictly to the schema.
2. Minor units convention: All money amounts must be integers in MINOR currency units (e.g. $1,500.00 USD -> 150000, 25.50 EUR -> 2550).
3. Dates: Must be formatted in ISO YYYY-MM-DD.
4. Line Items: Extract each line item with quantity, unitPriceMinor, and amountMinor.
5. Bank details: Extract account number, routing number, IBAN, SWIFT/BIC, or bank name if present.
6. UNCERTAIN FIELDS INVARIANT: If any field (e.g. date, amount, bank detail, tax rate) is blurry, missing, conflicting, or you are NOT completely certain, DO NOT GUESS OR ESTIMATE. Put the exact field name into the "uncertainFields" array (e.g. ["dueDate", "taxMinor"]).
`.trim();

    const userPrompt = `
RAW INVOICE DOCUMENT TEXT:
---
${trimmedText.slice(0, 10_000)}
---

Extract all invoice fields matching the schema.
`.trim();

    // Check if offline/mock provider
    if (this.llm.name === 'mock' && ('hasCustomHandler' in this.llm ? !(this.llm as any).hasCustomHandler() : true)) {
      const mockData = this.generateMockExtraction(trimmedText);
      const validation = validateInvoiceExtraction(mockData);
      return {
        data: mockData,
        validation,
        rawJson: JSON.stringify(mockData),
      };
    }

    const result = await this.llm.generateStructured({
      prompt: userPrompt,
      systemPrompt,
      schema: InvoiceExtractionSchema,
      schemaName: 'InvoiceExtraction',
      temperature: 0.1,
    });

    const validation = validateInvoiceExtraction(result.data);

    return {
      data: result.data,
      validation,
      rawJson: result.rawJson,
    };
  }

  private generateMockExtraction(text: string): ExtractedInvoice {
    // Check if text is European layout fixture
    if (text.includes('EUR') || text.includes('IBAN') || text.includes('DE89370400440532013000')) {
      return {
        vendorName: 'Alpine Engineering Solutions GmbH',
        invoiceNumber: 'INV-EU-2026-089',
        issueDate: '2026-10-15',
        dueDate: '2026-11-15',
        currency: 'EUR',
        lineItems: [
          {
            description: 'Embedded Systems Architecture Consulting',
            quantity: 40,
            unitPriceMinor: 12500, // 125.00 EUR
            amountMinor: 500000, // 5,000.00 EUR
          },
        ],
        subtotalMinor: 500000,
        taxMinor: 95000, // 19% VAT = 950.00 EUR
        totalMinor: 595000, // 5,950.00 EUR
        bankDetails: {
          bankName: 'Deutsche Bank',
          iban: 'DE89370400440532013000',
          swiftBic: 'DEUTDEDDFXX',
        },
        uncertainFields: [],
      };
    }

    // Check if text is scanned receipt / noisy fixture with uncertain fields
    if (text.includes('SCANNED') || text.includes('RECEIPT') || text.includes('UNCERTAIN')) {
      return {
        vendorName: 'QuickPrint & Supplies',
        invoiceNumber: 'RCP-9901',
        issueDate: '2026-10-18',
        dueDate: '2026-10-18',
        currency: 'USD',
        lineItems: [
          {
            description: 'Office toner cartridges and paper reams',
            quantity: 1,
            unitPriceMinor: 24500,
            amountMinor: 24500,
          },
        ],
        subtotalMinor: 24500,
        taxMinor: 2200,
        totalMinor: 26700,
        uncertainFields: ['taxMinor'], // Flagged as uncertain!
      };
    }

    // Default Tech Consulting layout
    return {
      vendorName: 'CloudCraft DevOps Consulting Ltd',
      invoiceNumber: 'INV-2026-104',
      issueDate: '2026-10-10',
      dueDate: '2026-10-24',
      currency: 'USD',
      lineItems: [
        {
          description: 'Kubernetes Cluster Migration & Terraform Infrastructure',
          quantity: 35,
          unitPriceMinor: 15000, // $150.00 / hr
          amountMinor: 525000, // $5,250.00
        },
      ],
      subtotalMinor: 525000,
      taxMinor: 0,
      totalMinor: 525000,
      bankDetails: {
        bankName: 'JPMorgan Chase',
        accountNumber: '9876543210',
        routingNumber: '021000021',
      },
      uncertainFields: [],
    };
  }
}
