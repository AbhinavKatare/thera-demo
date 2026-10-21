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

export interface XeroConnectorConfig {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  tenantId?: string;
  tokens?: OAuthTokens;
  baseUrl?: string;
  identityUrl?: string;
  fetchFn?: typeof fetch;
}

export const XERO_SCOPES = [
  'openid',
  'profile',
  'email',
  'accounting.transactions',
  'accounting.contacts',
  'accounting.settings',
  'offline_access',
];

export const XERO_API_LIMITS = {
  callsPerMinute: 60,
  callsPerDay: 5000,
  concurrentRequests: 5,
};

export class XeroRateLimitError extends Error {
  constructor(
    public readonly retryAfterSeconds: number = 60,
    public readonly problemType: string = 'Minute',
  ) {
    super(`Xero API rate limit reached (${problemType} limit). Retry after ${retryAfterSeconds}s.`);
    this.name = 'XeroRateLimitError';
    (this as any).statusCode = 429;
  }
}

export class XeroConnector implements AccountingConnector {
  public readonly provider: ConnectorProvider = 'xero';
  private readonly baseUrl: string;
  private readonly identityUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private tenantId: string;
  private tokens?: OAuthTokens;
  private readonly fetch: typeof fetch;

  // Rate limit tracking
  private minuteCallCount = 0;
  private lastMinuteWindow = Date.now();

  constructor(config: XeroConnectorConfig = {}) {
    this.clientId = config.clientId ?? process.env.XERO_CLIENT_ID ?? 'mock-xero-client-id';
    this.clientSecret = config.clientSecret ?? process.env.XERO_CLIENT_SECRET ?? 'mock-xero-client-secret';
    this.redirectUri = config.redirectUri ?? process.env.XERO_REDIRECT_URI ?? 'http://localhost:3000/connectors/xero/callback';
    this.tenantId = config.tenantId ?? process.env.XERO_TENANT_ID ?? 'demo-company-tenant-001';
    this.tokens = config.tokens;
    this.baseUrl = config.baseUrl ?? 'https://api.xero.com/api.xro/2.0';
    this.identityUrl = config.identityUrl ?? 'https://identity.xero.com';
    this.fetch = config.fetchFn ?? globalThis.fetch.bind(globalThis);
  }

  public getTokens(): OAuthTokens | undefined {
    return this.tokens;
  }

  public setTokens(tokens: OAuthTokens): void {
    this.tokens = tokens;
    if (tokens.tenantId) {
      this.tenantId = tokens.tenantId;
    }
  }

  /**
   * Refreshes OAuth2 tokens using the refresh_token grant.
   */
  public async refreshTokens(): Promise<OAuthTokens> {
    if (!this.tokens?.refreshToken) {
      throw new Error('Cannot refresh Xero tokens: No refresh token present.');
    }

    const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.tokens.refreshToken,
    });

    const res = await this.fetch(`${this.identityUrl}/connect/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Xero token refresh failed (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as any;
    const newTokens: OAuthTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type ?? 'Bearer',
      expiresInSeconds: data.expires_in ?? 1800,
      expiresAt: Date.now() + (data.expires_in ?? 1800) * 1000,
      tenantId: this.tenantId,
    };

    this.tokens = newTokens;
    return newTokens;
  }

  /**
   * Authenticated HTTP request to Xero with rate limit detection and token auto-refresh.
   */
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    // 1. Rate limit tracking
    const now = Date.now();
    if (now - this.lastMinuteWindow > 60_000) {
      this.minuteCallCount = 0;
      this.lastMinuteWindow = now;
    }
    this.minuteCallCount++;

    if (this.minuteCallCount > XERO_API_LIMITS.callsPerMinute) {
      const waitSec = Math.ceil((60_000 - (now - this.lastMinuteWindow)) / 1000);
      throw new XeroRateLimitError(waitSec, 'Minute');
    }

    // 2. Auto-refresh if token is near expiration
    if (this.tokens?.expiresAt && now + 60_000 >= this.tokens.expiresAt) {
      await this.refreshTokens();
    }

    const headers = new Headers(options.headers);
    if (this.tokens?.accessToken) {
      headers.set('Authorization', `Bearer ${this.tokens.accessToken}`);
    }
    if (this.tenantId) {
      headers.set('Xero-tenant-id', this.tenantId);
    }
    headers.set('Accept', 'application/json');
    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    const res = await this.fetch(url, { ...options, headers });

    // Handle 429 Rate Limiting
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('Retry-After') ?? '60');
      const problem = res.headers.get('X-Rate-Limit-Problem') ?? 'Minute';
      throw new XeroRateLimitError(retryAfter, problem);
    }

    // Handle 401 Unauthorized -> Refresh once and retry
    if (res.status === 401 && this.tokens?.refreshToken) {
      await this.refreshTokens();
      headers.set('Authorization', `Bearer ${this.tokens.accessToken}`);
      const retryRes = await this.fetch(url, { ...options, headers });
      if (!retryRes.ok) {
        throw new Error(`Xero request failed after token refresh (${retryRes.status}): ${await retryRes.text()}`);
      }
      return (await retryRes.json()) as T;
    }

    if (!res.ok) {
      throw new Error(`Xero API error (${res.status}): ${await res.text()}`);
    }

    return (await res.json()) as T;
  }

  // ---------------------------------------------------------------------------
  // Interface Methods
  // ---------------------------------------------------------------------------

  public async connect(input: ConnectInput): Promise<ConnectResult> {
    if (input.tokens) {
      this.setTokens(input.tokens);
      return {
        connected: true,
        provider: 'xero',
        externalAccountId: this.tenantId,
        tenantName: 'Xero Demo Company (Global)',
        tokens: input.tokens,
      };
    }

    if (!input.code) {
      throw new Error('Authorization code is required to connect to Xero.');
    }

    const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: input.redirectUri ?? this.redirectUri,
    });

    const tokenRes = await this.fetch(`${this.identityUrl}/connect/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!tokenRes.ok) {
      throw new Error(`Xero OAuth code exchange failed (${tokenRes.status}): ${await tokenRes.text()}`);
    }

    const tokenData = (await tokenRes.json()) as any;
    const tokens: OAuthTokens = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenType: tokenData.token_type ?? 'Bearer',
      expiresInSeconds: tokenData.expires_in ?? 1800,
      expiresAt: Date.now() + (tokenData.expires_in ?? 1800) * 1000,
      scope: tokenData.scope,
    };

    // Get authorized tenant connection
    let tenantName = 'Xero Demo Company';
    try {
      const connRes = await this.fetch('https://api.xero.com/connections', {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      if (connRes.ok) {
        const conns = (await connRes.json()) as any[];
        if (conns.length > 0) {
          this.tenantId = conns[0].tenantId;
          tenantName = conns[0].tenantName ?? tenantName;
        }
      }
    } catch {
      // Ignored for offline/mock environments
    }

    tokens.tenantId = this.tenantId;
    this.tokens = tokens;

    return {
      connected: true,
      provider: 'xero',
      externalAccountId: this.tenantId,
      tenantName,
      tokens,
    };
  }

  public async listVendors(filter?: ListVendorsFilter): Promise<VendorListResult> {
    let path = '/Contacts?where=IsSupplier%3D%3Dtrue';
    if (filter?.search) {
      path += `%20AND%20Name.Contains(%22${encodeURIComponent(filter.search)}%22)`;
    }

    const data = await this.request<{ Contacts: any[] }>(path);
    const vendors: VendorRecord[] = (data.Contacts ?? []).map((c) => ({
      id: c.ContactID,
      name: c.Name,
      email: c.EmailAddress || undefined,
      taxId: c.TaxNumber || undefined,
      currency: c.DefaultCurrency || undefined,
      bankDetails: c.BankAccountDetails
        ? {
            accountNumber: c.BankAccountDetails,
          }
        : undefined,
      externalReference: c.AccountNumber || undefined,
      isActive: c.ContactStatus === 'ACTIVE',
      updatedAt: c.UpdatedDateUTC,
    }));

    return {
      vendors,
      hasMore: false,
      totalCount: vendors.length,
    };
  }

  public async upsertVendor(input: UpsertVendorInput): Promise<VendorRecord> {
    const contactPayload: any = {
      Name: input.name,
      EmailAddress: input.email,
      TaxNumber: input.taxId,
      DefaultCurrency: input.currency,
      AccountNumber: input.externalReference,
      IsSupplier: true,
    };

    if (input.id) {
      contactPayload.ContactID = input.id;
    }

    if (input.bankDetails?.accountNumber || input.bankDetails?.iban) {
      contactPayload.BankAccountDetails = input.bankDetails.iban ?? input.bankDetails.accountNumber;
    }

    const data = await this.request<{ Contacts: any[] }>('/Contacts', {
      method: 'POST',
      headers: {
        'Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify({ Contacts: [contactPayload] }),
    });

    const saved = data.Contacts?.[0];
    if (!saved) {
      throw new Error(`Xero vendor upsert failed for '${input.name}': No contact returned.`);
    }

    return {
      id: saved.ContactID,
      name: saved.Name,
      email: saved.EmailAddress || undefined,
      taxId: saved.TaxNumber || undefined,
      currency: saved.DefaultCurrency || input.currency,
      externalReference: saved.AccountNumber || input.externalReference,
      isActive: saved.ContactStatus === 'ACTIVE',
      updatedAt: saved.UpdatedDateUTC,
    };
  }

  public async createBill(input: CreateBillInput): Promise<BillRecord> {
    const xeroLineItems = input.lineItems.map((li) => ({
      Description: li.description,
      Quantity: li.quantity,
      UnitAmount: li.unitPriceMinor / 100,
      LineAmount: li.amountMinor / 100,
      AccountCode: li.accountCode ?? '400', // Default general expense code in Xero Demo Company
    }));

    const invoicePayload = {
      Type: 'ACCPAY', // Accounts Payable (Bill)
      Contact: { ContactID: input.vendorId },
      Date: input.issueDate,
      DueDate: input.dueDate,
      InvoiceNumber: input.invoiceNumber,
      Reference: input.externalReference,
      CurrencyCode: input.currency,
      Status: 'AUTHORISED',
      LineAmountTypes: 'Exclusive',
      LineItems: xeroLineItems,
    };

    const data = await this.request<{ Invoices: any[] }>('/Invoices', {
      method: 'POST',
      headers: {
        'Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify({ Invoices: [invoicePayload] }),
    });

    const saved = data.Invoices?.[0];
    if (!saved) {
      throw new Error(`Xero bill creation failed for invoice '${input.invoiceNumber}': No invoice returned.`);
    }

    return {
      id: saved.InvoiceID,
      billNumber: saved.InvoiceNumber,
      vendorId: saved.Contact?.ContactID ?? input.vendorId,
      status: saved.Status === 'PAID' ? 'PAID' : 'AUTHORISED',
      totalMinor: Math.round(Number(saved.Total ?? input.totalMinor / 100) * 100),
      currency: saved.CurrencyCode ?? input.currency,
      dueDate: saved.DueDate ?? input.dueDate,
      externalReference: input.externalReference,
      createdAt: saved.UpdatedDateUTC,
    };
  }

  public async markBillPaid(input: MarkBillPaidInput): Promise<BillPaymentRecord> {
    const paymentPayload = {
      Invoice: { InvoiceID: input.billId },
      Account: { Code: input.paymentAccountId ?? '090' }, // Default Business Bank Account in Demo Company
      Date: input.paymentDate,
      Amount: input.amountMinor / 100,
      Reference: input.reference ?? `PayPilot Payment`,
    };

    const data = await this.request<{ Payments: any[] }>('/Payments', {
      method: 'POST',
      headers: {
        'Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify({ Payments: [paymentPayload] }),
    });

    const saved = data.Payments?.[0];
    if (!saved) {
      throw new Error(`Xero markBillPaid failed for bill '${input.billId}': No payment returned.`);
    }

    return {
      id: saved.PaymentID,
      billId: input.billId,
      amountMinor: Math.round(Number(saved.Amount) * 100),
      currency: input.currency,
      paymentDate: saved.Date,
      status: saved.Status === 'AUTHORISED' || saved.Status === 'RECONCILED' ? 'RECORDED' : 'RECORDED',
      reference: saved.Reference,
    };
  }

  public async listAccounts(filter?: ListAccountsFilter): Promise<AccountListResult> {
    const data = await this.request<{ Accounts: any[] }>('/Accounts');
    let rawAccounts = data.Accounts ?? [];

    if (filter?.isActive !== undefined) {
      rawAccounts = rawAccounts.filter((a) => (a.Status === 'ACTIVE') === filter.isActive);
    }

    const accounts = rawAccounts.map((a) => {
      let type: 'EXPENSE' | 'BANK' | 'CURRENT_LIABILITY' | 'FIXED_ASSET' | 'CURRENT_ASSET' | 'EQUITY' | 'REVENUE' | 'OTHER' =
        'OTHER';
      if (a.Type === 'EXPENSE' || a.Type === 'OVERHEADS' || a.Type === 'DIRECTCOSTS') type = 'EXPENSE';
      else if (a.Type === 'BANK') type = 'BANK';
      else if (a.Type === 'CURRLIAB') type = 'CURRENT_LIABILITY';
      else if (a.Type === 'REVENUE') type = 'REVENUE';

      return {
        id: a.AccountID,
        code: a.Code,
        name: a.Name,
        type,
        currency: a.CurrencyCode,
        isActive: a.Status === 'ACTIVE',
      };
    });

    return {
      accounts,
      totalCount: accounts.length,
    };
  }

  public async getSyncStatus(externalAccountId: string): Promise<SyncStatusResult> {
    const isConnected = !!this.tokens?.accessToken;
    const remainingMinute = Math.max(0, XERO_API_LIMITS.callsPerMinute - this.minuteCallCount);

    return {
      provider: 'xero',
      status: isConnected ? 'CONNECTED' : 'DISCONNECTED',
      externalAccountId: externalAccountId || this.tenantId,
      tenantName: 'Xero Demo Company (Global)',
      lastSyncedAt: new Date().toISOString(),
      rateLimitRemaining: remainingMinute,
      rateLimitResetAt: new Date(this.lastMinuteWindow + 60_000).toISOString(),
      errors: [],
    };
  }

  public async executePayment(input: ExecutePaymentInput): Promise<PaymentExecutionResult> {
    return {
      paymentDraftId: input.paymentDraftId,
      status: 'submitted',
      externalTransactionId: `xero-txn-${input.idempotencyKey}`,
    };
  }
}
