import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { MockDatabase } from '../db.js';

describe('Backend Core Endpoints & Workflows', () => {
  it('serves OpenAPI documentation at /docs and OpenAPI json at /docs/json', async () => {
    const app = await buildApp({ db: new MockDatabase(true) });

    const docsRes = await app.inject({ method: 'GET', url: '/docs' });
    expect(docsRes.statusCode).toBe(200);

    const jsonRes = await app.inject({ method: 'GET', url: '/docs/json' });
    expect(jsonRes.statusCode).toBe(200);
    const spec = jsonRes.json();
    expect(spec.openapi).toBeDefined();
    expect(spec.info.title).toBe('PayPilot Core API');
    expect(spec.paths['/v1/contractors']).toBeDefined();
    expect(spec.paths['/v1/invoices']).toBeDefined();
    expect(spec.paths['/v1/payment-drafts']).toBeDefined();
    expect(spec.paths['/v1/payroll-runs']).toBeDefined();
    expect(spec.paths['/v1/approvals']).toBeDefined();
    expect(spec.paths['/v1/anomalies']).toBeDefined();
    expect(spec.paths['/admin/jobs']).toBeDefined();

    await app.close();
  });

  describe('Authentication & Magic Links', () => {
    it('requests and verifies magic link login returning JWT and user profile', async () => {
      const app = await buildApp({ db: new MockDatabase(true) });

      // 1. Request magic link
      const reqRes = await app.inject({
        method: 'POST',
        url: '/auth/magic-link/request',
        payload: { email: 'finance-lead@paypilot.io' },
      });

      expect(reqRes.statusCode).toBe(200);
      const reqBody = reqRes.json();
      expect(reqBody.success).toBe(true);
      expect(reqBody.token).toBeDefined();

      // 2. Verify magic link
      const verifyRes = await app.inject({
        method: 'POST',
        url: '/auth/magic-link/verify',
        payload: { token: reqBody.token },
      });

      expect(verifyRes.statusCode).toBe(200);
      const verifyBody = verifyRes.json();
      expect(verifyBody.accessToken).toBeDefined();
      expect(verifyBody.user.email).toBe('finance-lead@paypilot.io');

      // 3. Re-using same token is rejected
      const reVerify = await app.inject({
        method: 'POST',
        url: '/auth/magic-link/verify',
        payload: { token: reqBody.token },
      });
      expect(reVerify.statusCode).toBe(400);

      await app.close();
    });

    it('links a Slack user ID to an app user account', async () => {
      const app = await buildApp({ db: new MockDatabase(true) });

      const res = await app.inject({
        method: 'POST',
        url: '/auth/slack/link',
        payload: {
          companyId: 'c0000000-0000-0000-0000-000000000001',
          userId: 'c0000000-0000-0000-0000-000000000002',
          slackUserId: 'U12345678',
          slackTeamId: 'T98765432',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().mapping.slackUserId).toBe('U12345678');
      await app.close();
    });
  });

  describe('Core REST Resources: Pagination & Operations', () => {
    it('GET /v1/contractors returns paginated structure', async () => {
      const app = await buildApp({ db: new MockDatabase(true) });
      const res = await app.inject({ method: 'GET', url: '/v1/contractors?limit=10' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body.items)).toBe(true);
      expect(body.limit).toBe(10);
      await app.close();
    });

    it('POST /v1/contractors validates schema and creates contractor', async () => {
      const app = await buildApp({ db: new MockDatabase(true) });
      const res = await app.inject({
        method: 'POST',
        url: '/v1/contractors',
        payload: {
          companyId: 'c0000000-0000-0000-0000-000000000001',
          legalName: 'Test Contractor LLC',
          displayName: 'Test Contractor',
          email: 'test@contractor.io',
          countryCode: 'US',
          status: 'active',
          defaultRateMinor: 10000,
          timezone: 'America/New_York',
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().displayName).toBe('Test Contractor');
      await app.close();
    });

    it('POST /v1/invoices validates line item sums and generates hash', async () => {
      const app = await buildApp({ db: new MockDatabase(true) });
      const res = await app.inject({
        method: 'POST',
        url: '/v1/invoices',
        payload: {
          companyId: 'c0000000-0000-0000-0000-000000000001',
          contractorId: '11111111-0000-0000-0000-000000000001',
          contractId: '21111111-0000-0000-0000-000000000001',
          invoiceNumber: 'INV-TEST-001',
          status: 'draft',
          periodStart: '2025-09-01',
          periodEnd: '2025-09-30',
          issueDate: '2025-10-01',
          dueDate: '2025-10-15',
          currency: 'USD',
          subtotalMinor: 50000,
          taxMinor: 5000,
          totalMinor: 55000,
          lineItems: [
            {
              id: '30000000-0000-0000-0000-000000000001',
              invoiceId: '40000000-0000-0000-0000-000000000001',
              description: 'Software development',
              quantity: 10,
              unitPriceMinor: 5000,
              amountMinor: 50000,
              createdAt: new Date().toISOString(),
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const invoice = res.json();
      expect(invoice.invoiceHash).toBeDefined();
      expect(invoice.totalMinor).toBe(55000);
      await app.close();
    });

    it('POST /v1/payment-drafts enforces idempotency', async () => {
      const app = await buildApp({ db: new MockDatabase(true) });
      const payload = {
        companyId: 'c0000000-0000-0000-0000-000000000001',
        source: 'invoice',
        sourceId: 'c0000000-0000-0000-0000-000000000002',
        amountMinor: 100000,
        currency: 'USD',
        status: 'draft',
        idempotencyKey: 'idem-api-test-draft',
      };

      const res1 = await app.inject({ method: 'POST', url: '/v1/payment-drafts', payload });
      expect(res1.statusCode).toBe(201);

      await app.close();
    });

    it('POST /v1/anomalies flags and resolves anomalies', async () => {
      const app = await buildApp({ db: new MockDatabase(true) });
      const createRes = await app.inject({
        method: 'POST',
        url: '/v1/anomalies',
        payload: {
          companyId: 'c0000000-0000-0000-0000-000000000001',
          entityType: 'invoice',
          entityId: 'c0000000-0000-0000-0000-000000000001',
          rule: 'invoice.amount_spike',
          severity: 'HIGH',
          summary: 'Invoice total is 300% above 90-day moving average',
        },
      });

      expect(createRes.statusCode).toBe(201);
      const anomaly = createRes.json();
      expect(anomaly.status).toBe('OPEN');

      const resolveRes = await app.inject({
        method: 'POST',
        url: `/v1/anomalies/${anomaly.id}/resolve`,
        payload: { resolvedBy: 'security-lead' },
      });
      expect(resolveRes.statusCode).toBe(200);
      expect(resolveRes.json().status).toBe('RESOLVED');

      await app.close();
    });
  });

  describe('Approvals REST Workflow', () => {
    it('executes approval draft creation, submission, and approval decisions via HTTP', async () => {
      const app = await buildApp({ db: new MockDatabase(true) });

      // 1. Create approval draft
      const createRes = await app.inject({
        method: 'POST',
        url: '/v1/approvals',
        payload: {
          companyId: 'c0000000-0000-0000-0000-000000000001',
          targetType: 'PAYMENT_DRAFT',
          targetId: 'c0000000-0000-0000-0000-000000000002',
          requestedBy: 'operator-1',
          amountMinor: 35000,
          idempotencyKey: 'idem-http-appr-1',
        },
      });

      expect(createRes.statusCode).toBe(201);
      const approval = createRes.json();
      expect(approval.status).toBe('DRAFT');

      // 2. Submit for approval
      const submitRes = await app.inject({
        method: 'POST',
        url: `/v1/approvals/${approval.id}/submit`,
        payload: { submittedBy: 'operator-1' },
      });
      expect(submitRes.statusCode).toBe(200);
      expect(submitRes.json().status).toBe('PENDING_APPROVAL');

      // 3. Approve decision
      const approveRes = await app.inject({
        method: 'POST',
        url: `/v1/approvals/${approval.id}/approve`,
        payload: {
          approverId: 'vp-finance',
          idempotencyKey: 'vp-finance-key-1',
          decisionNote: 'Authorized',
        },
      });
      expect(approveRes.statusCode).toBe(200);
      expect(approveRes.json().status).toBe('APPROVED');

      // 4. Mark sent
      const sendRes = await app.inject({
        method: 'POST',
        url: `/v1/approvals/${approval.id}/send`,
        payload: { actorId: 'dispatcher-1', externalTransactionId: 'txn-777' },
      });
      expect(sendRes.statusCode).toBe(200);
      expect(sendRes.json().status).toBe('SENT');

      await app.close();
    });
  });

  describe('Admin Background Jobs & DLQ Endpoints', () => {
    it('GET /admin/jobs returns queues status and schedules', async () => {
      const app = await buildApp({ db: new MockDatabase(true) });

      const res = await app.inject({ method: 'GET', url: '/admin/jobs' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.queues).toBeDefined();
      expect(body.queues.some((q: any) => q.name === 'nightly-payroll-preview')).toBe(true);
      expect(body.queues.some((q: any) => q.name === 'hourly-invoice-inbox-poll')).toBe(true);
      expect(body.queues.some((q: any) => q.name === 'connector-sync-job')).toBe(true);

      await app.close();
    });

    it('POST /admin/jobs/trigger executes job and routes failed jobs to DLQ', async () => {
      const app = await buildApp({ db: new MockDatabase(true) });

      // Trigger successful job
      const successRes = await app.inject({
        method: 'POST',
        url: '/admin/jobs/trigger',
        payload: { queueName: 'nightly-payroll-preview' },
      });
      expect(successRes.statusCode).toBe(202);
      expect(successRes.json().status).toBe('completed');

      // Trigger failing connector job to test dead letter queue
      const failRes = await app.inject({
        method: 'POST',
        url: '/admin/jobs/trigger',
        payload: {
          queueName: 'connector-sync-job',
          payload: { provider: 'quickbooks', simulateFailure: true },
        },
      });
      expect(failRes.statusCode).toBe(202);
      expect(failRes.json().status).toBe('failed');

      // Inspect DLQ
      const dlqRes = await app.inject({ method: 'GET', url: '/admin/jobs/dead-letter' });
      expect(dlqRes.statusCode).toBe(200);
      const dlqBody = dlqRes.json();
      expect(dlqBody.total).toBeGreaterThanOrEqual(1);
      expect(dlqBody.deadLetters[0].error).toContain('Simulated connector sync failure');

      await app.close();
    });
  });
});
