import { describe, expect, it, vi } from 'vitest';
import { ZohoBooksConnector, getZohoBaseUrls } from './zoho-connector.js';

describe('ZohoBooksConnector', () => {
  it('correctly maps region-aware base URLs for India, US, EU, Australia, and Japan', () => {
    const inUrls = getZohoBaseUrls('in');
    expect(inUrls.apiBaseUrl).toBe('https://www.zohoapis.in/books/v3');
    expect(inUrls.authBaseUrl).toBe('https://accounts.zoho.in');

    const comUrls = getZohoBaseUrls('com');
    expect(comUrls.apiBaseUrl).toBe('https://www.zohoapis.com/books/v3');
    expect(comUrls.authBaseUrl).toBe('https://accounts.zoho.com');

    const euUrls = getZohoBaseUrls('eu');
    expect(euUrls.apiBaseUrl).toBe('https://www.zohoapis.eu/books/v3');
    expect(euUrls.authBaseUrl).toBe('https://accounts.zoho.eu');

    const auUrls = getZohoBaseUrls('com.au');
    expect(auUrls.apiBaseUrl).toBe('https://www.zohoapis.com.au/books/v3');
    expect(auUrls.authBaseUrl).toBe('https://accounts.zoho.com.au');

    const jpUrls = getZohoBaseUrls('jp');
    expect(jpUrls.apiBaseUrl).toBe('https://www.zohoapis.jp/books/v3');
    expect(jpUrls.authBaseUrl).toBe('https://accounts.zoho.jp');
  });

  it('exchanges OAuth2 code using region auth endpoint and connects', async () => {
    let capturedUrl = '';
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      capturedUrl = url;
      if (url.includes('/oauth/v2/token')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'mock-zoho-in-access-token',
            refresh_token: 'mock-zoho-in-refresh-token',
            expires_in: 3600,
            api_domain: 'https://www.zohoapis.in',
          }),
        };
      }
      return { ok: false, status: 404, text: async () => 'Not Found' };
    });

    const connector = new ZohoBooksConnector({
      region: 'in',
      organizationId: 'org-in-98765',
      fetchFn: mockFetch as any,
    });

    const conn = await connector.connect({
      code: 'zoho-code-123',
      redirectUri: 'http://localhost:3000/callback',
    });

    expect(capturedUrl).toContain('https://accounts.zoho.in/oauth/v2/token');
    expect(conn.connected).toBe(true);
    expect(conn.provider).toBe('zoho');
    expect(conn.externalAccountId).toBe('org-in-98765');
    expect(conn.tokens.accessToken).toBe('mock-zoho-in-access-token');
  });

  it('syncs vendors, creates bills, and records payments with organization headers', async () => {
    let capturedHeaders: any = null;
    let createdBillBody: any = null;
    let createdPaymentBody: any = null;

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      capturedHeaders = new Headers(init?.headers);

      if (url.includes('/contacts') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            code: 0,
            message: 'success',
            contact: {
              contact_id: 'zoho-ctr-555',
              contact_name: body.contact_name,
              email: body.email,
              pan_no: body.pan_no,
              currency_code: body.currency_code,
              status: 'active',
            },
          }),
        };
      }

      if (url.includes('/bills') && init?.method === 'POST') {
        createdBillBody = JSON.parse(String(init.body));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            code: 0,
            message: 'success',
            bill: {
              bill_id: 'zoho-bill-888',
              bill_number: createdBillBody.bill_number,
              vendor_id: createdBillBody.vendor_id,
              total: 8700.0,
              currency_code: createdBillBody.currency_code,
              due_date: createdBillBody.due_date,
              status: 'open',
              created_time: '2026-10-20T10:00:00+0530',
            },
          }),
        };
      }

      if (url.includes('/bills/zoho-bill-888')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            code: 0,
            bill: {
              bill_id: 'zoho-bill-888',
              vendor_id: 'zoho-ctr-555',
            },
          }),
        };
      }

      if (url.includes('/vendorpayments') && init?.method === 'POST') {
        createdPaymentBody = JSON.parse(String(init.body));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            code: 0,
            message: 'success',
            vendorpayment: {
              payment_id: 'zoho-vp-111',
              amount: createdPaymentBody.amount,
              date: createdPaymentBody.date,
              reference_number: createdPaymentBody.reference_number,
            },
          }),
        };
      }

      return { ok: false, status: 404, text: async () => 'Not Found' };
    });

    const connector = new ZohoBooksConnector({
      region: 'in',
      organizationId: 'org-in-98765',
      tokens: { accessToken: 'valid-zoho-token', tokenType: 'Bearer' },
      fetchFn: mockFetch as any,
    });

    // 1. Upsert Vendor
    const vendor = await connector.upsertVendor({
      name: 'Arun Patel Engineering',
      email: 'arun@patel.in',
      taxId: 'ABCDE1234F',
      currency: 'INR',
      externalReference: 'ctr-arun-in',
      idempotencyKey: 'idemp-arun-zoho',
    });

    expect(vendor.id).toBe('zoho-ctr-555');
    expect(vendor.name).toBe('Arun Patel Engineering');
    expect(capturedHeaders?.get('X-com-zoho-books-organizationid')).toBe('org-in-98765');
    expect(capturedHeaders?.get('Authorization')).toBe('Zoho-oauthtoken valid-zoho-token');

    // 2. Create Bill
    const bill = await connector.createBill({
      vendorId: vendor.id,
      invoiceNumber: 'INV-ARUN-2026-10',
      issueDate: '2026-10-20',
      dueDate: '2026-11-04',
      currency: 'INR',
      lineItems: [
        {
          description: 'Cloud Infrastructure Sprint',
          quantity: 1,
          unitPriceMinor: 870_000,
          amountMinor: 870_000,
        },
      ],
      subtotalMinor: 870_000,
      totalMinor: 870_000,
      idempotencyKey: 'idemp-bill-arun-zoho',
    });

    expect(bill.id).toBe('zoho-bill-888');
    expect(bill.billNumber).toBe('INV-ARUN-2026-10');
    expect(createdBillBody.vendor_id).toBe('zoho-ctr-555');

    // 3. Mark Bill Paid
    const payment = await connector.markBillPaid({
      billId: bill.id,
      paymentDate: '2026-10-20',
      amountMinor: 870_000,
      currency: 'INR',
      reference: 'UPI-NEFT-9988',
      idempotencyKey: 'idemp-pay-arun-zoho',
    });

    expect(payment.id).toBe('zoho-vp-111');
    expect(payment.amountMinor).toBe(870_000);
    expect(createdPaymentBody.bills[0].bill_id).toBe('zoho-bill-888');
  });
});
