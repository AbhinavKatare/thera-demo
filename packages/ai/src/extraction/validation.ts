import { ExtractedInvoice, InvoiceValidationResult } from './types.js';

const VALID_ISO_CURRENCIES = new Set([
  'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY', 'INR', 'BRL',
  'SGD', 'HKD', 'NZD', 'SEK', 'NOK', 'DKK', 'PLN', 'MXN', 'ZAR', 'AED',
]);

export function validateInvoiceExtraction(extracted: ExtractedInvoice): InvoiceValidationResult {
  const reasons: string[] = [];

  // 1. Line items must sum to total
  const lineItemsSum = extracted.lineItems.reduce((acc, item) => acc + item.amountMinor, 0);
  if (lineItemsSum !== extracted.subtotalMinor) {
    reasons.push(
      `Line items sum (${lineItemsSum / 100}) does not match subtotal (${extracted.subtotalMinor / 100}).`,
    );
  }

  const expectedTotal = extracted.subtotalMinor + extracted.taxMinor;
  if (expectedTotal !== extracted.totalMinor) {
    reasons.push(
      `Subtotal (${extracted.subtotalMinor / 100}) plus tax (${extracted.taxMinor / 100}) does not equal total (${extracted.totalMinor / 100}).`,
    );
  }

  // 2. Dates must be sane
  const issueDateObj = new Date(extracted.issueDate);
  const dueDateObj = new Date(extracted.dueDate);
  const now = new Date();

  if (isNaN(issueDateObj.getTime())) {
    reasons.push(`Issue date '${extracted.issueDate}' is not a valid calendar date.`);
  }

  if (isNaN(dueDateObj.getTime())) {
    reasons.push(`Due date '${extracted.dueDate}' is not a valid calendar date.`);
  }

  if (!isNaN(issueDateObj.getTime()) && !isNaN(dueDateObj.getTime())) {
    if (dueDateObj.getTime() < issueDateObj.getTime()) {
      reasons.push(`Due date (${extracted.dueDate}) cannot be earlier than issue date (${extracted.issueDate}).`);
    }

    // Must not be more than 10 years in past
    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(now.getFullYear() - 10);
    if (issueDateObj < tenYearsAgo) {
      reasons.push(`Issue date (${extracted.issueDate}) is older than 10 years.`);
    }

    // Must not be more than 90 days in future
    const futureLimit = new Date();
    futureLimit.setDate(now.getDate() + 90);
    if (issueDateObj > futureLimit) {
      reasons.push(`Issue date (${extracted.issueDate}) is improbably far in the future (>90 days).`);
    }
  }

  // 3. Currency must be a valid ISO code
  const upperCurrency = extracted.currency.toUpperCase();
  if (!VALID_ISO_CURRENCIES.has(upperCurrency)) {
    reasons.push(`Currency '${extracted.currency}' is not a recognized valid ISO 4217 currency code.`);
  }

  // 4. Amounts must be positive
  if (extracted.subtotalMinor <= 0) {
    reasons.push(`Subtotal amount (${extracted.subtotalMinor}) must be strictly positive.`);
  }

  if (extracted.totalMinor <= 0) {
    reasons.push(`Total amount (${extracted.totalMinor}) must be strictly positive.`);
  }

  for (let idx = 0; idx < extracted.lineItems.length; idx++) {
    const item = extracted.lineItems[idx]!;
    if (item.amountMinor <= 0) {
      reasons.push(`Line item #${idx + 1} amount (${item.amountMinor}) must be positive.`);
    }
    if (item.quantity <= 0) {
      reasons.push(`Line item #${idx + 1} quantity (${item.quantity}) must be positive.`);
    }
  }

  // 5. Check if model flagged any uncertain fields
  if (extracted.uncertainFields && extracted.uncertainFields.length > 0) {
    reasons.push(
      `Extraction flagged model uncertainty on fields: [${extracted.uncertainFields.join(', ')}].`,
    );
  }

  const isValid = reasons.length === 0;
  return {
    isValid,
    reasons,
    status: isValid ? 'PROCESSED' : 'NEEDS_REVIEW',
  };
}
