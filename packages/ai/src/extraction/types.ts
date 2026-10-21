import { z } from 'zod';

export const ExtractedLineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPriceMinor: z.number().int().nonnegative(),
  amountMinor: z.number().int().positive(),
});

export type ExtractedLineItem = z.infer<typeof ExtractedLineItemSchema>;

export const ExtractedBankDetailsSchema = z.object({
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  routingNumber: z.string().optional(),
  iban: z.string().optional(),
  swiftBic: z.string().optional(),
});

export type ExtractedBankDetails = z.infer<typeof ExtractedBankDetailsSchema>;

export const InvoiceExtractionSchema = z.object({
  vendorName: z.string().min(1),
  invoiceNumber: z.string().min(1),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'issueDate must be YYYY-MM-DD'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dueDate must be YYYY-MM-DD'),
  currency: z.string().length(3),
  lineItems: z.array(ExtractedLineItemSchema).min(1),
  subtotalMinor: z.number().int().positive(),
  taxMinor: z.number().int().nonnegative(),
  totalMinor: z.number().int().positive(),
  bankDetails: ExtractedBankDetailsSchema.optional(),
  uncertainFields: z.array(z.string()),
});

export type ExtractedInvoice = z.infer<typeof InvoiceExtractionSchema>;

export interface InvoiceValidationResult {
  isValid: boolean;
  reasons: string[];
  status: 'PROCESSED' | 'NEEDS_REVIEW';
}
