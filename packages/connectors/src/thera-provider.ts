import { CircuitBreaker, CircuitBreakerOptions } from './circuit-breaker.js';
import {
  PayrollProvider,
  ListContractorsInput,
  ListContractorsOutput,
  listContractorsOutputSchema,
  PayrollRunDetail,
  payrollRunDetailSchema,
  GetPayrollRunInput,
  ListUpcomingRunsInput,
  ListUpcomingRunsOutput,
  listUpcomingRunsOutputSchema,
  CreatePaymentDraftInput,
  PaymentDraftSummary,
  paymentDraftSummarySchema,
  ApprovePaymentInput,
  ApprovePaymentOutput,
  approvePaymentOutputSchema,
  PaymentStatusOutput,
  paymentStatusOutputSchema,
} from './payroll-provider.js';

export class TheraApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorData: unknown,
    message?: string,
  ) {
    super(message ?? `Thera API request failed with status ${statusCode}`);
    this.name = 'TheraApiError';
  }
}

export class TheraTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Thera API request timed out after ${timeoutMs}ms`);
    this.name = 'TheraTimeoutError';
  }
}

export interface TheraProviderOptions {
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  maxRetries?: number;
  initialBackoffMs?: number;
  backoffFactor?: number;
  circuitBreakerOptions?: CircuitBreakerOptions;
}

export class TheraProvider implements PayrollProvider {
  public readonly name = 'thera';
  public readonly baseUrl: string;
  private readonly token: string;
  public readonly timeoutMs: number;
  public readonly maxRetries: number;
  public readonly initialBackoffMs: number;
  public readonly backoffFactor: number;
  public readonly circuitBreaker: CircuitBreaker;

  constructor(options?: TheraProviderOptions) {
    this.baseUrl = (
      options?.baseUrl ??
      process.env.THERA_BASE_URL ??
      'http://localhost:4100'
    ).replace(/\/+$/, '');

    this.token =
      options?.token ?? process.env.THERA_API_TOKEN ?? 'mock-thera-secret-token';
    this.timeoutMs = options?.timeoutMs ?? 5_000;
    this.maxRetries = options?.maxRetries ?? 3;
    this.initialBackoffMs = options?.initialBackoffMs ?? 100;
    this.backoffFactor = options?.backoffFactor ?? 2;

    this.circuitBreaker = new CircuitBreaker({
      serviceName: 'thera-payroll-api',
      ...options?.circuitBreakerOptions,
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Dispatches an HTTP request with retries, exponential backoff, timeouts, and circuit breaker protection.
   */
  public async request<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: unknown;
      headers?: Record<string, string>;
      timeoutMs?: number;
    } = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const method = options.method ?? 'GET';
    const requestTimeout = options.timeoutMs ?? this.timeoutMs;

    return this.circuitBreaker.execute(async () => {
      let attempt = 0;
      let lastError: Error | null = null;

      while (attempt <= this.maxRetries) {
        attempt += 1;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), requestTimeout);

        try {
          const headers: Record<string, string> = {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...options.headers,
          };

          const response = await fetch(url, {
            method,
            headers,
            body: options.body ? JSON.stringify(options.body) : undefined,
            signal: controller.signal,
          });

          clearTimeout(timer);

          if (!response.ok) {
            let errorBody: unknown = undefined;
            try {
              errorBody = await response.json();
            } catch {
              errorBody = await response.text();
            }

            const isServerError = response.status >= 500;
            const isRateLimit = response.status === 429;

            // Transient errors that should be retried
            if ((isServerError || isRateLimit) && attempt <= this.maxRetries) {
              const backoff = this.initialBackoffMs * Math.pow(this.backoffFactor, attempt - 1);
              await this.sleep(backoff);
              continue;
            }

            throw new TheraApiError(response.status, errorBody);
          }

          const data = (await response.json()) as T;
          return data;
        } catch (err: any) {
          clearTimeout(timer);

          // Handle abort / timeout
          if (err.name === 'AbortError') {
            lastError = new TheraTimeoutError(requestTimeout);
          } else {
            lastError = err;
          }

          // Do not retry client 4xx errors
          if (err instanceof TheraApiError && err.statusCode < 500 && err.statusCode !== 429) {
            throw err;
          }

          if (attempt <= this.maxRetries) {
            const backoff = this.initialBackoffMs * Math.pow(this.backoffFactor, attempt - 1);
            await this.sleep(backoff);
            continue;
          }
        }
      }

      throw lastError ?? new Error(`Request to ${url} failed after ${this.maxRetries} retries`);
    });
  }

  public async listContractors(input?: ListContractorsInput): Promise<ListContractorsOutput> {
    const params = new URLSearchParams();
    if (input?.status) params.set('status', input.status);
    if (input?.limit) params.set('limit', String(input.limit));
    if (input?.cursor) params.set('cursor', input.cursor);
    if (input?.companyId) params.set('companyId', input.companyId);

    const query = params.toString() ? `?${params.toString()}` : '';
    const raw = await this.request<unknown>(`/v1/contractors${query}`);
    return listContractorsOutputSchema.parse(raw);
  }

  public async getPayrollRun(input: string | Date | GetPayrollRunInput): Promise<PayrollRunDetail> {
    let dateStr: string;
    let companyId: string | undefined;

    if (typeof input === 'string') {
      dateStr = input;
    } else if (input instanceof Date) {
      dateStr = input.toISOString().slice(0, 10);
    } else {
      dateStr = input.date instanceof Date ? input.date.toISOString().slice(0, 10) : input.date;
      companyId = input.companyId;
    }

    const params = new URLSearchParams({ date: dateStr });
    if (companyId) params.set('companyId', companyId);

    const raw = await this.request<unknown>(`/v1/payroll-runs?${params.toString()}`);
    return payrollRunDetailSchema.parse(raw);
  }

  public async listUpcomingRuns(input?: ListUpcomingRunsInput): Promise<ListUpcomingRunsOutput> {
    const params = new URLSearchParams();
    if (input?.limit) params.set('limit', String(input.limit));
    if (input?.companyId) params.set('companyId', input.companyId);

    const query = params.toString() ? `?${params.toString()}` : '';
    const raw = await this.request<unknown>(`/v1/payroll-runs/upcoming${query}`);
    return listUpcomingRunsOutputSchema.parse(raw);
  }

  public async createPaymentDraft(input: CreatePaymentDraftInput): Promise<PaymentDraftSummary> {
    const raw = await this.request<unknown>('/v1/payment-drafts', {
      method: 'POST',
      body: input,
      headers: {
        'x-idempotency-key': input.idempotencyKey,
      },
    });
    return paymentDraftSummarySchema.parse(raw);
  }

  public async approvePayment(input: ApprovePaymentInput): Promise<ApprovePaymentOutput> {
    const raw = await this.request<unknown>(`/v1/payment-drafts/${encodeURIComponent(input.paymentDraftId)}/approve`, {
      method: 'POST',
      body: input,
      headers: {
        'x-idempotency-key': input.idempotencyKey,
      },
    });
    return approvePaymentOutputSchema.parse(raw);
  }

  public async getPaymentStatus(paymentDraftId: string): Promise<PaymentStatusOutput> {
    const raw = await this.request<unknown>(
      `/v1/payment-drafts/${encodeURIComponent(paymentDraftId)}/status`,
    );
    return paymentStatusOutputSchema.parse(raw);
  }
}
