export interface ApiError {
  error: string;
  message: string;
  statusCode?: number;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'OWNER' | 'APPROVER' | 'VIEWER';
  companyId: string;
}

export interface InvoiceLineItem {
  id?: string;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  amountMinor: number;
  accountCode?: string;
}

export interface InvoiceItem {
  id: string;
  companyId: string;
  contractorId: string;
  contractId?: string;
  invoiceNumber: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PAID' | 'VOID';
  periodStart: string;
  periodEnd: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  invoiceHash?: string;
  fileId?: string;
  contractor?: {
    id: string;
    name: string;
    email?: string;
    country?: string;
    currency?: string;
  };
  lineItems: InvoiceLineItem[];
  matchConfidence?: number;
  flags?: string[];
  notes?: string;
  createdAt: string;
}

export interface ContractorItem {
  id: string;
  companyId: string;
  name: string;
  email: string;
  country: string;
  currency: string;
  status: 'ACTIVE' | 'INACTIVE';
  totalPaidMinor: number;
  bankDetails?: {
    iban?: string;
    accountNumber?: string;
    routingNumber?: string;
  };
  createdAt: string;
}

export interface AnomalyItem {
  id: string;
  rule: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  summary: string;
  explanation: string;
  suggestedAction?: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface PayrollRunItem {
  id: string;
  companyId: string;
  periodStart: string;
  periodEnd: string;
  status: 'DRAFT' | 'REVIEW' | 'APPROVED' | 'SCHEDULED' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'CANCELLED';
  currency: string;
  grossMinor: number;
  taxMinor: number;
  netMinor: number;
  totalPeople: number;
  itemsCount: number;
  flaggedCount: number;
  anomalies?: AnomalyItem[];
  approvalsRequired?: number;
  approvalsReceived?: number;
  approvers?: string[];
  createdAt: string;
}

export interface ApprovalItem {
  id: string;
  companyId: string;
  targetType: 'INVOICE' | 'PAYMENT_DRAFT' | 'PAYROLL_RUN';
  targetId: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'SENT';
  amountMinor: number;
  currency: string;
  requestedBy: string;
  requiredApproversCount: number;
  approvers: string[];
  decisionNote?: string;
  createdAt: string;
  decidedAt?: string;
}

export interface AuditLogItem {
  id: string;
  companyId: string;
  actorId: string;
  actorType: 'USER' | 'SYSTEM' | 'SERVICE';
  action: string;
  resourceType: string;
  resourceId: string;
  beforeJson?: Record<string, unknown>;
  afterJson?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface IntegrationStatusItem {
  provider: 'xero' | 'zoho' | 'netsuite';
  name: string;
  description: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'SYNCING';
  externalAccountId?: string;
  tenantName?: string;
  lastSyncedAt?: string;
  errors?: string[];
  rateLimitRemaining?: number;
  config: {
    defaultExpenseAccountCode: string;
    defaultBankAccountId?: string;
    defaultTaxRate: number;
    vendorPrefix?: string;
    region?: string;
  };
}

export class PayPilotApiClient {
  private readonly baseUrl: string;
  private token: string | null = null;

  constructor() {
    this.baseUrl =
      typeof window !== 'undefined'
        ? (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000')
        : 'http://localhost:3000';

    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('paypilot_token');
    }
  }

  public setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) localStorage.setItem('paypilot_token', token);
      else localStorage.removeItem('paypilot_token');
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers);
    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || `Request failed with status ${res.status}`);
    }

    return res.json() as Promise<T>;
  }

  // Auth
  public async requestMagicLink(email: string) {
    return this.request<{ success: boolean; token?: string; link?: string }>('/auth/magic-link/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  public async verifyMagicLink(token: string) {
    const data = await this.request<{ accessToken: string; user: UserProfile }>('/auth/magic-link/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
    this.setToken(data.accessToken);
    return data;
  }

  // Invoices
  public async getInvoices(params: { status?: string; limit?: number; cursor?: string } = {}) {
    const q = new URLSearchParams();
    if (params.status && params.status !== 'all') q.set('status', params.status);
    if (params.limit) q.set('limit', String(params.limit));
    if (params.cursor) q.set('cursor', params.cursor);

    return this.request<{ items: InvoiceItem[]; nextCursor?: string | null }>(`/v1/invoices?${q.toString()}`);
  }

  public async getInvoiceById(id: string) {
    return this.request<InvoiceItem>(`/v1/invoices/${id}`);
  }

  public async approveInvoice(id: string, approverId: string, note?: string) {
    return this.request<unknown>(`/v1/approvals/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approverId, idempotencyKey: `appr-inv-${Date.now()}`, decisionNote: note }),
    });
  }

  public async rejectInvoice(id: string, approverId: string, note?: string) {
    return this.request<unknown>(`/v1/approvals/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ approverId, idempotencyKey: `rej-inv-${Date.now()}`, decisionNote: note }),
    });
  }

  // Payroll Runs
  public async getPayrollRuns() {
    return this.request<{ items: PayrollRunItem[] }>('/v1/payroll-runs');
  }

  public async approvePayrollRun(runId: string, approverId: string, approvalId: string) {
    return this.request<unknown>(`/v1/approvals/${approvalId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approverId, idempotencyKey: `appr-run-${Date.now()}` }),
    });
  }

  // Approvals
  public async getApprovals(status?: string) {
    const q = status ? `?status=${status}` : '';
    return this.request<{ items: ApprovalItem[] }>(`/v1/approvals${q}`);
  }

  // Audit Logs
  public async getAuditLogs() {
    return this.request<{ items: AuditLogItem[] }>('/v1/audit-logs');
  }

  // Ask Payroll (AI)
  public async askPayroll(question: string) {
    return this.request<{
      question: string;
      answer: string;
      queryType?: string;
      sources: Array<Record<string, unknown>>;
      isRefusal?: boolean;
    }>('/v1/ai/ask-payroll', {
      method: 'POST',
      body: JSON.stringify({ question }),
    });
  }
}

export const apiClient = new PayPilotApiClient();
