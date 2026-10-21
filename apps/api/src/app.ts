import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import fastify, { FastifyBaseLogger, FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { PrismaClient } from '@prisma/client';
import { HttpError } from './errors.js';
import { DatabaseAdapter } from './db.js';
import { healthRoute } from './routes/health.js';
import { contractorsRoutes } from './routes/v1/contractors.route.js';
import { invoicesRoutes } from './routes/v1/invoices.route.js';
import { paymentDraftsRoutes } from './routes/v1/payment-drafts.route.js';
import { payrollRunsRoutes } from './routes/v1/payroll-runs.route.js';
import { approvalsRoutes } from './routes/v1/approvals.route.js';
import { anomaliesRoutes } from './routes/v1/anomalies.route.js';
import { aiRoutes } from './routes/v1/ai.route.js';
import { inboundDocumentsRoutes } from './routes/v1/inbound-documents.route.js';
import { authRoutes } from './routes/auth.route.js';
import { adminJobsRoutes } from './routes/admin-jobs.route.js';
import { ApprovalWorkflowService } from './services/approval-workflow.service.js';
import { AuthService } from './auth/auth.service.js';
import { JobManager } from './jobs/job-manager.js';
import { FileStore } from './storage/file-store.js';
import { securityPlugin } from './security/security-plugin.js';

export interface BuildAppOptions {
  logger?: FastifyBaseLogger;
  db: DatabaseAdapter;
  prisma?: PrismaClient;
  approvalService?: ApprovalWorkflowService;
  authService?: AuthService;
  jobManager?: JobManager;
  fileStore?: FileStore;
}

/** Stable shape returned for every failure. */
export interface ErrorResponse {
  error: string;
  requestId: string;
  details?: unknown;
}

const VALID_REQUEST_ID = /^[a-zA-Z0-9-]{1,128}$/;

interface HasHeaders {
  headers: Record<string, unknown>;
}

function makeRequestId(req: HasHeaders): string {
  const incoming = req.headers['x-request-id'];
  if (typeof incoming === 'string' && VALID_REQUEST_ID.test(incoming)) {
    return incoming;
  }
  return randomUUID();
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = fastify({
    loggerInstance: options.logger,
    genReqId: (req) => makeRequestId(req as unknown as HasHeaders),
    trustProxy: true,
    bodyLimit: 10 * 1024 * 1024, // 10MB input limit
  });

  await app.register(cors, { origin: true });
  await app.register(securityPlugin);

  // OpenAPI spec and documentation UI served at /docs
  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'PayPilot Core API',
        description:
          'REST API for contractors, invoices, payment drafts, payroll runs, human approvals, and anomaly detection.',
        version: '1.0.0',
      },
      servers: [{ url: 'http://localhost:4000', description: 'Local Development Server' }],
      tags: [
        { name: 'Contractors', description: 'Contractor management' },
        { name: 'Invoices', description: 'Contractor invoices & line items' },
        { name: 'Payment Drafts', description: 'Payment drafts gating real money movement' },
        { name: 'Payroll Runs', description: 'Periodic payroll cycles' },
        { name: 'Approvals', description: 'Human approval state machine' },
        { name: 'Anomalies', description: 'AI & rule-based anomaly detection' },
        { name: 'Authentication', description: 'Magic link login and Slack user mapping' },
        { name: 'Admin Jobs', description: 'Background job queues and dead-letter queue' },
      ],
    },
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  // Echo the request id on every response for traceability
  app.addHook('onRequest', async (req, reply) => {
    reply.header('x-request-id', req.id);
  });

  // Central error handler
  app.setErrorHandler((err: unknown, req, reply) => {
    let statusCode = 500;
    let message = 'internal_error';
    let details: unknown = undefined;

    if (err instanceof HttpError) {
      statusCode = err.statusCode;
      message = err.message;
      details = err.details;
    } else if (err instanceof ZodError) {
      statusCode = 400;
      message = 'validation_failed';
      details = err.issues;
    }

    if (statusCode >= 500) {
      req.log.error({ err, requestId: req.id }, 'unhandled error');
      const body: ErrorResponse = { error: 'internal_error', requestId: req.id };
      void reply.status(500).send(body);
      return;
    }

    req.log.info({ requestId: req.id, statusCode }, 'request failed with 4xx');
    const body: ErrorResponse = { error: message, requestId: req.id, details };
    void reply.status(statusCode).send(body);
  });

  app.setNotFoundHandler((req, reply) => {
    req.log.info({ requestId: req.id, method: req.method, url: req.url }, 'route not found');
    const body: ErrorResponse = {
      error: `route ${req.method}:${req.url} not found`,
      requestId: req.id,
    };
    void reply.status(404).send(body);
  });

  // Decorate adapters and services
  app.decorate('db', options.db);
  app.decorate('prisma', options.prisma ?? null);

  const approvalService =
    options.approvalService ??
    new ApprovalWorkflowService((options.prisma as any) ?? createMockApprovalClient());

  const authService =
    options.authService ??
    new AuthService((options.prisma as any) ?? createMockAuthClient());

  const jobManager =
    options.jobManager ??
    new JobManager((options.prisma as any) ?? createMockJobClient(), { useMemoryFallback: true });

  app.decorate('approvalService', approvalService);
  app.decorate('authService', authService);
  app.decorate('jobManager', jobManager);
  app.decorate('fileStore', options.fileStore);

  // Register all routes
  await app.register(healthRoute);
  await app.register(authRoutes, { authService });
  await app.register(adminJobsRoutes, { jobManager });
  await app.register(contractorsRoutes);
  await app.register(invoicesRoutes);
  await app.register(paymentDraftsRoutes);
  await app.register(payrollRunsRoutes);
  await app.register(approvalsRoutes, { approvalService });
  await app.register(anomaliesRoutes);
  await app.register(aiRoutes);
  await app.register(inboundDocumentsRoutes);

  return app;
}

// ---------------------------------------------------------------------------
// In-Memory Fallbacks for Testing Without Live Database
// ---------------------------------------------------------------------------

function createMockApprovalClient() {
  const store = new Map<string, any>();
  return {
    approval: {
      findUnique: async ({ where }: any) => {
        if (where.id) return store.get(where.id) ?? null;
        if (where.idempotencyKey) {
          return Array.from(store.values()).find((a) => a.idempotencyKey === where.idempotencyKey) ?? null;
        }
        return null;
      },
      findFirst: async ({ where }: any) => {
        return store.get(where.id) ?? null;
      },
      findMany: async () => Array.from(store.values()),
      create: async ({ data }: any) => {
        const id = data.id ?? `appr-${randomUUID().slice(0, 8)}`;
        const record = { id, createdAt: new Date(), updatedAt: new Date(), ...data };
        store.set(id, record);
        return record;
      },
      update: async ({ where, data }: any) => {
        const existing = store.get(where.id);
        const updated = { ...existing, ...data, updatedAt: new Date() };
        store.set(where.id, updated);
        return updated;
      },
    },
    auditLog: {
      create: async ({ data }: any) => ({ id: randomUUID(), ...data }),
    },
  } as any;
}

function createMockAuthClient() {
  const tokens = new Map<string, any>();
  const users = new Map<string, any>();
  const slackMappings = new Map<string, any>();

  return {
    magicLinkToken: {
      create: async ({ data }: any) => {
        const id = randomUUID();
        const rec = { id, ...data };
        tokens.set(data.token, rec);
        return rec;
      },
      findUnique: async ({ where }: any) => tokens.get(where.token) ?? null,
      update: async ({ where, data }: any) => {
        const entry = Array.from(tokens.values()).find((t) => t.id === where.id);
        if (entry) Object.assign(entry, data);
        return entry;
      },
    },
    user: {
      findUnique: async ({ where }: any) => {
        if (where.email) {
          return Array.from(users.values()).find((u) => u.email === where.email) ?? null;
        }
        return users.get(where.id) ?? null;
      },
      create: async ({ data }: any) => {
        const id = randomUUID();
        const rec = { id, ...data };
        users.set(id, rec);
        return rec;
      },
    },
    slackUserMapping: {
      upsert: async ({ where, create, update }: any) => {
        const existing = slackMappings.get(where.slackUserId);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const id = randomUUID();
        const rec = { id, ...create };
        slackMappings.set(create.slackUserId, rec);
        return rec;
      },
      findUnique: async ({ where }: any) => {
        const mapping = slackMappings.get(where.slackUserId);
        if (!mapping) return null;
        const user = users.get(mapping.userId) ?? null;
        return { ...mapping, user };
      },
    },
  } as any;
}

function createMockJobClient() {
  const deadLetters: any[] = [];
  return {
    deadLetterJob: {
      create: async ({ data }: any) => {
        const rec = { id: randomUUID(), ...data };
        deadLetters.push(rec);
        return rec;
      },
      findMany: async () => deadLetters,
    },
    auditLog: {
      create: async ({ data }: any) => ({ id: randomUUID(), ...data }),
    },
  } as any;
}

// Module augmentation
declare module 'fastify' {
  interface FastifyInstance {
    db: DatabaseAdapter;
    prisma?: PrismaClient | null;
    approvalService: ApprovalWorkflowService;
    authService: AuthService;
    jobManager: JobManager;
    fileStore?: FileStore;
  }
}
