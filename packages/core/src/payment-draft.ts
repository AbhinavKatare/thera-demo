import { z } from 'zod';
import { currencyCodeSchema, idSchema, isoDateTimeSchema, minorUnitsSchema } from './ids.js';

export const PaymentDraftSourceSchema = z.enum(['invoice', 'payroll_run', 'manual']);
export const PaymentDraftStatusSchema = z.enum([
  'draft',
  'awaiting_approval',
  'approved',
  'rejected',
  'scheduled',
  'executed',
  'void',
  'failed',
]);

/**
 * A PaymentDraft is the ONLY artifact PayPilot produces that can eventually
 * move money — and even then only through the accounting connector, and only
 * after an `Approval` with status `approved`. Nothing in the system may ever
 * transition a draft past `approved` without a human decision being recorded.
 */
export const PaymentDraftSchema = z.object({
  id: idSchema,
  companyId: idSchema,
  source: PaymentDraftSourceSchema,
  /** ID of the invoice / payroll run / manual reference this draft was created from. */
  sourceId: idSchema,
  amountMinor: minorUnitsSchema,
  currency: currencyCodeSchema,
  status: PaymentDraftStatusSchema,
  approvalId: idSchema.optional(),
  /** Set only after approval; recorded for audit even if the connector fails. */
  approvedBy: z.string().min(1).optional(),
  scheduledAt: isoDateTimeSchema.optional(),
  executedAt: isoDateTimeSchema.optional(),
  /** Provider-side transaction reference once executed. */
  externalTransactionId: z.string().min(1).optional(),
  /** Client-supplied key that makes every execution attempt idempotent. */
  idempotencyKey: z.string().min(8),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const CreatePaymentDraftSchema = PaymentDraftSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PaymentDraftSource = z.infer<typeof PaymentDraftSourceSchema>;
export type PaymentDraftStatus = z.infer<typeof PaymentDraftStatusSchema>;
export type PaymentDraft = z.infer<typeof PaymentDraftSchema>;
export type CreatePaymentDraft = z.infer<typeof CreatePaymentDraftSchema>;
