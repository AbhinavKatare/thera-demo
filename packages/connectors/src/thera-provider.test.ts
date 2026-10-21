import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { TheraProvider, TheraTimeoutError } from './thera-provider.js';
import { CircuitBreakerOpenError } from './circuit-breaker.js';
import { buildMockTheraApp } from '../../../apps/mock-thera/src/app.js';

describe('TheraProvider Contract Tests against Mock Thera Server', () => {
  let mockServer: FastifyInstance;
  let serverUrl: string;
  const testToken = 'test-thera-auth-token';

  beforeAll(async () => {
    mockServer = buildMockTheraApp({
      token: testToken,
      defaultLatencyMs: 0,
      failureRate: 0,
    });
    // Listen on random port (0)
    const address = await mockServer.listen({ port: 0, host: '127.0.0.1' });
    serverUrl = address;
  });

  afterAll(async () => {
    await mockServer.close();
  });

  function createProvider(overrides?: Partial<ConstructorParameters<typeof TheraProvider>[0]>) {
    return new TheraProvider({
      baseUrl: serverUrl,
      token: testToken,
      timeoutMs: 3000,
      maxRetries: 3,
      initialBackoffMs: 20,
      backoffFactor: 2,
      circuitBreakerOptions: {
        failureThreshold: 3,
        resetTimeoutMs: 300,
      },
      ...overrides,
    });
  }

  describe('Contract: Core PayrollProvider Methods', () => {
    it('listContractors returns seeded contractors with valid schemas', async () => {
      const provider = createProvider();
      const result = await provider.listContractors();

      expect(result.contractors.length).toBeGreaterThanOrEqual(8);
      expect(result.total).toBeGreaterThanOrEqual(8);

      const elena = result.contractors.find((c) => c.name === 'Elena Vance');
      expect(elena).toBeDefined();
      expect(elena?.countryCode).toBe('US');
      expect(elena?.currency).toBe('USD');
      expect(elena?.hourlyRateMinor).toBe(12500);
      expect(elena?.status).toBe('active');
    });

    it('getPayrollRun returns detailed breakdown for a period date', async () => {
      const provider = createProvider();
      const run = await provider.getPayrollRun('2025-08-15');

      expect(run.id).toBe('run-2025-08');
      expect(run.status).toBe('approved');
      expect(run.currency).toBe('USD');
      expect(run.totalGrossMinor).toBe(2450000);
      expect(run.totalTaxMinor).toBe(120000);
      expect(run.totalNetMinor).toBe(2330000);
      expect(run.items).toHaveLength(2);
      expect(run.items[0]?.contractorName).toBe('Elena Vance');
    });

    it('listUpcomingRuns returns scheduled future payroll cycles', async () => {
      const provider = createProvider();
      const result = await provider.listUpcomingRuns();

      expect(result.runs.length).toBeGreaterThanOrEqual(2);
      expect(result.runs[0]?.status).toBe('draft');
      expect(result.runs[0]?.payDate).toBeDefined();
    });

    it('createPaymentDraft creates a draft and supports idempotency replay', async () => {
      const provider = createProvider();
      const idemKey = `idem-${Date.now()}-test-draft`;

      const draft = await provider.createPaymentDraft({
        source: 'invoice',
        sourceId: 'inv-12345',
        contractorId: '11111111-0000-0000-0000-000000000001',
        amountMinor: 50000,
        currency: 'USD',
        idempotencyKey: idemKey,
      });

      expect(draft.id).toBeDefined();
      expect(draft.amountMinor).toBe(50000);
      expect(draft.status).toBe('awaiting_approval');
      expect(draft.idempotencyKey).toBe(idemKey);

      // Replay with exact same idempotency key must return same draft id
      const replayed = await provider.createPaymentDraft({
        source: 'invoice',
        sourceId: 'inv-12345',
        contractorId: '11111111-0000-0000-0000-000000000001',
        amountMinor: 50000,
        currency: 'USD',
        idempotencyKey: idemKey,
      });

      expect(replayed.id).toBe(draft.id);
    });

    it('approvePayment approves draft and getPaymentStatus tracks execution', async () => {
      const provider = createProvider();
      const draft = await provider.createPaymentDraft({
        source: 'manual',
        sourceId: 'manual-ref-999',
        contractorId: '11111111-0000-0000-0000-000000000002',
        amountMinor: 95000,
        currency: 'GBP',
        idempotencyKey: `idem-approve-${Date.now()}`,
      });

      // Approve the draft
      const approval = await provider.approvePayment({
        paymentDraftId: draft.id,
        approverId: 'finance-lead-user',
        idempotencyKey: `idem-approval-${draft.id}`,
        decisionNote: 'Authorized for payment cycle',
      });

      expect(approval.paymentDraftId).toBe(draft.id);
      expect(approval.status).toBe('executed');
      expect(approval.approverId).toBe('finance-lead-user');
      expect(approval.externalTransactionId).toMatch(/^thera-txn-/);

      // Query status
      const status = await provider.getPaymentStatus(draft.id);
      expect(status.paymentDraftId).toBe(draft.id);
      expect(status.status).toBe('executed');
      expect(status.amountMinor).toBe(95000);
      expect(status.currency).toBe('GBP');
      expect(status.externalTransactionId).toBe(approval.externalTransactionId);
    });
  });

  describe('Resilience: Retries with Exponential Backoff', () => {
    it('retries on transient 503 failure and succeeds on retry', async () => {
      const provider = createProvider({ maxRetries: 3, initialBackoffMs: 25 });
      const failKey = `fail-once-${Date.now()}`;

      // Sends request with x-mock-fail-once header: first attempt fails 503, retry succeeds
      const result = await provider.request<{ contractors: any[] }>('/v1/contractors', {
        headers: { 'x-mock-fail-once': failKey },
      });

      expect(result.contractors.length).toBeGreaterThan(0);
    });
  });

  describe('Resilience: Circuit Breaker', () => {
    it('trips to OPEN after consecutive failures and fails fast', async () => {
      const provider = createProvider({
        maxRetries: 0,
        circuitBreakerOptions: {
          failureThreshold: 2,
          resetTimeoutMs: 250,
        },
      });

      // 1st failure
      await expect(
        provider.request('/v1/contractors', { headers: { 'x-mock-fail': 'true' } }),
      ).rejects.toThrow();

      // 2nd failure -> trips circuit breaker
      await expect(
        provider.request('/v1/contractors', { headers: { 'x-mock-fail': 'true' } }),
      ).rejects.toThrow();

      expect(provider.circuitBreaker.getState()).toBe('OPEN');

      // 3rd attempt: fails immediately without hitting network
      await expect(provider.request('/v1/contractors')).rejects.toThrowError(CircuitBreakerOpenError);

      // Wait for cooldown window
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(provider.circuitBreaker.getState()).toBe('HALF_OPEN');

      // Probe request succeeds and resets circuit to CLOSED
      const recovered = await provider.listContractors();
      expect(recovered.contractors.length).toBeGreaterThan(0);
      expect(provider.circuitBreaker.getState()).toBe('CLOSED');
    });
  });

  describe('Resilience: Timeouts', () => {
    it('throws TheraTimeoutError when response exceeds timeout threshold', async () => {
      const provider = createProvider({ timeoutMs: 80, maxRetries: 0 });

      // Simulate 200ms latency on server
      await expect(
        provider.request('/v1/contractors', {
          headers: { 'x-mock-latency-ms': '250' },
        }),
      ).rejects.toThrowError(TheraTimeoutError);
    });
  });
});
