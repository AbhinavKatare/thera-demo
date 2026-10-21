import { z } from 'zod';
import {
  currencyCodeSchema,
  idSchema,
  isoDateSchema,
  isoDateTimeSchema,
  minorUnitsSchema,
} from './ids.js';

export const InvoiceStatusSchema = z.enum([
  'draft',
  'submitted',
  'approved',
  'rejected',
  'paid',
  'void',
  'needs_review',
]);

export const invoiceLineItemSchema = z.object({
  id: idSchema,
  invoiceId: idSchema,
  description: z.string().min(1),
  /** Hours or units; fractional values are allowed for hourly work. */
  quantity: z.number().multipleOf(0.01).positive(),
  unitPriceMinor: minorUnitsSchema,
  /** Minor units; equals round(quantity * unitPriceMinor). */
  amountMinor: minorUnitsSchema,
  createdAt: isoDateTimeSchema,
});

export type InvoiceLineItem = z.infer<typeof invoiceLineItemSchema>;

export const invoiceSchema = z.object({
  id: idSchema,
  companyId: idSchema,
  contractorId: idSchema,
  contractId: idSchema,
  status: InvoiceStatusSchema,
  periodStart: isoDateSchema,
  periodEnd: isoDateSchema,
  issueDate: isoDateSchema,
  dueDate: isoDateSchema,
  invoiceNumber: z.string().min(1),
  currency: currencyCodeSchema,
  subtotalMinor: minorUnitsSchema,
  taxMinor: minorUnitsSchema,
  totalMinor: minorUnitsSchema,
  lineItems: z.array(invoiceLineItemSchema).min(1),
  taxDescription: z.string().min(1).optional(),
  notes: z.string().max(2000).optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const CreateInvoiceSchema = invoiceSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .superRefine((invoice, ctx) => {
    if (invoice.periodEnd < invoice.periodStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['periodEnd'],
        message: 'periodEnd must be on/after periodStart',
      });
    }
    const subtotal = invoice.lineItems.reduce((sum, li) => sum + li.amountMinor, 0);
    if (invoice.subtotalMinor !== subtotal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['subtotalMinor'],
        message: 'subtotalMinor must equal the sum of line item amounts',
      });
    }
    if (invoice.totalMinor !== invoice.subtotalMinor + invoice.taxMinor) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['totalMinor'],
        message: 'totalMinor must equal subtotalMinor + taxMinor',
      });
    }
  });

export type InvoiceStatus = z.infer<typeof InvoiceStatusSchema>;
export type Invoice = z.infer<typeof invoiceSchema>;
export type CreateInvoice = z.infer<typeof CreateInvoiceSchema>;
