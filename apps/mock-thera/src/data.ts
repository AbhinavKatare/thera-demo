import type {
  PayrollContractor,
  PayrollRunSummary,
  PayrollRunDetail,
  PaymentDraftSummary,
} from '@paypilot/connectors';

export const SEEDED_CONTRACTORS: PayrollContractor[] = [
  {
    id: '11111111-0000-0000-0000-000000000001',
    name: 'Elena Vance',
    email: 'elena.vance@contractor.paypilot.io',
    countryCode: 'US',
    currency: 'USD',
    hourlyRateMinor: 12500,
    status: 'active',
  },
  {
    id: '11111111-0000-0000-0000-000000000002',
    name: 'Arthur Pendelton',
    email: 'arthur.pendelton@contractor.paypilot.io',
    countryCode: 'GB',
    currency: 'GBP',
    hourlyRateMinor: 9500,
    status: 'active',
  },
  {
    id: '11111111-0000-0000-0000-000000000003',
    name: 'Klaus Hoffmann',
    email: 'klaus.hoffmann@contractor.paypilot.io',
    countryCode: 'DE',
    currency: 'EUR',
    hourlyRateMinor: 11000,
    status: 'active',
  },
  {
    id: '11111111-0000-0000-0000-000000000004',
    name: 'Yuki Tanaka',
    email: 'yuki.tanaka@contractor.paypilot.io',
    countryCode: 'JP',
    currency: 'JPY',
    hourlyRateMinor: 1600000,
    status: 'active',
  },
  {
    id: '11111111-0000-0000-0000-000000000005',
    name: 'Aarav Gupta',
    email: 'aarav.gupta@contractor.paypilot.io',
    countryCode: 'IN',
    currency: 'INR',
    hourlyRateMinor: 350000,
    status: 'active',
  },
  {
    id: '11111111-0000-0000-0000-000000000006',
    name: 'Chloe Dubois',
    email: 'chloe.dubois@contractor.paypilot.io',
    countryCode: 'CA',
    currency: 'CAD',
    hourlyRateMinor: 13500,
    status: 'active',
  },
  {
    id: '11111111-0000-0000-0000-000000000007',
    name: 'Rodrigo Santos',
    email: 'rodrigo.santos@contractor.paypilot.io',
    countryCode: 'BR',
    currency: 'BRL',
    hourlyRateMinor: 42000,
    status: 'active',
  },
  {
    id: '11111111-0000-0000-0000-000000000008',
    name: 'Fiona Gallagher',
    email: 'fiona.gallagher@contractor.paypilot.io',
    countryCode: 'AU',
    currency: 'AUD',
    hourlyRateMinor: 15000,
    status: 'active',
  },
];

export const SEEDED_UPCOMING_RUNS: PayrollRunSummary[] = [
  {
    id: 'run-2025-11',
    companyId: 'c0000000-0000-0000-0000-000000000001',
    periodStart: '2025-11-01',
    periodEnd: '2025-11-30',
    payDate: '2025-12-05',
    status: 'draft',
    currency: 'USD',
    totalGrossMinor: 3100000,
    totalTaxMinor: 155000,
    totalNetMinor: 2945000,
    contractorsCount: 8,
  },
  {
    id: 'run-2025-12',
    companyId: 'c0000000-0000-0000-0000-000000000001',
    periodStart: '2025-12-01',
    periodEnd: '2025-12-31',
    payDate: '2026-01-05',
    status: 'draft',
    currency: 'USD',
    totalGrossMinor: 3200000,
    totalTaxMinor: 160000,
    totalNetMinor: 3040000,
    contractorsCount: 8,
  },
];

export function getSeededPayrollRunDetail(dateStr: string): PayrollRunDetail {
  return {
    id: `run-${dateStr.slice(0, 7)}`,
    companyId: 'c0000000-0000-0000-0000-000000000001',
    periodStart: `${dateStr.slice(0, 7)}-01`,
    periodEnd: `${dateStr.slice(0, 7)}-28`,
    payDate: `${dateStr.slice(0, 7)}-30`,
    status: 'approved',
    currency: 'USD',
    totalGrossMinor: 2450000,
    totalTaxMinor: 120000,
    totalNetMinor: 2330000,
    contractorsCount: 2,
    items: [
      {
        contractorId: SEEDED_CONTRACTORS[0]!.id,
        contractorName: SEEDED_CONTRACTORS[0]!.name,
        grossMinor: 1250000,
        taxMinor: 60000,
        netMinor: 1190000,
        currency: 'USD',
        status: 'approved',
      },
      {
        contractorId: SEEDED_CONTRACTORS[1]!.id,
        contractorName: SEEDED_CONTRACTORS[1]!.name,
        grossMinor: 1200000,
        taxMinor: 60000,
        netMinor: 1140000,
        currency: 'USD',
        status: 'approved',
      },
    ],
  };
}

export interface PaymentDraftStoreItem extends PaymentDraftSummary {
  approvedAt?: string;
  approverId?: string;
  externalTransactionId?: string;
  failureReason?: string;
  updatedAt: string;
}

export class MockTheraDataStore {
  public contractors = [...SEEDED_CONTRACTORS];
  public upcomingRuns = [...SEEDED_UPCOMING_RUNS];
  public paymentDrafts = new Map<string, PaymentDraftStoreItem>();
  public idempotencyMap = new Map<string, string>(); // idempotencyKey -> draftId
}
