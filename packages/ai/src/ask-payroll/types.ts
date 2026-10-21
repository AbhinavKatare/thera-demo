import { z } from 'zod';

export const WhitelistedQueryNameSchema = z.enum([
  'TOTAL_PAYROLL_SPEND',
  'CONTRACTOR_PAYOUT_HISTORY',
  'OPEN_INVOICES',
  'ANOMALIES_SUMMARY',
  'UPCOMING_PAYROLL_RUNS',
  'CONTRACTOR_DIRECTORY',
]);

export type WhitelistedQueryName = z.infer<typeof WhitelistedQueryNameSchema>;

export const ParsedQuerySchema = z.object({
  queryName: WhitelistedQueryNameSchema,
  parameters: z.record(z.union([z.string(), z.number(), z.boolean()])),
  explanation: z.string().optional(),
});

export type ParsedQuery = z.infer<typeof ParsedQuerySchema>;

export interface SourceRowCitation {
  id: string;
  entityType: string;
  label: string;
  keyValues: Record<string, unknown>;
}

export interface AskPayrollResponse {
  question: string;
  answer: string;
  queryExecuted: WhitelistedQueryName;
  parameters: Record<string, unknown>;
  rowCount: number;
  sourceCitations: SourceRowCitation[];
  isSecurityBlocked?: boolean;
}

export interface QueryExecutionResult {
  rows: Array<Record<string, any>>;
  entityType: string;
  totalCount: number;
}

export interface PayrollQueryExecutor {
  execute(
    companyId: string,
    queryName: WhitelistedQueryName,
    params: Record<string, unknown>,
  ): Promise<QueryExecutionResult>;
}
