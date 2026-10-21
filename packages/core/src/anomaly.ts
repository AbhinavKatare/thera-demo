import { z } from 'zod';
import { idSchema, isoDateTimeSchema } from './ids.js';

export const AnomalySeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export const AnomalyStatusSchema = z.enum(['open', 'acknowledged', 'resolved', 'dismissed']);
export const AnomalyDetectorSchema = z.enum(['rules', 'ai', 'human']);

export const AnomalySchema = z.object({
  id: idSchema,
  companyId: idSchema,
  /** Type of the flagged resource, e.g. "invoice" | "payroll_item" | "contract". */
  entityType: z.string().min(1),
  entityId: idSchema,
  /** Stable rule identifier, e.g. "contractor.rate_jump", "duplicate.invoice_number". */
  rule: z.string().min(1),
  severity: AnomalySeveritySchema,
  status: AnomalyStatusSchema,
  detector: AnomalyDetectorSchema,
  summary: z.string().min(1),
  details: z.record(z.unknown()).optional(),
  resolvedBy: z.string().min(1).optional(),
  resolvedAt: isoDateTimeSchema.optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const CreateAnomalySchema = AnomalySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AnomalySeverity = z.infer<typeof AnomalySeveritySchema>;
export type AnomalyStatus = z.infer<typeof AnomalyStatusSchema>;
export type AnomalyDetector = z.infer<typeof AnomalyDetectorSchema>;
export type Anomaly = z.infer<typeof AnomalySchema>;
export type CreateAnomaly = z.infer<typeof CreateAnomalySchema>;
