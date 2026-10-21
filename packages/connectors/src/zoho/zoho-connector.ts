import type { ConnectorProvider } from '@paypilot/core';
import {
  type AccountingConnector,
  type ConnectInput,
  type ConnectResult,
  type ListVendorsFilter,
  type VendorListResult,
  type UpsertVendorInput,
  type VendorRecord,
  type CreateBillInput,
  type BillRecord,
  type MarkBillPaidInput,
  type BillPaymentRecord,
  type ListAccountsFilter,
  type AccountListResult,
  type SyncStatusResult,
  type OAuthTokens,
  type ExecutePaymentInput,
  type PaymentExecutionResult,
} from '../accounting-connector.js';

export type ZohoRegion = 'in' | 'com' | 'eu' | 'com.au' | 'jp' | 'ca';

export interface ZohoConnectorConfig {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  organizationId?: string;
  region?: ZohoRegion;
  tokens?: OAuthTokens;
  fetchFn?: typeof fetch;
}

export function getZohoBaseUrls(region: ZohoRegion = 'in'): { apiBaseUrl: string; authBaseUrl: string } {
  switch (region) {
    case 'in':
      return {
        apiBaseUrl: 'https://www.zohoapis.in/books/v3',
        authBaseUrl: 'https://accounts.zoho.in',
      };
    case 'eu':
      return {
        apiBaseUrl: 'https://www.zohoapis.eu/books/v3',
        authBaseUrl: 'https://accounts.zoho.eu',
      };
    case 'com.au':
      return {
        apiBaseUrl: 'https://www.zohoapis.com.au/books/v3',
        authBaseUrl: 'https://accounts.zoho.com.au',
      };
    case 'jp':
      return {
        apiBaseUrl: 'https://www.zohoapis.jp/books/v3',
        authBaseUrl: 'https://accounts.zoho.jp',
      };
    case 'ca':
      return {
        apiBaseUrl: 'https://www.zohoapis.ca/books/v3',
        authBaseUrl: 'https://accounts.zoho.ca',
      };
    case 'com':
    default:
      return {
        apiBaseUrl: 'https://www.zohoapis.com/books/v3',
        authBaseUrl: 'https://accounts.zoho.com',
      };
  }
}

export class ZohoBooksConnector implements AccountingConnector {
  public readonly provider: ConnectorProvider = 'zoho';
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private organizationId: string;
  private region: ZohoRegion;
  private tokens?: OAuthTokens;
  private readonly fetch: typeof fetch;

  constructor(config: ZohoConnectorConfig = {}) {
    this.clientId = config.clientId ?? process.env.ZOHO_CLIENT_ID ?? 'mock-zoho-client-id';
    this.clientSecret = config.clientSecret ?? process.env.ZOHO_CLIENT_SECRET ?? 'mock-zoho-client-secret';
    this.redirectUri = config.redirectUri ?? 'http://localhost:3000/connectors/zoho/callback';
    this.organizationId = config.organizationId ?? process.env.ZOHO_ORGANIZATION_ID ?? 'zoho-org-in-001';
    this.region = config.region ?? (process.env.ZOHO_REGION as ZohoRegion) ?? 'in';
    this.tokens = config.tokens;
    this.fetch = config.fetchFn ?? globalThis.fetch.bind(globalThis);
  }

  public getRegion(): ZohoRegion {
    return this.region;
  }

  public setRegion(region: ZohoRegion): void {
    this.region = region;
  }

  public getTokens(): OAuthTokens | undefined {
    return this.tokens;
  }

  public setTokens(tokens: OAuthTokens): void {
    this.tokens = tokens;
    if (tokens.tenantId) {
      this.organizationId = tokens.tenantId;
    }
  }

  private get urls() {
    return getZohoBaseUrls(this.region);
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers);
    if (this.tokens?.accessToken) {
      headers.set('Authorization', `Zoho-oauthtoken ${this.tokens.accessToken}`);
    }
    headers.set('X-com-zoho-books-organizationid', this.organizationId);
    headers.set('Accept', 'application/json');

    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    // Append organization_id query parameter
    const sep = path.includes('?') ? '&' : '?';
    const finalUrl = `${this.urls.apiBaseUrl}${path}${sep}organization_id=${encodeURIComponent(this.organizationId)}`;

    const res = await this.fetch(finalUrl, { ...options, headers });

    if (!res.ok) {
      throw new Error(`Zoho Books API error (${res.status}): ${await res.text()}`);
    }

    const json = (await res.json()) as any;
    if (json.code !== undefined && json.code !== 0) {
      throw new Error(`Zoho Books error [${json.code}]: ${json.message}`);
    }

    return json as T;
  }

  // ---------------------------------------------------------------------------
  // Interface Methods
  // ---------------------------------------------------------------------------

  public async connect(input: ConnectInput): Promise<ConnectResult> {
    if (input.tokens) {
      this.setTokens(input.tokens);
      return {
        connected: true,
        provider: 'zoho',
        externalAccountId: this.organizationId,
        tenantName: `Zoho Books (${this.region.toUpperCase()})`,
        tokens: input.tokens,
      };
    }

    if (!input.code) {
      throw new Error('Authorization code is required to connect to Zoho Books.');
    }

    const tokenUrl = `${this.urls.authBaseUrl}/oauth/v2/token`;
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: input.redirectUri ?? this.redirectUri,
      code: input.code,
    });

    const res = await this.fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!res.ok) {
      throw new Error(`Zoho Books token exchange failed (${res.status}): ${await res.text()}`);
    }

    const data = (await res.json()) as any;
    const tokens: OAuthTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: 'Bearer',
      expiresInSeconds: data.expires_in ?? 3600,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
      tenantId: this.organizationId,
      rawPayload: { region: this.region },
    };

    this.tokens = tokens;

    return {
      connected: true,
      provider: 'zoho',
      externalAccountId: this.organizationId,
      tenantName: `Zoho Books (${this.region.toUpperCase()})`,
      tokens,
    };
  }

  public async listVendors(filter?: ListVendorsFilter): Promise<VendorListResult> {
    let path = '/contacts?contact_type=vendor';
    if (filter?.search) {
      path += `&search_text=${encodeURIComponent(filter.search)}`;
    }

    const data = await this.request<{ contacts: any[]; page_context?: any }>(path);
    const vendors: VendorRecord[] = (data.contacts ?? []).map((c) => ({
      id: String(c.contact_id),
      name: c.contact_name,
      email: c.email || undefined,
      taxId: c.pan_no || c.gst_no || undefined,
      currency: c.currency_code || undefined,
      externalReference: c.notes?.replace('PayPilot Ref: ', '') || undefined,
      isActive: c.status === 'active',
    }));

    return {
      vendors,
      hasMore: data.page_context?.has_more_page ?? false,
      totalCount: vendors.length,
    };
  }

  public async upsertVendor(input: UpsertVendorInput): Promise<VendorRecord> {
    const contactPayload: any = {
      contact_name: input.name,
      company_name: input.name,
      contact_type: 'vendor',
      email: input.email,
      currency_code: input.currency,
      pan_no: input.taxId,
      notes: `PayPilot Ref: ${input.externalReference}`,
    };

    let data: { contact: any };

    if (input.id) {
      data = await this.request<{ contact: any }>(`/contacts/${input.id}`, {
        method: 'PUT',
        body: JSON.stringify(contactPayload),
      });
    } else {
      data = await this.request<{ contact: any }>('/contacts', {
        method: 'POST',
        body: JSON.stringify(contactPayload),
      });
    }

    const c = data.contact;
    return {
      id: String(c.contact_id),
      name: c.contact_name,
      email: c.email || undefined,
      taxId: c.pan_no || c.gst_no || input.taxId,
      currency: c.currency_code || input.currency,
      externalReference: input.externalReference,
      isActive: c.status === 'active',
    };
  }

  public async createBill(input: CreateBillInput): Promise<BillRecord> {
    const billPayload = {
      vendor_id: input.vendorId,
      bill_number: input.invoiceNumber,
      date: input.issueDate,
      due_date: input.dueDate,
      currency_code: input.currency,
      reference_number: input.externalReference,
      line_items: input.lineItems.map((li) => ({
        description: li.description,
        rate: li.unitPriceMinor / 100,
        quantity: li.quantity,
      })),
      notes: input.notes,
    };

    const data = await this.request<{ bill: any }>('/bills', {
      method: 'POST',
      body: JSON.stringify(billPayload),
    });

    const b = data.bill;
    return {
      id: String(b.bill_id),
      billNumber: b.bill_number,
      vendorId: String(b.vendor_id),
      status: b.status === 'paid' ? 'PAID' : 'AUTHORISED',
      totalMinor: Math.round(Number(b.total) * 100),
      currency: b.currency_code ?? input.currency,
      dueDate: b.due_date,
      externalReference: input.externalReference,
      createdAt: b.created_time,
    };
  }

  public async markBillPaid(input: MarkBillPaidInput): Promise<BillPaymentRecord> {
    // 1. Fetch bill to retrieve vendor_id
    const billData = await this.request<{ bill: any }>(`/bills/${input.billId}`);
    const vendorId = billData.bill.vendor_id;

    const paymentPayload = {
      vendor_id: vendorId,
      payment_mode: 'Bank Transfer',
      amount: input.amountMinor / 100,
      date: input.paymentDate,
      reference_number: input.reference ?? `PayPilot Bill Payment`,
      bills: [
        {
          bill_id: input.billId,
          amount_applied: input.amountMinor / 100,
        },
      ],
    };

    const data = await this.request<{ vendorpayment: any }>('/vendorpayments', {
      method: 'POST',
      body: JSON.stringify(paymentPayload),
    });

    const vp = data.vendorpayment;
    return {
      id: String(vp.payment_id),
      billId: input.billId,
      amountMinor: Math.round(Number(vp.amount) * 100),
      currency: input.currency,
      paymentDate: vp.date,
      status: 'RECORDED',
      reference: vp.reference_number,
    };
  }

  public async listAccounts(filter?: ListAccountsFilter): Promise<AccountListResult> {
    const data = await this.request<{ chartofaccounts: any[] }>('/chartofaccounts');
    const accounts = (data.chartofaccounts ?? []).map((a) => {
      let type: 'EXPENSE' | 'BANK' | 'CURRENT_LIABILITY' | 'FIXED_ASSET' | 'CURRENT_ASSET' | 'EQUITY' | 'REVENUE' | 'OTHER' =
        'OTHER';
      if (a.account_type === 'expense' || a.account_type === 'cost_of_goods_sold') type = 'EXPENSE';
      else if (a.account_type === 'bank') type = 'BANK';
      else if (a.account_type === 'other_current_liability') type = 'CURRENT_LIABILITY';
      else if (a.account_type === 'income') type = 'REVENUE';

      return {
        id: String(a.account_id),
        code: a.account_code || String(a.account_id),
        name: a.account_name,
        type,
        currency: a.currency_code,
        isActive: a.status === 'active',
      };
    });

    return {
      accounts,
      totalCount: accounts.length,
    };
  }

  public async getSyncStatus(externalAccountId: string): Promise<SyncStatusResult> {
    const isConnected = !!this.tokens?.accessToken;
    return {
      provider: 'zoho',
      status: isConnected ? 'CONNECTED' : 'DISCONNECTED',
      externalAccountId: externalAccountId || this.organizationId,
      tenantName: `Zoho Books (${this.region.toUpperCase()})`,
      lastSyncedAt: new Date().toISOString(),
      rateLimitRemaining: 100,
      errors: [],
    };
  }

  public async executePayment(input: ExecutePaymentInput): Promise<PaymentExecutionResult> {
    return {
      paymentDraftId: input.paymentDraftId,
      status: 'submitted',
      externalTransactionId: `zoho-txn-${input.idempotencyKey}`,
    };
  }
}
