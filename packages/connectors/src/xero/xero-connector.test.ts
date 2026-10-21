import { describe, expect, it, vi } from 'vitest';
import { XeroConnector, XERO_SCOPES, XERO_API_LIMITS, XeroRateLimitError } from './xero-connector.js';

describe('XeroConnector', () => {
  it('exposes current valid API scopes and rate limits', () => {
    expect(XERO_SCOPES).toContain('accounting.transactions');
    expect(XERO_SCOPES).toContain('accounting.contacts');
    expect(XERO_SCOPES).toContain('offline_access');

    expect(XERO_API_LIMITS.callsPerMinute).toBe(60);
    expect(XERO_API_LIMITS.callsPerDay).toBe(5000);
  });

  it('exchanges OAuth code and connects to Xero Developer Demo Company', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/connect/token')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'mock-xero-access-token',
            refresh_token: 'mock-xero-refresh-token',
            expires_in: 1800,
            token_type: 'Bearer',
            scope: 'accounting.transactions accounting.contacts',
          }),
        };
      }
      if (url.includes('/connections')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              id: 'conn-001',
              tenantId: 'demo-company-tenant-001',
              tenantName: 'Xero Demo Company (Global)',
              tenantType: 'ORGANISATION',
            },
          ],
        };
      }
      return { ok: false, status: 404, text: async () => 'Not Found' };
    });

    const connector = new XeroConnector({
      fetchFn: mockFetch as any,
    });

    const result = await connector.connect({
      code: 'test-auth-code',
      redirectUri: 'http://localhost:3000/callback',
    });

    expect(result.connected).toBe(true);
    expect(result.provider).toBe('xero');
    expect(result.externalAccountId).toBe('demo-company-tenant-001');
    expect(result.tenantName).toBe('Xero Demo Company (Global)');
    expect(result.tokens.accessToken).toBe('mock-xero-access-token');
    expect(result.tokens.refreshToken).toBe('mock-xero-refresh-token');
  });

  it('upserts vendor contacts and creates bills with ACCPAY status', async () => {
    let createdInvoicePayload: any = null;
    let createdPaymentPayload: any = null;

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/Contacts') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            Contacts: [
              {
                ContactID: 'contact-xero-123',
                Name: body.Contacts[0].Name,
                EmailAddress: body.Contacts[0].EmailAddress,
                DefaultCurrency: body.Contacts[0].DefaultCurrency,
                ContactStatus: 'ACTIVE',
                UpdatedDateUTC: '2026-10-20T20:00:00Z',
              },
            ],
          }),
        };
      }

      if (url.includes('/Invoices') && init?.method === 'POST') {
        createdInvoicePayload = JSON.parse(String(init.body));
        const inv = createdInvoicePayload.Invoices[0];
        return {
          ok: true,
          status: 200,
          json: async () => ({
            Invoices: [
              {
                InvoiceID: 'inv-xero-999',
                InvoiceNumber: inv.InvoiceNumber,
                Type: 'ACCPAY',
                Status: 'AUTHORISED',
                Total: inv.LineItems.reduce((acc: number, l: any) => acc + l.LineAmount, 0),
                CurrencyCode: inv.CurrencyCode,
                DueDate: inv.DueDate,
                Contact: inv.Contact,
              },
            ],
          }),
        };
      }

      if (url.includes('/Payments') && init?.method === 'POST') {
        createdPaymentPayload = JSON.parse(String(init.body));
        const p = createdPaymentPayload.Payments[0];
        return {
          ok: true,
          status: 200,
          json: async () => ({
            Payments: [
              {
                PaymentID: 'pay-xero-777',
                Amount: p.Amount,
                Date: p.Date,
                Status: 'AUTHORISED',
                Reference: p.Reference,
              },
            ],
          }),
        };
      }

      return { ok: false, status: 404, text: async () => 'Not Found' };
    });

    const connector = new XeroConnector({
      tenantId: 'demo-company-tenant-001',
      tokens: { accessToken: 'valid-token', tokenType: 'Bearer' },
      fetchFn: mockFetch as any,
    });

    // 1. Upsert vendor
    const vendor = await connector.upsertVendor({
      name: 'Priya Sharma Consulting',
      email: 'priya@sharma.in',
      currency: 'USD',
      externalReference: 'ctr-priya-01',
      idempotencyKey: 'idemp-v-priya',
    });
    expect(vendor.id).toBe('contact-xero-123');
    expect(vendor.name).toBe('Priya Sharma Consulting');

    // 2. Create bill
    const bill = await connector.createBill({
      vendorId: vendor.id,
      invoiceNumber: 'INV-SHARMA-01',
      issueDate: '2026-10-20',
      dueDate: '2026-11-04',
      currency: 'USD',
      lineItems: [
        {
          description: 'Senior System Architecture Consulting',
          quantity: 1,
          unitPriceMinor: 600_000,
          amountMinor: 600_000,
          accountCode: '400',
        },
      ],
      subtotalMinor: 600_000,
      totalMinor: 600_000,
      idempotencyKey: 'idemp-bill-priya',
    });

    expect(bill.id).toBe('inv-xero-999');
    expect(bill.status).toBe('AUTHORISED');
    expect(createdInvoicePayload.Invoices[0].Type).toBe('ACCPAY');

    // 3. Mark bill paid
    const payment = await connector.markBillPaid({
      billId: bill.id,
      paymentDate: '2026-10-20',
      amountMinor: 600_000,
      currency: 'USD',
      idempotencyKey: 'idemp-pay-priya',
    });

    expect(payment.id).toBe('pay-xero-777');
    expect(payment.amountMinor).toBe(600_000);
    expect(createdPaymentPayload.Payments[0].Account.Code).toBe('090');
  });

  it('handles 429 rate limiting with Retry-After header', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({
        'Retry-After': '45',
        'X-Rate-Limit-Problem': 'Minute',
      }),
      text: async () => 'Rate limit exceeded',
    });

    const connector = new XeroConnector({
      tokens: { accessToken: 'valid-token', tokenType: 'Bearer' },
      fetchFn: mockFetch as any,
    });

    await expect(connector.listVendors()).rejects.toThrow(XeroRateLimitError);
  });
});
