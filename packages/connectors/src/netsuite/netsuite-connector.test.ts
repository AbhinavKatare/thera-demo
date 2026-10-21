import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NetSuiteConnector } from './netsuite-connector.js';
import { NetSuiteMockServer } from './netsuite-mock-server.js';

describe('NetSuiteConnector Contract Tests against SuiteTalk REST Mock', () => {
  let mockServer: NetSuiteMockServer;
  let serverUrl: string;

  beforeAll(async () => {
    mockServer = new NetSuiteMockServer({ accountId: '7654321' });
    serverUrl = await mockServer.start();
  });

  afterAll(async () => {
    await mockServer.close();
  });

  it('is clearly labeled as contract-tested', () => {
    const connector = new NetSuiteConnector();
    expect(connector.isContractTested).toBe(true);
    expect(connector.provider).toBe('netsuite');
  });

  it('generates valid Token-Based Authentication (TBA) HMAC-SHA256 header', () => {
    const connector = new NetSuiteConnector({
      accountId: '7654321',
      credentials: {
        consumerKey: 'ck-12345',
        consumerSecret: 'cs-67890',
        tokenId: 'tid-abcdef',
        tokenSecret: 'ts-uvwxyz',
      },
    });

    const header = connector.generateTbaHeader('POST', 'https://7654321.suitetalk.api.netsuite.com/services/rest/record/v1/vendorBill');
    expect(header).toContain('OAuth realm="7654321"');
    expect(header).toContain('oauth_consumer_key="ck-12345"');
    expect(header).toContain('oauth_token="tid-abcdef"');
    expect(header).toContain('oauth_signature_method="HMAC-SHA256"');
    expect(header).toContain('oauth_signature=');
  });

  it('executes full vendor, bill, and payment cycle against SuiteTalk REST mock server', async () => {
    const connector = new NetSuiteConnector({
      accountId: '7654321',
      baseUrl: `${serverUrl}/services/rest/record/v1`,
      bearerToken: 'suite-talk-test-token',
    });

    // 1. Connect
    const conn = await connector.connect({
      credentials: {
        consumerKey: 'test-ck',
        consumerSecret: 'test-cs',
        tokenId: 'test-tid',
        tokenSecret: 'test-ts',
      },
    });
    expect(conn.connected).toBe(true);
    expect(conn.tenantName).toContain('Contract Tested');

    // 2. Upsert Vendor
    const vendor = await connector.upsertVendor({
      name: 'Tokyo Design Labs',
      email: 'vendor@tokyodesign.jp',
      currency: 'USD',
      externalReference: 'ctr-tokyo-01',
      idempotencyKey: 'idemp-v-netsuite-01',
    });
    expect(vendor.id).toBeDefined();
    expect(vendor.name).toBe('Tokyo Design Labs');

    // 3. List Vendors
    const vendorList = await connector.listVendors();
    expect(vendorList.vendors.length).toBeGreaterThanOrEqual(1);
    expect(vendorList.vendors[0]?.name).toBe('Tokyo Design Labs');

    // 4. Create Vendor Bill
    const bill = await connector.createBill({
      vendorId: vendor.id,
      invoiceNumber: 'INV-NS-8821',
      issueDate: '2026-10-20',
      dueDate: '2026-11-04',
      currency: 'USD',
      lineItems: [
        {
          description: 'UI/UX Visual Architecture Overhaul',
          quantity: 1,
          unitPriceMinor: 650_000,
          amountMinor: 650_000,
        },
      ],
      subtotalMinor: 650_000,
      totalMinor: 650_000,
      idempotencyKey: 'idemp-bill-ns-01',
    });

    expect(bill.id).toBeDefined();
    expect(bill.billNumber).toBe('INV-NS-8821');
    expect(bill.status).toBe('AUTHORISED');
    expect(bill.totalMinor).toBe(650_000);

    // 5. Mark Bill Paid (Vendor Payment)
    const payment = await connector.markBillPaid({
      billId: bill.id,
      paymentDate: '2026-10-20',
      amountMinor: 650_000,
      currency: 'USD',
      paymentAccountId: '120',
      reference: 'NetSuite ACH Ref 7721',
      idempotencyKey: 'idemp-pay-ns-01',
    });

    expect(payment.id).toBeDefined();
    expect(payment.billId).toBe(bill.id);
    expect(payment.amountMinor).toBe(650_000);
    expect(payment.status).toBe('RECORDED');

    // 6. List Accounts
    const accounts = await connector.listAccounts();
    expect(accounts.accounts.length).toBeGreaterThanOrEqual(2);
    expect(accounts.accounts.some((a) => a.code === '6010')).toBe(true);

    // 7. Get Sync Status
    const status = await connector.getSyncStatus(conn.externalAccountId);
    expect(status.status).toBe('CONNECTED');
    expect(status.provider).toBe('netsuite');
  });
});
