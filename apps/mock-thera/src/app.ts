import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { randomUUID } from 'node:crypto';
import {
  createPaymentDraftInputSchema,
  approvePaymentInputSchema,
} from '@paypilot/connectors';
import {
  MockTheraDataStore,
  getSeededPayrollRunDetail,
  PaymentDraftStoreItem,
} from './data.js';

export interface BuildMockTheraOptions {
  token?: string;
  defaultLatencyMs?: number;
  failureRate?: number; // 0.0 to 1.0
  store?: MockTheraDataStore;
}

export function buildMockTheraApp(options: BuildMockTheraOptions = {}): FastifyInstance {
  const app = fastify({ logger: false });
  const expectedToken = options.token ?? 'mock-thera-secret-token';
  const defaultLatencyMs = options.defaultLatencyMs ?? 0;
  const failureRate = options.failureRate ?? 0;
  const store = options.store ?? new MockTheraDataStore();

  // In-memory set to support deterministic "fail-once" test scenarios
  const failedOnceKeys = new Set<string>();

  void app.register(cors, { origin: true });

  // 1. Latency & Failure Simulation Hook
  app.addHook('onRequest', async (req, reply) => {
    // Check latency
    const customLatency = req.headers['x-mock-latency-ms'];
    const latency = customLatency ? Number(customLatency) : defaultLatencyMs;
    if (latency > 0) {
      await new Promise((resolve) => setTimeout(resolve, latency));
    }

    // Check deterministic fail-once header
    const failOnceKey = req.headers['x-mock-fail-once'] as string | undefined;
    if (failOnceKey) {
      if (!failedOnceKeys.has(failOnceKey)) {
        failedOnceKeys.add(failOnceKey);
        return reply.status(503).send({
          error: 'simulated_transient_failure',
          message: `Deterministic single-failure for key '${failOnceKey}'`,
        });
      }
    }

    // Check force fail header
    if (req.headers['x-mock-fail'] === 'true') {
      const code = Number(req.headers['x-mock-fail-code'] ?? 500);
      return reply.status(code).send({
        error: 'simulated_forced_failure',
        message: 'Request failed due to x-mock-fail header',
      });
    }

    // Check random failure rate
    if (failureRate > 0 && Math.random() < failureRate) {
      return reply.status(500).send({
        error: 'simulated_random_server_error',
        message: 'Random failure triggered by mock-thera failure rate',
      });
    }
  });

  // 2. Bearer Authentication Hook
  app.addHook('preHandler', async (req, reply) => {
    if (req.url === '/health') return;

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'unauthorized', message: 'Missing Bearer token' });
    }

    const token = authHeader.slice(7).trim();
    if (token !== expectedToken) {
      return reply.status(401).send({ error: 'unauthorized', message: 'Invalid token' });
    }
  });

  // -------------------------------------------------------------------------
  // Routes
  // -------------------------------------------------------------------------

  // Health check
  app.get('/health', async () => ({ status: 'healthy', service: 'mock-thera' }));

  // GET /v1/contractors
  app.get('/v1/contractors', async (req) => {
    const query = req.query as { status?: string; limit?: string };
    const statusFilter = query.status ?? 'active';
    const limit = query.limit ? Math.min(Number(query.limit), 100) : 50;

    let list = store.contractors;
    if (statusFilter !== 'all') {
      list = list.filter((c) => c.status === statusFilter);
    }
    const contractors = list.slice(0, limit);

    return {
      contractors,
      total: list.length,
    };
  });

  // GET /v1/payroll-runs/upcoming
  app.get('/v1/payroll-runs/upcoming', async (req) => {
    const query = req.query as { limit?: string };
    const limit = query.limit ? Math.min(Number(query.limit), 20) : 10;
    return {
      runs: store.upcomingRuns.slice(0, limit),
    };
  });

  // GET /v1/payroll-runs?date=YYYY-MM-DD
  app.get('/v1/payroll-runs', async (req, reply) => {
    const query = req.query as { date?: string };
    if (!query.date) {
      return reply.status(400).send({ error: 'bad_request', message: "Missing required 'date' query parameter" });
    }
    return getSeededPayrollRunDetail(query.date);
  });

  // POST /v1/payment-drafts
  app.post('/v1/payment-drafts', async (req, reply) => {
    const parsed = createPaymentDraftInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'validation_failed', issues: parsed.error.issues });
    }

    const input = parsed.data;

    // Idempotency check: if draft with same idempotencyKey already exists, replay it
    const existingDraftId = store.idempotencyMap.get(input.idempotencyKey);
    if (existingDraftId) {
      const existing = store.paymentDrafts.get(existingDraftId);
      if (existing) {
        return reply.status(200).send(existing);
      }
    }

    const draftId = `draft-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    const newDraft: PaymentDraftStoreItem = {
      id: draftId,
      companyId: input.companyId ?? 'c0000000-0000-0000-0000-000000000001',
      source: input.source,
      sourceId: input.sourceId,
      contractorId: input.contractorId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      status: 'awaiting_approval',
      idempotencyKey: input.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    };

    store.paymentDrafts.set(draftId, newDraft);
    store.idempotencyMap.set(input.idempotencyKey, draftId);

    return reply.status(201).send(newDraft);
  });

  // POST /v1/payment-drafts/:id/approve
  app.post('/v1/payment-drafts/:id/approve', async (req, reply) => {
    const params = req.params as { id: string };
    const draft = store.paymentDrafts.get(params.id);
    if (!draft) {
      return reply.status(404).send({ error: 'not_found', message: `Payment draft ${params.id} not found` });
    }

    const parsed = approvePaymentInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'validation_failed', issues: parsed.error.issues });
    }

    const now = new Date().toISOString();
    draft.status = 'executed';
    draft.approverId = parsed.data.approverId;
    draft.approvedAt = now;
    draft.externalTransactionId = `thera-txn-${randomUUID().slice(0, 12)}`;
    draft.updatedAt = now;

    return {
      paymentDraftId: draft.id,
      status: 'executed',
      approvedAt: now,
      approverId: draft.approverId,
      externalTransactionId: draft.externalTransactionId,
    };
  });

  // GET /v1/payment-drafts/:id/status
  app.get('/v1/payment-drafts/:id/status', async (req, reply) => {
    const params = req.params as { id: string };
    const draft = store.paymentDrafts.get(params.id);
    if (!draft) {
      return reply.status(404).send({ error: 'not_found', message: `Payment draft ${params.id} not found` });
    }

    return {
      paymentDraftId: draft.id,
      status: draft.status,
      amountMinor: draft.amountMinor,
      currency: draft.currency,
      externalTransactionId: draft.externalTransactionId,
      failureReason: draft.failureReason,
      updatedAt: draft.updatedAt,
    };
  });

  return app;
}
