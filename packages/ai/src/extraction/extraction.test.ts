import { describe, expect, it } from 'vitest';
import { InvoiceLLMExtractor } from './extractor.js';
import { validateInvoiceExtraction } from './validation.js';
import { MockLLMProvider } from '../llm/mock-provider.js';
import { ExtractedInvoice } from './types.js';

describe('Invoice Extraction & Validation', () => {
  const validInvoice: ExtractedInvoice = {
    vendorName: 'Acme Cloud Consulting Ltd',
    invoiceNumber: 'INV-2026-901',
    issueDate: '2026-10-01',
    dueDate: '2026-10-31',
    currency: 'USD',
    lineItems: [
      {
        description: 'Cloud Architecture & Dev',
        quantity: 20,
        unitPriceMinor: 15000,
        amountMinor: 300000,
      },
    ],
    subtotalMinor: 300000,
    taxMinor: 30000,
    totalMinor: 330000,
    bankDetails: {
      accountNumber: '123456789',
      routingNumber: '021000021',
      bankName: 'Chase',
    },
    uncertainFields: [],
  };

  it('validates a clean, mathematically consistent invoice', () => {
    const result = validateInvoiceExtraction(validInvoice);
    expect(result.isValid).toBe(true);
    expect(result.status).toBe('PROCESSED');
    expect(result.reasons).toHaveLength(0);
  });

  it('flags line items sum mismatch and sets status to NEEDS_REVIEW', () => {
    const badMathInvoice: ExtractedInvoice = {
      ...validInvoice,
      subtotalMinor: 400000, // Does not equal sum of line items (300,000)
    };
    const result = validateInvoiceExtraction(badMathInvoice);
    expect(result.isValid).toBe(false);
    expect(result.status).toBe('NEEDS_REVIEW');
    expect(result.reasons.some((r) => r.includes('does not match subtotal'))).toBe(true);
  });

  it('flags due date earlier than issue date', () => {
    const badDatesInvoice: ExtractedInvoice = {
      ...validInvoice,
      issueDate: '2026-10-31',
      dueDate: '2026-10-01', // Earlier than issue date!
    };
    const result = validateInvoiceExtraction(badDatesInvoice);
    expect(result.isValid).toBe(false);
    expect(result.status).toBe('NEEDS_REVIEW');
    expect(result.reasons.some((r) => r.includes('earlier than issue date'))).toBe(true);
  });

  it('flags invalid currency codes', () => {
    const badCurrencyInvoice: ExtractedInvoice = {
      ...validInvoice,
      currency: 'XYZ',
    };
    const result = validateInvoiceExtraction(badCurrencyInvoice);
    expect(result.isValid).toBe(false);
    expect(result.status).toBe('NEEDS_REVIEW');
    expect(result.reasons.some((r) => r.includes('recognized valid ISO'))).toBe(true);
  });

  it('flags uncertain fields identified by LLM instead of guessing', () => {
    const uncertainInvoice: ExtractedInvoice = {
      ...validInvoice,
      uncertainFields: ['taxMinor', 'dueDate'],
    };
    const result = validateInvoiceExtraction(uncertainInvoice);
    expect(result.isValid).toBe(false);
    expect(result.status).toBe('NEEDS_REVIEW');
    expect(result.reasons.some((r) => r.includes('model uncertainty on fields'))).toBe(true);
  });

  it('InvoiceLLMExtractor extracts from text and runs deterministic validation', async () => {
    const extractor = new InvoiceLLMExtractor(new MockLLMProvider());
    const docText = `
      INVOICE from Alpine Engineering Solutions GmbH
      Invoice Number: INV-EU-2026-089
      IBAN: DE89370400440532013000
      Total: 5950.00 EUR
    `;
    const result = await extractor.extractFromText(docText);

    expect(result.data.vendorName).toBe('Alpine Engineering Solutions GmbH');
    expect(result.data.currency).toBe('EUR');
    expect(result.data.bankDetails?.iban).toBe('DE89370400440532013000');
    expect(result.validation.isValid).toBe(true);
  });
});
