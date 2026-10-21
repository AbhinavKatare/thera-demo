import { z } from 'zod';
import {
  PayrollQueryExecutor,
  QueryExecutionResult,
  WhitelistedQueryName,
} from './types.js';

export interface QueryDefinition {
  name: WhitelistedQueryName;
  description: string;
  schema: z.ZodObject<any>;
}

export const QUERY_DEFINITIONS: Record<WhitelistedQueryName, QueryDefinition> = {
  TOTAL_PAYROLL_SPEND: {
    name: 'TOTAL_PAYROLL_SPEND',
    description: 'Calculates total payroll expenditure, gross payouts, and tax for a date range or currency.',
    schema: z.object({
      periodStart: z.string().optional(),
      periodEnd: z.string().optional(),
      currency: z.string().max(3).optional(),
    }),
  },
  CONTRACTOR_PAYOUT_HISTORY: {
    name: 'CONTRACTOR_PAYOUT_HISTORY',
    description: 'Retrieves historical payouts and payments for a specific contractor by name or ID.',
    schema: z.object({
      contractorName: z.string().optional(),
      contractorId: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(50).default(10).optional(),
    }),
  },
  OPEN_INVOICES: {
    name: 'OPEN_INVOICES',
    description: 'Lists unpaid, pending, or submitted invoices with amounts and due dates.',
    schema: z.object({
      status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID', 'all']).default('SUBMITTED').optional(),
      currency: z.string().max(3).optional(),
      contractorId: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(50).default(20).optional(),
    }),
  },
  ANOMALIES_SUMMARY: {
    name: 'ANOMALIES_SUMMARY',
    description: 'Summarizes open risk anomalies, compliance flags, or unusual activity.',
    schema: z.object({
      severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'all']).optional(),
      status: z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED', 'all']).default('OPEN').optional(),
      limit: z.number().int().min(1).max(50).default(20).optional(),
    }),
  },
  UPCOMING_PAYROLL_RUNS: {
    name: 'UPCOMING_PAYROLL_RUNS',
    description: 'Retrieves scheduled or draft upcoming payroll runs and their estimated amounts.',
    schema: z.object({
      status: z.enum(['DRAFT', 'REVIEW', 'APPROVED', 'SCHEDULED', 'all']).optional(),
      limit: z.number().int().min(1).max(10).default(5).optional(),
    }),
  },
  CONTRACTOR_DIRECTORY: {
    name: 'CONTRACTOR_DIRECTORY',
    description: 'Searches active contractors, their countries, payment currencies, and roles.',
    schema: z.object({
      country: z.string().length(2).optional(),
      currency: z.string().max(3).optional(),
      search: z.string().optional(),
      limit: z.number().int().min(1).max(50).default(20).optional(),
    }),
  },
};

/**
 * In-memory Mock Query Executor for standalone testing and fallback execution
 */
export class InMemoryPayrollQueryExecutor implements PayrollQueryExecutor {
  constructor(
    private readonly mockData: {
      payrollRuns?: any[];
      contractors?: any[];
      invoices?: any[];
      anomalies?: any[];
    } = {},
  ) {}

  async execute(
    companyId: string,
    queryName: WhitelistedQueryName,
    params: Record<string, unknown>,
  ): Promise<QueryExecutionResult> {
    switch (queryName) {
      case 'TOTAL_PAYROLL_SPEND': {
        const runs = this.mockData.payrollRuns ?? [
          { id: 'run-1', grossMinor: 1540000, taxMinor: 154000, netMinor: 1386000, currency: 'USD', periodStart: '2026-09-01', periodEnd: '2026-09-30' },
          { id: 'run-2', grossMinor: 1820000, taxMinor: 182000, netMinor: 1638000, currency: 'USD', periodStart: '2026-10-01', periodEnd: '2026-10-31' },
        ];
        return {
          rows: runs,
          entityType: 'payroll_run',
          totalCount: runs.length,
        };
      }
      case 'CONTRACTOR_PAYOUT_HISTORY': {
        const contractorName = (params.contractorName as string)?.toLowerCase();
        const rows = [
          { id: 'payout-1', contractorName: 'Elena Rostova', contractorId: 'c1', grossMinor: 450000, currency: 'USD', paidAt: '2026-09-30' },
          { id: 'payout-2', contractorName: 'Elena Rostova', contractorId: 'c1', grossMinor: 450000, currency: 'USD', paidAt: '2026-10-31' },
          { id: 'payout-3', contractorName: 'Kenji Sato', contractorId: 'c2', grossMinor: 850000, currency: 'USD', paidAt: '2026-10-31' },
        ].filter((r) => !contractorName || r.contractorName.toLowerCase().includes(contractorName));
        return {
          rows,
          entityType: 'payout',
          totalCount: rows.length,
        };
      }
      case 'OPEN_INVOICES': {
        const invoices = this.mockData.invoices ?? [
          { id: 'inv-101', invoiceNumber: 'INV-2026-101', contractorName: 'Carlos Mendez', amountMinor: 320000, currency: 'USD', status: 'SUBMITTED', dueDate: '2026-11-15' },
          { id: 'inv-102', invoiceNumber: 'INV-2026-102', contractorName: 'Amara Okafor', amountMinor: 410000, currency: 'USD', status: 'SUBMITTED', dueDate: '2026-11-20' },
        ];
        return {
          rows: invoices,
          entityType: 'invoice',
          totalCount: invoices.length,
        };
      }
      case 'ANOMALIES_SUMMARY': {
        const anomalies = this.mockData.anomalies ?? [
          { id: 'anom-1', rule: 'payroll.duplicate_payment', severity: 'CRITICAL', summary: 'Duplicate payment detected for contractor Elena Rostova', status: 'OPEN' },
          { id: 'anom-2', rule: 'payroll.recent_bank_change', severity: 'CRITICAL', summary: 'Bank account changed 3 days ago for Liam O-Connor', status: 'OPEN' },
        ];
        return {
          rows: anomalies,
          entityType: 'anomaly',
          totalCount: anomalies.length,
        };
      }
      case 'UPCOMING_PAYROLL_RUNS': {
        const runs = [
          { id: 'run-next', periodStart: '2026-11-01', periodEnd: '2026-11-15', status: 'DRAFT', currency: 'USD', estimatedGrossMinor: 1650000 },
        ];
        return {
          rows: runs,
          entityType: 'payroll_run',
          totalCount: runs.length,
        };
      }
      case 'CONTRACTOR_DIRECTORY': {
        const contractors = this.mockData.contractors ?? [
          { id: 'c1', name: 'Elena Rostova', country: 'DE', currency: 'EUR', status: 'ACTIVE', title: 'Senior Backend Engineer' },
          { id: 'c2', name: 'Kenji Sato', country: 'JP', currency: 'JPY', status: 'ACTIVE', title: 'Security Specialist' },
          { id: 'c3', name: 'Amara Okafor', country: 'NG', currency: 'USD', status: 'ACTIVE', title: 'Data Engineer' },
        ];
        return {
          rows: contractors,
          entityType: 'contractor',
          totalCount: contractors.length,
        };
      }
      default:
        return { rows: [], entityType: 'unknown', totalCount: 0 };
    }
  }
}
