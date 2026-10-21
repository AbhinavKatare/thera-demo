import { z } from 'zod';
import {
  currencyCodeSchema,
  idSchema,
  isoDateSchema,
  isoDateTimeSchema,
  minorUnitsSchema,
} from './ids.js';

export const PayrollRunStatusSchema = z.enum([
  'draft',
  'review',
  'approved',
  'scheduled',
  'processing',
  'processed',
  'failed',
  'cancelled',
]);

export const PayrollItemStatusSchema = z.enum(['pending', 'approved', 'paid', 'failed']);

export const PayrollItemSchema = z.object({
  id: idSchema,
  payrollRunId: idSchema,
  contractorId: idSchema,
  grossMinor: minorUnitsSchema,
  taxMinor: minorUnitsSchema,
  netMinor: minorUnitsSchema,
  currency: currencyCodeSchema,
  status: PayrollItemStatusSchema,
  createdAt: isoDateTimeSchema,
});

export const PayrollRunSchema = z.object({
  id: idSchema,
  companyId: idSchema,
  status: PayrollRunStatusSchema,
  periodStart: isoDateSchema,
  periodEnd: isoDateSchema,
  currency: currencyCodeSchema,
  /** None until all items are computed; totals are fail-closed: absent, not zero. */
  grossMinor: minorUnitsSchema.optional(),
  taxMinor: minorUnitsSchema.optional(),
  netMinor: minorUnitsSchema.optional(),
  items: z.array(PayrollItemSchema).min(1),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export type PayrollRunStatus = z.infer<typeof PayrollRunStatusSchema>;
export type PayrollItemStatus = z.infer<typeof PayrollItemStatusSchema>;
export type PayrollItem = z.infer<typeof PayrollItemSchema>;
export type PayrollRun = z.infer<typeof PayrollRunSchema>;
