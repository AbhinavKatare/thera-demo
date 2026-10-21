import { z } from 'zod';

// ---------------------------------------------------------------------------
// 1. Contractors schemas
// ---------------------------------------------------------------------------

export const payrollContractorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  countryCode: z.string().length(2),
  currency: z.string().regex(/^[A-Z]{3}$/),
  hourlyRateMinor: z.number().int().nonnegative().optional(),
  status: z.enum(['active', 'invited', 'offboarded']),
});

export type PayrollContractor = z.infer<typeof payrollContractorSchema>;

export const listContractorsInputSchema = z
  .object({
    companyId: z.string().uuid().optional(),
    status: z.enum(['active', 'invited', 'offboarded', 'all']).default('active'),
    limit: z.number().int().positive().max(100).default(50),
    cursor: z.string().optional(),
  })
  .default({});

export type ListContractorsInput = z.infer<typeof listContractorsInputSchema>;

export const listContractorsOutputSchema = z.object({
  contractors: z.array(payrollContractorSchema),
  nextCursor: z.string().optional(),
  total: z.number().int().nonnegative(),
});

export type ListContractorsOutput = z.infer<typeof listContractorsOutputSchema>;

// ---------------------------------------------------------------------------
// 2. Payroll Run schemas
// ---------------------------------------------------------------------------

export const payrollRunStatusSchema = z.enum([
  'draft',
  'review',
  'approved',
  'processing',
  'processed',
  'failed',
  'cancelled',
]);

export type PayrollRunStatus = z.infer<typeof payrollRunStatusSchema>;

export const payrollRunSummarySchema = z.object({
  id: z.string().min(1),
  companyId: z.string().min(1),
  periodStart: z.string(),
  periodEnd: z.string(),
  payDate: z.string(),
  status: payrollRunStatusSchema,
  currency: z.string().regex(/^[A-Z]{3}$/),
  totalGrossMinor: z.number().int().nonnegative(),
  totalTaxMinor: z.number().int().nonnegative(),
  totalNetMinor: z.number().int().nonnegative(),
  contractorsCount: z.number().int().nonnegative(),
});

export type PayrollRunSummary = z.infer<typeof payrollRunSummarySchema>;

export const payrollItemSchema = z.object({
  contractorId: z.string().min(1),
  contractorName: z.string().min(1),
  grossMinor: z.number().int().nonnegative(),
  taxMinor: z.number().int().nonnegative(),
  netMinor: z.number().int().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  status: z.enum(['pending', 'approved', 'paid', 'failed']),
});

export type PayrollItem = z.infer<typeof payrollItemSchema>;

export const payrollRunDetailSchema = payrollRunSummarySchema.extend({
  items: z.array(payrollItemSchema),
});

export type PayrollRunDetail = z.infer<typeof payrollRunDetailSchema>;

export const getPayrollRunInputSchema = z.object({
  date: z.union([z.string(), z.date()]),
  companyId: z.string().uuid().optional(),
});

export type GetPayrollRunInput = z.infer<typeof getPayrollRunInputSchema>;

export const listUpcomingRunsInputSchema = z
  .object({
    companyId: z.string().uuid().optional(),
    limit: z.number().int().positive().max(20).default(10),
  })
  .default({});

export type ListUpcomingRunsInput = z.infer<typeof listUpcomingRunsInputSchema>;

export const listUpcomingRunsOutputSchema = z.object({
  runs: z.array(payrollRunSummarySchema),
});

export type ListUpcomingRunsOutput = z.infer<typeof listUpcomingRunsOutputSchema>;

// ---------------------------------------------------------------------------
// 3. Payment Draft & Approval schemas
// ---------------------------------------------------------------------------

export const createPaymentDraftInputSchema = z.object({
  companyId: z.string().uuid().optional(),
  source: z.enum(['invoice', 'payroll_run', 'manual']),
  sourceId: z.string().min(1),
  contractorId: z.string().min(1),
  amountMinor: z.number().int().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  idempotencyKey: z.string().min(8),
  metadata: z.record(z.unknown()).optional(),
});

export type CreatePaymentDraftInput = z.infer<typeof createPaymentDraftInputSchema>;

export const paymentDraftSummarySchema = z.object({
  id: z.string().min(1),
  companyId: z.string().min(1),
  source: z.enum(['invoice', 'payroll_run', 'manual']),
  sourceId: z.string().min(1),
  contractorId: z.string().min(1),
  amountMinor: z.number().int().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  status: z.enum([
    'draft',
    'awaiting_approval',
    'approved',
    'rejected',
    'scheduled',
    'executed',
    'failed',
  ]),
  idempotencyKey: z.string(),
  createdAt: z.string(),
});

export type PaymentDraftSummary = z.infer<typeof paymentDraftSummarySchema>;

export const approvePaymentInputSchema = z.object({
  paymentDraftId: z.string().min(1),
  approverId: z.string().min(1),
  idempotencyKey: z.string().min(8),
  decisionNote: z.string().optional(),
});

export type ApprovePaymentInput = z.infer<typeof approvePaymentInputSchema>;

export const approvePaymentOutputSchema = z.object({
  paymentDraftId: z.string().min(1),
  status: z.enum(['approved', 'scheduled', 'executed']),
  approvedAt: z.string(),
  approverId: z.string().min(1),
  externalTransactionId: z.string().optional(),
});

export type ApprovePaymentOutput = z.infer<typeof approvePaymentOutputSchema>;

// ---------------------------------------------------------------------------
// 4. Payment Status schemas
// ---------------------------------------------------------------------------

export const getPaymentStatusInputSchema = z.object({
  paymentDraftId: z.string().min(1),
});

export type GetPaymentStatusInput = z.infer<typeof getPaymentStatusInputSchema>;

export const paymentStatusOutputSchema = z.object({
  paymentDraftId: z.string().min(1),
  status: z.enum([
    'draft',
    'awaiting_approval',
    'approved',
    'rejected',
    'scheduled',
    'executed',
    'failed',
  ]),
  amountMinor: z.number().int().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  externalTransactionId: z.string().optional(),
  failureReason: z.string().optional(),
  updatedAt: z.string(),
});

export type PaymentStatusOutput = z.infer<typeof paymentStatusOutputSchema>;

// ---------------------------------------------------------------------------
// 5. PayrollProvider Interface Contract
// ---------------------------------------------------------------------------

export interface PayrollProvider {
  readonly name: string;

  /**
   * Retrieves a paginated list of contractors for the company.
   */
  listContractors(input?: ListContractorsInput): Promise<ListContractorsOutput>;

  /**
   * Retrieves detailed payroll run breakdown for a given period/date.
   */
  getPayrollRun(input: string | Date | GetPayrollRunInput): Promise<PayrollRunDetail>;

  /**
   * Lists scheduled upcoming payroll cycles and deadlines.
   */
  listUpcomingRuns(input?: ListUpcomingRunsInput): Promise<ListUpcomingRunsOutput>;

  /**
   * Creates an unapproved payment draft gated behind human approval.
   * Replays of the same idempotencyKey must return the initial draft.
   */
  createPaymentDraft(input: CreatePaymentDraftInput): Promise<PaymentDraftSummary>;

  /**
   * Approves and executes or schedules a payment draft.
   * Requires human approver ID and an idempotency key.
   */
  approvePayment(input: ApprovePaymentInput): Promise<ApprovePaymentOutput>;

  /**
   * Checks real-time execution status of a payment draft.
   */
  getPaymentStatus(paymentDraftId: string): Promise<PaymentStatusOutput>;
}
