import { PrismaClient } from '@prisma/client';
import {
  InMemoryPayrollQueryExecutor,
  PayrollQueryExecutor,
  QueryExecutionResult,
  WhitelistedQueryName,
} from '@paypilot/ai';

export class PrismaPayrollQueryExecutor implements PayrollQueryExecutor {
  private readonly fallbackExecutor = new InMemoryPayrollQueryExecutor();

  constructor(private readonly prisma?: PrismaClient) {}

  async execute(
    companyId: string,
    queryName: WhitelistedQueryName,
    params: Record<string, unknown>,
  ): Promise<QueryExecutionResult> {
    if (!this.prisma) {
      return this.fallbackExecutor.execute(companyId, queryName, params);
    }

    switch (queryName) {
      case 'TOTAL_PAYROLL_SPEND': {
        const runs = await this.prisma.payrollRun.findMany({
          where: {
            companyId,
            deletedAt: null,
            ...(params.currency ? { currency: String(params.currency).toUpperCase() } : {}),
            ...(params.periodStart ? { periodStart: { gte: new Date(String(params.periodStart)) } } : {}),
            ...(params.periodEnd ? { periodEnd: { lte: new Date(String(params.periodEnd)) } } : {}),
          },
          orderBy: { periodStart: 'desc' },
          take: 20,
        });

        return {
          rows: runs.map((r) => ({
            id: r.id,
            periodStart: r.periodStart.toISOString().split('T')[0],
            periodEnd: r.periodEnd.toISOString().split('T')[0],
            grossMinor: r.grossMinor ?? 0,
            taxMinor: r.taxMinor ?? 0,
            netMinor: r.netMinor ?? 0,
            currency: r.currency,
            status: r.status,
          })),
          entityType: 'payroll_run',
          totalCount: runs.length,
        };
      }

      case 'CONTRACTOR_PAYOUT_HISTORY': {
        const contractorName = params.contractorName ? String(params.contractorName) : undefined;
        const contractorId = params.contractorId ? String(params.contractorId) : undefined;
        const limit = typeof params.limit === 'number' ? params.limit : 10;

        const items = await this.prisma.payrollItem.findMany({
          where: {
            payrollRun: { companyId, deletedAt: null },
            deletedAt: null,
            ...(contractorId ? { contractorId } : {}),
            ...(contractorName
              ? {
                  contractor: {
                    OR: [
                      { displayName: { contains: contractorName, mode: 'insensitive' as const } },
                      { legalName: { contains: contractorName, mode: 'insensitive' as const } },
                    ],
                  },
                }
              : {}),
          },
          include: {
            contractor: true,
            payrollRun: true,
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
        });

        return {
          rows: items.map((i: any) => ({
            id: i.id,
            contractorId: i.contractorId,
            contractorName: i.contractor?.displayName ?? i.contractor?.legalName ?? 'Unknown',
            grossMinor: i.grossMinor,
            currency: i.currency,
            status: i.status,
            paidAt: i.payrollRun?.periodEnd ? i.payrollRun.periodEnd.toISOString().split('T')[0] : 'N/A',
          })),
          entityType: 'payout',
          totalCount: items.length,
        };
      }

      case 'OPEN_INVOICES': {
        const status = params.status && params.status !== 'all' ? (String(params.status).toUpperCase() as any) : undefined;
        const limit = typeof params.limit === 'number' ? params.limit : 20;

        const invoices = await this.prisma.invoice.findMany({
          where: {
            companyId,
            deletedAt: null,
            ...(status ? { status } : { status: { in: ['SUBMITTED', 'APPROVED'] } }),
            ...(params.currency ? { currency: String(params.currency).toUpperCase() } : {}),
            ...(params.contractorId ? { contractorId: String(params.contractorId) } : {}),
          },
          include: {
            contractor: true,
          },
          orderBy: { dueDate: 'asc' },
          take: limit,
        });

        return {
          rows: invoices.map((inv: any) => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            contractorName: inv.contractor?.displayName ?? inv.contractor?.legalName ?? 'Unknown',
            amountMinor: inv.totalMinor,
            currency: inv.currency,
            status: inv.status,
            dueDate: inv.dueDate.toISOString().split('T')[0],
          })),
          entityType: 'invoice',
          totalCount: invoices.length,
        };
      }

      case 'ANOMALIES_SUMMARY': {
        const status = params.status && params.status !== 'all' ? (String(params.status).toUpperCase() as any) : undefined;
        const severity = params.severity && params.severity !== 'all' ? (String(params.severity).toUpperCase() as any) : undefined;
        const limit = typeof params.limit === 'number' ? params.limit : 20;

        const anomalies = await this.prisma.anomaly.findMany({
          where: {
            companyId,
            deletedAt: null,
            ...(status ? { status } : { status: 'OPEN' }),
            ...(severity ? { severity } : {}),
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
        });

        return {
          rows: anomalies.map((a) => ({
            id: a.id,
            rule: a.rule,
            severity: a.severity,
            status: a.status,
            summary: a.summary,
            entityType: a.entityType,
            entityId: a.entityId,
          })),
          entityType: 'anomaly',
          totalCount: anomalies.length,
        };
      }

      case 'UPCOMING_PAYROLL_RUNS': {
        const limit = typeof params.limit === 'number' ? params.limit : 5;

        const runs = await this.prisma.payrollRun.findMany({
          where: {
            companyId,
            deletedAt: null,
            status: { in: ['DRAFT', 'REVIEW', 'APPROVED', 'SCHEDULED'] },
          },
          orderBy: { periodStart: 'asc' },
          take: limit,
        });

        return {
          rows: runs.map((r) => ({
            id: r.id,
            periodStart: r.periodStart.toISOString().split('T')[0],
            periodEnd: r.periodEnd.toISOString().split('T')[0],
            status: r.status,
            currency: r.currency,
            estimatedGrossMinor: r.grossMinor ?? 0,
          })),
          entityType: 'payroll_run',
          totalCount: runs.length,
        };
      }

      case 'CONTRACTOR_DIRECTORY': {
        const limit = typeof params.limit === 'number' ? params.limit : 20;
        const search = params.search ? String(params.search) : undefined;

        const contractors = await this.prisma.contractor.findMany({
          where: {
            companyId,
            deletedAt: null,
            status: 'ACTIVE',
            ...(params.country ? { countryCode: String(params.country).toUpperCase() } : {}),
            ...(search
              ? {
                  OR: [
                    { displayName: { contains: search, mode: 'insensitive' as const } },
                    { legalName: { contains: search, mode: 'insensitive' as const } },
                    { email: { contains: search, mode: 'insensitive' as const } },
                  ],
                }
              : {}),
          },
          include: {
            contracts: {
              where: { status: 'ACTIVE', deletedAt: null },
              take: 1,
            },
          },
          take: limit,
        });

        return {
          rows: contractors.map((c: any) => ({
            id: c.id,
            name: c.displayName ?? c.legalName,
            email: c.email,
            country: c.countryCode,
            currency: c.contracts?.[0]?.currency ?? 'USD',
            status: c.status,
          })),
          entityType: 'contractor',
          totalCount: contractors.length,
        };
      }

      default:
        return this.fallbackExecutor.execute(companyId, queryName, params);
    }
  }
}
