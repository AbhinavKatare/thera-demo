import { describe, expect, it, vi } from 'vitest';
import { seedDatabase } from '../prisma/seed.js';

interface MockDbStore {
  company: any[];
  contractor: any[];
  contract: any[];
  payrollRun: any[];
  invoice: any[];
  paymentDraft: any[];
  auditLog: any[];
}

describe('Database Seed Script', () => {
  it('executes seed with 1 company, 8 international contractors, 3 payroll runs, and 15 sample invoices', async () => {
    const mockDb: MockDbStore = {
      company: [],
      contractor: [],
      contract: [],
      payrollRun: [],
      invoice: [],
      paymentDraft: [],
      auditLog: [],
    };

    const mockPrisma = {
      company: {
        upsert: vi.fn().mockImplementation(async ({ create }) => {
          mockDb.company.push(create);
          return create;
        }),
      },
      contractor: {
        upsert: vi.fn().mockImplementation(async ({ create }) => {
          mockDb.contractor.push(create);
          return create;
        }),
      },
      contract: {
        upsert: vi.fn().mockImplementation(async ({ create }) => {
          mockDb.contract.push(create);
          return create;
        }),
      },
      payrollRun: {
        upsert: vi.fn().mockImplementation(async ({ create }) => {
          mockDb.payrollRun.push(create);
          return create;
        }),
      },
      invoice: {
        upsert: vi.fn().mockImplementation(async ({ create }) => {
          mockDb.invoice.push(create);
          return create;
        }),
      },
      paymentDraft: {
        upsert: vi.fn().mockImplementation(async ({ create }) => {
          mockDb.paymentDraft.push(create);
          return create;
        }),
      },
      auditLog: {
        create: vi.fn().mockImplementation(async ({ data }) => {
          mockDb.auditLog.push(data);
          return data;
        }),
      },
    };

    await seedDatabase(mockPrisma as any);

    // 1. Validate Company
    expect(mockDb.company).toHaveLength(1);
    const company = mockDb.company[0];
    expect(company.slug).toBe('paypilot-technologies');
    expect(company.countryCode).toBe('US');
    expect(company.defaultCurrency).toBe('USD');

    // 2. Validate 8 Contractors in different countries & currencies
    expect(mockDb.contractor).toHaveLength(8);
    expect(mockDb.contract).toHaveLength(8);

    const countries = new Set(mockDb.contractor.map((c) => c.countryCode));
    expect(countries.size).toBe(8);
    expect(countries).toContain('US');
    expect(countries).toContain('GB');
    expect(countries).toContain('DE');
    expect(countries).toContain('JP');
    expect(countries).toContain('IN');
    expect(countries).toContain('CA');
    expect(countries).toContain('BR');
    expect(countries).toContain('AU');

    const currencies = new Set(mockDb.contract.map((c) => c.currency));
    expect(currencies.size).toBe(8);
    expect(currencies).toContain('USD');
    expect(currencies).toContain('GBP');
    expect(currencies).toContain('EUR');
    expect(currencies).toContain('JPY');
    expect(currencies).toContain('INR');
    expect(currencies).toContain('CAD');
    expect(currencies).toContain('BRL');
    expect(currencies).toContain('AUD');

    // 3. Validate 3 Payroll Runs
    expect(mockDb.payrollRun).toHaveLength(3);
    const statuses = mockDb.payrollRun.map((pr) => pr.status);
    expect(statuses).toContain('PROCESSED');
    expect(statuses).toContain('APPROVED');
    expect(statuses).toContain('DRAFT');

    // 4. Validate 15 Sample Invoices
    expect(mockDb.invoice).toHaveLength(15);
    for (const inv of mockDb.invoice) {
      expect(inv.invoiceHash).toMatch(/^[a-f0-9]{64}$/); // Valid SHA-256 hash
      expect(inv.subtotalMinor).toBeGreaterThan(0);
      expect(inv.totalMinor).toBe(inv.subtotalMinor + inv.taxMinor);
      expect(inv.lineItems.create.length).toBeGreaterThanOrEqual(1);

      const lineItemsSum = inv.lineItems.create.reduce(
        (sum: number, l: any) => sum + l.amountMinor,
        0,
      );
      expect(inv.subtotalMinor).toBe(lineItemsSum);
    }

    // 5. Validate AuditLog was recorded
    expect(mockDb.auditLog.length).toBeGreaterThanOrEqual(1);
    expect(mockDb.auditLog[0].action).toBe('system.database_seeded');
  });
});
