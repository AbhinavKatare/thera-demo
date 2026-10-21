import { describe, expect, it } from 'vitest';
import {
  OAuthTokensSchema,
  UpsertVendorInputSchema,
  CreateBillInputSchema,
  MarkBillPaidInputSchema,
  AccountRecordSchema,
  SyncStatusResultSchema,
  MockAccountingConnector,
  getConnector,
} from './index.js';

describe('AccountingConnector Zod Schemas', () => {
  it('validates OAuthTokens schema', () => {
    const valid = OAuthTokensSchema.parse({
      accessToken: 'xero-acc-token-12345',
      refreshToken: 'xero-ref-token-67890',
      tokenType: 'Bearer',
      expiresInSeconds: 1800,
      expiresAt: Date.now() + 1800_000,
      scope: 'accounting.transactions accounting.contacts',
      tenantId: 'tenant-001',
    });

    expect(valid.accessToken).toBe('xero-acc-token-12345');
    expect(valid.tokenType).toBe('Bearer');
  });

  it('validates UpsertVendorInput schema', () => {
    const input = UpsertVendorInputSchema.parse({
      name: 'Acme Software Solutions Ltd',
      email: 'vendor@acmesoft.com',
      taxId: 'US-EIN-99-8877665',
      currency: 'USD',
      bankDetails: {
        accountName: 'Acme Software Solutions',
        routingNumber: '021000021',
        accountNumber: '9988776655',
      },
      externalReference: 'c0000000-0000-0000-0000-000000000001',
      idempotencyKey: 'idemp-vendor-001',
    });

    expect(input.name).toBe('Acme Software Solutions Ltd');
    expect(input.bankDetails?.accountNumber).toBe('9988776655');
  });

  it('validates CreateBillInput schema', () => {
    const bill = CreateBillInputSchema.parse({
      vendorId: 'vend-101',
      invoiceNumber: 'INV-2026-900',
      issueDate: '2026-10-20',
      dueDate: '2026-11-03',
      currency: 'USD',
      lineItems: [
        {
          description: 'Frontend Architecture Sprint',
          quantity: 1,
          unitPriceMinor: 420_000,
          amountMinor: 420_000,
          accountCode: '400',
        },
      ],
      subtotalMinor: 420_000,
      taxMinor: 0,
      totalMinor: 420_000,
      idempotencyKey: 'idemp-bill-001',
      externalReference: 'inv-uuid-123',
    });

    expect(bill.invoiceNumber).toBe('INV-2026-900');
    expect(bill.totalMinor).toBe(420_000);
  });

  it('validates MarkBillPaidInput schema', () => {
    const payment = MarkBillPaidInputSchema.parse({
      billId: 'bill-101',
      paymentDate: '2026-10-20',
      amountMinor: 420_000,
      currency: 'USD',
      paymentAccountId: 'acc-090',
      reference: 'PayPilot Wire #9021',
      idempotencyKey: 'idemp-pay-001',
    });

    expect(payment.amountMinor).toBe(420_000);
    expect(payment.reference).toBe('PayPilot Wire #9021');
  });

  it('validates SyncStatusResult schema', () => {
    const status = SyncStatusResultSchema.parse({
      provider: 'xero',
      status: 'CONNECTED',
      externalAccountId: 'tenant-xero-01',
      tenantName: 'Xero Demo Company',
      rateLimitRemaining: 58,
      errors: [],
    });

    expect(status.status).toBe('CONNECTED');
    expect(status.rateLimitRemaining).toBe(58);
  });
});

describe('MockAccountingConnector & Factory', () => {
  it('instantiates MockAccountingConnector and handles end-to-end sync cycle', async () => {
    const connector = new MockAccountingConnector();
    expect(connector.provider).toBe('mock');

    // 1. Connect
    const conn = await connector.connect({ tenantId: 'mock-t1' });
    expect(conn.connected).toBe(true);

    // 2. Upsert vendor
    const vendor = await connector.upsertVendor({
      name: 'Global Tech Contractor',
      email: 'tech@global.internal',
      currency: 'USD',
      externalReference: 'c-001',
      idempotencyKey: 'idemp-v-1',
    });
    expect(vendor.name).toBe('Global Tech Contractor');

    // 3. Create bill
    const bill = await connector.createBill({
      vendorId: vendor.id,
      invoiceNumber: 'INV-MOCK-01',
      issueDate: '2026-10-20',
      dueDate: '2026-11-04',
      currency: 'USD',
      lineItems: [
        {
          description: 'Dev work',
          quantity: 1,
          unitPriceMinor: 250_000,
          amountMinor: 250_000,
        },
      ],
      subtotalMinor: 250_000,
      totalMinor: 250_000,
      idempotencyKey: 'idemp-b-1',
    });
    expect(bill.billNumber).toBe('INV-MOCK-01');
    expect(bill.status).toBe('AUTHORISED');

    // 4. Mark bill paid
    const payment = await connector.markBillPaid({
      billId: bill.id,
      paymentDate: '2026-10-20',
      amountMinor: 250_000,
      currency: 'USD',
      idempotencyKey: 'idemp-p-1',
    });
    expect(payment.status).toBe('RECORDED');

    // 5. List accounts
    const accounts = await connector.listAccounts();
    expect(accounts.accounts.length).toBeGreaterThanOrEqual(2);

    // 6. Sync status
    const syncStatus = await connector.getSyncStatus(conn.externalAccountId);
    expect(syncStatus.status).toBe('CONNECTED');
  });

  it('getConnector factory returns appropriate connector by provider', () => {
    const xero = getConnector('xero');
    expect(xero.provider).toBe('xero');

    const zoho = getConnector('zoho');
    expect(zoho.provider).toBe('zoho');

    const netsuite = getConnector('netsuite');
    expect(netsuite.provider).toBe('netsuite');

    const mock = getConnector('mock');
    expect(mock.provider).toBe('mock');
  });
});
