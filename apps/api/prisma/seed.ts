import { PrismaClient, ActorType } from '@prisma/client';
import { createHash } from 'node:crypto';

const prisma = new PrismaClient();

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export async function seedDatabase(client: PrismaClient = prisma) {
  console.log('🌱 Starting PayPilot seed script...');

  // 1. Create or upsert 1 Company
  const company = await client.company.upsert({
    where: { slug: 'paypilot-technologies' },
    update: {},
    create: {
      id: 'c0000000-0000-0000-0000-000000000001',
      name: 'PayPilot Technologies Inc.',
      slug: 'paypilot-technologies',
      countryCode: 'US',
      defaultCurrency: 'USD',
      timezone: 'America/New_York',
    },
  });
  console.log(`✓ Company ready: ${company.name} (${company.id})`);

  // 2. Create 8 Contractors in different countries & currencies with active contracts
  const contractorConfigs = [
    {
      id: '11111111-0000-0000-0000-000000000001',
      legalName: 'Elena Vance Software LLC',
      displayName: 'Elena Vance',
      email: 'elena.vance@contractor.paypilot.io',
      taxId: 'US-987-65-4321',
      countryCode: 'US',
      currency: 'USD',
      defaultRateMinor: 12500, // $125.00/hr
      timezone: 'America/Chicago',
      contractId: '21111111-0000-0000-0000-000000000001',
    },
    {
      id: '11111111-0000-0000-0000-000000000002',
      legalName: 'Arthur Pendelton Ltd',
      displayName: 'Arthur Pendelton',
      email: 'arthur.pendelton@contractor.paypilot.io',
      taxId: 'GB-123456789',
      countryCode: 'GB',
      currency: 'GBP',
      defaultRateMinor: 9500, // £95.00/hr
      timezone: 'Europe/London',
      contractId: '21111111-0000-0000-0000-000000000002',
    },
    {
      id: '11111111-0000-0000-0000-000000000003',
      legalName: 'Klaus Hoffmann Consulting GmbH',
      displayName: 'Klaus Hoffmann',
      email: 'klaus.hoffmann@contractor.paypilot.io',
      taxId: 'DE-345678901',
      countryCode: 'DE',
      currency: 'EUR',
      defaultRateMinor: 11000, // €110.00/hr
      timezone: 'Europe/Berlin',
      contractId: '21111111-0000-0000-0000-000000000003',
    },
    {
      id: '11111111-0000-0000-0000-000000000004',
      legalName: 'Yuki Tanaka',
      displayName: 'Yuki Tanaka',
      email: 'yuki.tanaka@contractor.paypilot.io',
      taxId: 'JP-456789012',
      countryCode: 'JP',
      currency: 'JPY',
      defaultRateMinor: 1600000, // ¥16,000/hr
      timezone: 'Asia/Tokyo',
      contractId: '21111111-0000-0000-0000-000000000004',
    },
    {
      id: '11111111-0000-0000-0000-000000000005',
      legalName: 'Aarav Gupta Tech Services Pvt Ltd',
      displayName: 'Aarav Gupta',
      email: 'aarav.gupta@contractor.paypilot.io',
      taxId: 'IN-AAAPG1234F',
      countryCode: 'IN',
      currency: 'INR',
      defaultRateMinor: 350000, // ₹3,500.00/hr
      timezone: 'Asia/Kolkata',
      contractId: '21111111-0000-0000-0000-000000000005',
    },
    {
      id: '11111111-0000-0000-0000-000000000006',
      legalName: 'Chloe Dubois Ingenierie Inc.',
      displayName: 'Chloe Dubois',
      email: 'chloe.dubois@contractor.paypilot.io',
      taxId: 'CA-678901234',
      countryCode: 'CA',
      currency: 'CAD',
      defaultRateMinor: 13500, // $135.00 CAD/hr
      timezone: 'America/Montreal',
      contractId: '21111111-0000-0000-0000-000000000006',
    },
    {
      id: '11111111-0000-0000-0000-000000000007',
      legalName: 'Rodrigo Santos Consultoria ME',
      displayName: 'Rodrigo Santos',
      email: 'rodrigo.santos@contractor.paypilot.io',
      taxId: 'BR-78.901.234/0001-56',
      countryCode: 'BR',
      currency: 'BRL',
      defaultRateMinor: 42000, // R$ 420.00/hr
      timezone: 'America/Sao_Paulo',
      contractId: '21111111-0000-0000-0000-000000000007',
    },
    {
      id: '11111111-0000-0000-0000-000000000008',
      legalName: 'Fiona Gallagher Solutions Pty Ltd',
      displayName: 'Fiona Gallagher',
      email: 'fiona.gallagher@contractor.paypilot.io',
      taxId: 'AU-89012345678',
      countryCode: 'AU',
      currency: 'AUD',
      defaultRateMinor: 15000, // $150.00 AUD/hr
      timezone: 'Australia/Sydney',
      contractId: '21111111-0000-0000-0000-000000000008',
    },
  ];

  const contractors = [];
  const contracts = [];

  for (const cfg of contractorConfigs) {
    const contractor = await client.contractor.upsert({
      where: { id: cfg.id },
      update: {},
      create: {
        id: cfg.id,
        companyId: company.id,
        legalName: cfg.legalName,
        displayName: cfg.displayName,
        email: cfg.email,
        taxId: cfg.taxId,
        countryCode: cfg.countryCode,
        status: 'ACTIVE',
        defaultRateMinor: cfg.defaultRateMinor,
        timezone: cfg.timezone,
      },
    });
    contractors.push(contractor);

    const contract = await client.contract.upsert({
      where: { id: cfg.contractId },
      update: {},
      create: {
        id: cfg.contractId,
        companyId: company.id,
        contractorId: contractor.id,
        status: 'ACTIVE',
        effectiveDate: new Date('2025-01-01T00:00:00Z'),
        rateType: 'HOURLY',
        rateMinor: cfg.defaultRateMinor,
        currency: cfg.currency,
        contractorCountryCode: cfg.countryCode,
      },
    });
    contracts.push(contract);
  }
  console.log(`✓ 8 Contractors & contracts seeded across 8 countries/currencies`);

  // 3. Create 3 Payroll Runs
  const payrollRun1 = await client.payrollRun.upsert({
    where: { id: '30000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '30000000-0000-0000-0000-000000000001',
      companyId: company.id,
      status: 'PROCESSED',
      periodStart: new Date('2025-08-01T00:00:00Z'),
      periodEnd: new Date('2025-08-31T23:59:59Z'),
      currency: 'USD',
      grossMinor: 2450000,
      taxMinor: 120000,
      netMinor: 2330000,
      items: {
        create: [
          {
            id: '31000000-0000-0000-0000-000000000001',
            contractorId: contractors[0]!.id,
            grossMinor: 1250000,
            taxMinor: 60000,
            netMinor: 1190000,
            currency: 'USD',
            status: 'PAID',
          },
          {
            id: '31000000-0000-0000-0000-000000000002',
            contractorId: contractors[1]!.id,
            grossMinor: 1200000,
            taxMinor: 60000,
            netMinor: 1140000,
            currency: 'USD',
            status: 'PAID',
          },
        ],
      },
    },
  });

  const payrollRun2 = await client.payrollRun.upsert({
    where: { id: '30000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '30000000-0000-0000-0000-000000000002',
      companyId: company.id,
      status: 'APPROVED',
      periodStart: new Date('2025-09-01T00:00:00Z'),
      periodEnd: new Date('2025-09-30T23:59:59Z'),
      currency: 'USD',
      grossMinor: 2600000,
      taxMinor: 130000,
      netMinor: 2470000,
      items: {
        create: [
          {
            id: '31000000-0000-0000-0000-000000000003',
            contractorId: contractors[0]!.id,
            grossMinor: 1300000,
            taxMinor: 65000,
            netMinor: 1235000,
            currency: 'USD',
            status: 'APPROVED',
          },
          {
            id: '31000000-0000-0000-0000-000000000004',
            contractorId: contractors[2]!.id,
            grossMinor: 1300000,
            taxMinor: 65000,
            netMinor: 1235000,
            currency: 'USD',
            status: 'APPROVED',
          },
        ],
      },
    },
  });

  const payrollRun3 = await client.payrollRun.upsert({
    where: { id: '30000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '30000000-0000-0000-0000-000000000003',
      companyId: company.id,
      status: 'DRAFT',
      periodStart: new Date('2025-10-01T00:00:00Z'),
      periodEnd: new Date('2025-10-31T23:59:59Z'),
      currency: 'USD',
      grossMinor: 2800000,
      taxMinor: 140000,
      netMinor: 2660000,
      items: {
        create: [
          {
            id: '31000000-0000-0000-0000-000000000005',
            contractorId: contractors[3]!.id,
            grossMinor: 1400000,
            taxMinor: 70000,
            netMinor: 1330000,
            currency: 'USD',
            status: 'PENDING',
          },
          {
            id: '31000000-0000-0000-0000-000000000006',
            contractorId: contractors[4]!.id,
            grossMinor: 1400000,
            taxMinor: 70000,
            netMinor: 1330000,
            currency: 'USD',
            status: 'PENDING',
          },
        ],
      },
    },
  });
  console.log(`✓ 3 Payroll runs seeded (PROCESSED, APPROVED, DRAFT)`);

  // 4. Create 15 Sample Invoices with calculated line items, SHA-256 hashes, and statuses
  const invoiceSeeds = [
    {
      id: '40000000-0000-0000-0000-000000000001',
      contractorIndex: 0,
      invoiceNumber: 'INV-2025-001',
      status: 'PAID' as const,
      periodStart: new Date('2025-07-01'),
      periodEnd: new Date('2025-07-31'),
      issueDate: new Date('2025-08-01'),
      dueDate: new Date('2025-08-15'),
      currency: 'USD',
      lines: [
        { desc: 'Backend Architecture & API Implementation (40h)', qty: 40, unitRate: 12500, amount: 500000 },
        { desc: 'Database Optimization & Indexing (10h)', qty: 10, unitRate: 12500, amount: 125000 },
      ],
      taxMinor: 0,
    },
    {
      id: '40000000-0000-0000-0000-000000000002',
      contractorIndex: 1,
      invoiceNumber: 'INV-2025-002',
      status: 'PAID' as const,
      periodStart: new Date('2025-07-01'),
      periodEnd: new Date('2025-07-31'),
      issueDate: new Date('2025-08-01'),
      dueDate: new Date('2025-08-20'),
      currency: 'GBP',
      lines: [
        { desc: 'UX/UI Wireframes and Design Tokens (35h)', qty: 35, unitRate: 9500, amount: 332500 },
        { desc: 'Design System Review Workshop (5h)', qty: 5, unitRate: 9500, amount: 47500 },
      ],
      taxMinor: 0,
    },
    {
      id: '40000000-0000-0000-0000-000000000003',
      contractorIndex: 2,
      invoiceNumber: 'INV-2025-003',
      status: 'PAID' as const,
      periodStart: new Date('2025-07-01'),
      periodEnd: new Date('2025-07-31'),
      issueDate: new Date('2025-08-01'),
      dueDate: new Date('2025-08-14'),
      currency: 'EUR',
      lines: [
        { desc: 'Kubernetes Cluster Deployment & Helm Charts (30h)', qty: 30, unitRate: 11000, amount: 330000 },
        { desc: 'CI/CD Pipeline Security Hardening (10h)', qty: 10, unitRate: 11000, amount: 110000 },
      ],
      taxMinor: 0,
    },
    {
      id: '40000000-0000-0000-0000-000000000004',
      contractorIndex: 3,
      invoiceNumber: 'INV-2025-004',
      status: 'PAID' as const,
      periodStart: new Date('2025-07-01'),
      periodEnd: new Date('2025-07-31'),
      issueDate: new Date('2025-08-02'),
      dueDate: new Date('2025-08-16'),
      currency: 'JPY',
      lines: [
        { desc: 'Automated E2E Test Suite Creation (20h)', qty: 20, unitRate: 1600000, amount: 32000000 },
      ],
      taxMinor: 0,
    },
    {
      id: '40000000-0000-0000-0000-000000000005',
      contractorIndex: 4,
      invoiceNumber: 'INV-2025-005',
      status: 'APPROVED' as const,
      periodStart: new Date('2025-08-01'),
      periodEnd: new Date('2025-08-31'),
      issueDate: new Date('2025-09-01'),
      dueDate: new Date('2025-09-15'),
      currency: 'INR',
      lines: [
        { desc: 'Payment Gateway Integration & Webhooks (50h)', qty: 50, unitRate: 350000, amount: 17500000 },
      ],
      taxMinor: 0,
    },
    {
      id: '40000000-0000-0000-0000-000000000006',
      contractorIndex: 5,
      invoiceNumber: 'INV-2025-006',
      status: 'APPROVED' as const,
      periodStart: new Date('2025-08-01'),
      periodEnd: new Date('2025-08-31'),
      issueDate: new Date('2025-09-01'),
      dueDate: new Date('2025-09-15'),
      currency: 'CAD',
      lines: [
        { desc: 'Security Audit & Penetration Testing (25h)', qty: 25, unitRate: 13500, amount: 337500 },
      ],
      taxMinor: 16875,
    },
    {
      id: '40000000-0000-0000-0000-000000000007',
      contractorIndex: 6,
      invoiceNumber: 'INV-2025-007',
      status: 'APPROVED' as const,
      periodStart: new Date('2025-08-01'),
      periodEnd: new Date('2025-08-31'),
      issueDate: new Date('2025-09-02'),
      dueDate: new Date('2025-09-16'),
      currency: 'BRL',
      lines: [
        { desc: 'Frontend Dashboard Real-time Charts (40h)', qty: 40, unitRate: 42000, amount: 1680000 },
      ],
      taxMinor: 0,
    },
    {
      id: '40000000-0000-0000-0000-000000000008',
      contractorIndex: 7,
      invoiceNumber: 'INV-2025-008',
      status: 'APPROVED' as const,
      periodStart: new Date('2025-08-01'),
      periodEnd: new Date('2025-08-31'),
      issueDate: new Date('2025-09-02'),
      dueDate: new Date('2025-09-16'),
      currency: 'AUD',
      lines: [
        { desc: 'Data Pipeline Kafka Consumer Optimization (30h)', qty: 30, unitRate: 15000, amount: 450000 },
      ],
      taxMinor: 45000,
    },
    {
      id: '40000000-0000-0000-0000-000000000009',
      contractorIndex: 0,
      invoiceNumber: 'INV-2025-009',
      status: 'SUBMITTED' as const,
      periodStart: new Date('2025-09-01'),
      periodEnd: new Date('2025-09-30'),
      issueDate: new Date('2025-10-01'),
      dueDate: new Date('2025-10-15'),
      currency: 'USD',
      lines: [
        { desc: 'Fastify API V2 Performance Refactoring (32h)', qty: 32, unitRate: 12500, amount: 400000 },
      ],
      taxMinor: 0,
    },
    {
      id: '40000000-0000-0000-0000-000000000010',
      contractorIndex: 1,
      invoiceNumber: 'INV-2025-010',
      status: 'SUBMITTED' as const,
      periodStart: new Date('2025-09-01'),
      periodEnd: new Date('2025-09-30'),
      issueDate: new Date('2025-10-01'),
      dueDate: new Date('2025-10-20'),
      currency: 'GBP',
      lines: [
        { desc: 'Mobile Responsive Audit & Figma Prototyping (28h)', qty: 28, unitRate: 9500, amount: 266000 },
      ],
      taxMinor: 0,
    },
    {
      id: '40000000-0000-0000-0000-000000000011',
      contractorIndex: 2,
      invoiceNumber: 'INV-2025-011',
      status: 'SUBMITTED' as const,
      periodStart: new Date('2025-09-01'),
      periodEnd: new Date('2025-09-30'),
      issueDate: new Date('2025-10-01'),
      dueDate: new Date('2025-10-15'),
      currency: 'EUR',
      lines: [
        { desc: 'Grafana & Prometheus Observability Monitoring (35h)', qty: 35, unitRate: 11000, amount: 385000 },
      ],
      taxMinor: 0,
    },
    {
      id: '40000000-0000-0000-0000-000000000012',
      contractorIndex: 3,
      invoiceNumber: 'INV-2025-012',
      status: 'DRAFT' as const,
      periodStart: new Date('2025-10-01'),
      periodEnd: new Date('2025-10-31'),
      issueDate: new Date('2025-10-18'),
      dueDate: new Date('2025-11-05'),
      currency: 'JPY',
      lines: [
        { desc: 'Regression Testing & Load Testing Framework (15h)', qty: 15, unitRate: 1600000, amount: 24000000 },
      ],
      taxMinor: 0,
    },
    {
      id: '40000000-0000-0000-0000-000000000013',
      contractorIndex: 4,
      invoiceNumber: 'INV-2025-013',
      status: 'DRAFT' as const,
      periodStart: new Date('2025-10-01'),
      periodEnd: new Date('2025-10-31'),
      issueDate: new Date('2025-10-19'),
      dueDate: new Date('2025-11-04'),
      currency: 'INR',
      lines: [
        { desc: 'Webhook Reliability & Retry Queue Setup (25h)', qty: 25, unitRate: 350000, amount: 8750000 },
      ],
      taxMinor: 0,
    },
    {
      id: '40000000-0000-0000-0000-000000000014',
      contractorIndex: 5,
      invoiceNumber: 'INV-2025-014',
      status: 'REJECTED' as const,
      periodStart: new Date('2025-08-15'),
      periodEnd: new Date('2025-09-15'),
      issueDate: new Date('2025-09-16'),
      dueDate: new Date('2025-09-30'),
      currency: 'CAD',
      lines: [
        { desc: 'Unapproved Scope Exploration (45h)', qty: 45, unitRate: 13500, amount: 607500 },
      ],
      taxMinor: 0,
    },
    {
      id: '40000000-0000-0000-0000-000000000015',
      contractorIndex: 6,
      invoiceNumber: 'INV-2025-015',
      status: 'DRAFT' as const,
      periodStart: new Date('2025-10-01'),
      periodEnd: new Date('2025-10-31'),
      issueDate: new Date('2025-10-20'),
      dueDate: new Date('2025-11-10'),
      currency: 'BRL',
      lines: [
        { desc: 'Accessibility Audit (WCAG 2.1 AA) (20h)', qty: 20, unitRate: 42000, amount: 840000 },
      ],
      taxMinor: 0,
    },
  ];

  for (const inv of invoiceSeeds) {
    const contractor = contractors[inv.contractorIndex]!;
    const contract = contracts[inv.contractorIndex]!;
    const subtotalMinor = inv.lines.reduce((acc, l) => acc + l.amount, 0);
    const totalMinor = subtotalMinor + inv.taxMinor;
    const invContent = `${inv.invoiceNumber}:${inv.periodStart.toISOString()}:${inv.periodEnd.toISOString()}:${totalMinor}:${contractor.id}`;
    const invoiceHash = sha256(invContent);

    const invoice = await client.invoice.upsert({
      where: { id: inv.id },
      update: {},
      create: {
        id: inv.id,
        companyId: company.id,
        contractorId: contractor.id,
        contractId: contract.id,
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        periodStart: inv.periodStart,
        periodEnd: inv.periodEnd,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        currency: inv.currency,
        subtotalMinor,
        taxMinor: inv.taxMinor,
        totalMinor,
        invoiceHash,
        notes: `Sample invoice ${inv.invoiceNumber} for ${contractor.displayName}`,
        lineItems: {
          create: inv.lines.map((l, idx) => ({
            id: `41000000-0000-0000-0000-${String(idx + 1).padStart(12, '0')}`,
            description: l.desc,
            quantity: l.qty,
            unitPriceMinor: l.unitRate,
            amountMinor: l.amount,
          })),
        },
      },
    });

    // Seed PaymentDraft for approved or paid invoices to show realistic financial flows
    if (inv.status === 'APPROVED' || inv.status === 'PAID') {
      const draftStatus = inv.status === 'PAID' ? 'EXECUTED' : 'APPROVED';
      const draftId = `50000000-0000-0000-0000-${inv.id.slice(-12)}`;
      await client.paymentDraft.upsert({
        where: { id: draftId },
        update: {},
        create: {
          id: draftId,
          companyId: company.id,
          source: 'INVOICE',
          sourceId: invoice.id,
          invoiceId: invoice.id,
          amountMinor: totalMinor,
          currency: inv.currency,
          status: draftStatus,
          approvedBy: 'finance-lead@paypilot.io',
          executedAt: inv.status === 'PAID' ? new Date('2025-08-25T14:00:00Z') : null,
          externalTransactionId: inv.status === 'PAID' ? `tx-mock-${inv.invoiceNumber}` : null,
          idempotencyKey: `idem-draft-${inv.id}`,
        },
      });
    }
  }
  console.log(`✓ 15 Invoices seeded with verified line-item sums, taxes, and SHA-256 hashes`);

  // 5. Initial AuditLog entries for the seed setup
  await client.auditLog.create({
    data: {
      id: '90000000-0000-0000-0000-000000000001',
      companyId: company.id,
      timestamp: new Date(),
      actorType: ActorType.SERVICE,
      actorId: 'seed-runner',
      action: 'system.database_seeded',
      resourceType: 'Company',
      resourceId: company.id,
      metadata: {
        contractorsCount: contractors.length,
        invoicesCount: invoiceSeeds.length,
        payrollRunsCount: 3,
      },
    },
  });
  console.log(`✓ AuditLog recorded for seed completion`);

  console.log('🎉 Database seeding successfully completed!');
}

// Auto-run if executed directly
if (process.env.NODE_ENV !== 'test' && (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js'))) {
  seedDatabase()
    .catch((err) => {
      console.error('Seed error:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
