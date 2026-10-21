import { z } from 'zod';
import { idSchema, isoDateTimeSchema } from './ids.js';

export const ApprovalTargetTypeSchema = z.enum(['invoice', 'payment_draft', 'payroll_run']);
export const ApprovalStatusSchema = z.enum(['pending', 'approved', 'rejected']);

export const ApprovalSchema = z.object({
  id: idSchema,
  companyId: idSchema,
  targetType: ApprovalTargetTypeSchema,
  targetId: idSchema,
  requestedBy: z.string().min(1),
  status: ApprovalStatusSchema,
  /** Human who made the decision. Absent while still pending. */
  approver: z.string().min(1).optional(),
  decisionNote: z.string().max(2000).optional(),
  decidedAt: isoDateTimeSchema.optional(),
  /** Key that makes idempotent re-submission of the same decision safe. */
  idempotencyKey: z.string().min(8),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const CreateApprovalSchema = ApprovalSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ApprovalTargetType = z.infer<typeof ApprovalTargetTypeSchema>;
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;
export type Approval = z.infer<typeof ApprovalSchema>;
export type CreateApproval = z.infer<typeof CreateApprovalSchema>;
