import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { paginationQuerySchema, paginateArray } from '../pagination.js';

export const anomalyFilterSchema = paginationQuerySchema.extend({
  companyId: z.string().uuid().optional(),
  status: z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED', 'all']).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
});

export const createAnomalyBodySchema = z.object({
  companyId: z.string().uuid(),
  entityType: z.string().min(1),
  entityId: z.string().uuid(),
  rule: z.string().min(1),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  detector: z.enum(['RULES', 'AI', 'HUMAN']).default('AI'),
  summary: z.string().min(1),
  details: z.record(z.unknown()).optional(),
});

export const resolveAnomalyBodySchema = z.object({
  resolvedBy: z.string().min(1),
});

export async function anomaliesRoutes(app: FastifyInstance): Promise<void> {
  // GET /v1/anomalies
  app.get(
    '/v1/anomalies',
    {
      schema: {
        description: 'Lists flagged anomalies with cursor pagination and severity/status filters',
        tags: ['Anomalies'],
      },
    },
    async (req, reply) => {
      const parsed = anomalyFilterSchema.safeParse(req.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'validation_failed', issues: parsed.error.issues });
      }

      const { limit, cursor, status, severity, companyId } = parsed.data;

      if (app.prisma) {
        const where: any = { deletedAt: null };
        if (companyId) where.companyId = companyId;
        if (status && status !== 'all') where.status = status;
        if (severity) where.severity = severity;

        const items = await app.prisma.anomaly.findMany({
          where,
          take: limit + 1,
          cursor: cursor ? { id: cursor } : undefined,
          skip: cursor ? 1 : 0,
          orderBy: { createdAt: 'desc' },
        });

        const hasMore = items.length > limit;
        const resultItems = hasMore ? items.slice(0, limit) : items;
        const nextCursor = hasMore ? resultItems[resultItems.length - 1]!.id : null;

        return { items: resultItems, nextCursor, limit };
      }

      return paginateArray([], limit, cursor);
    },
  );

  // GET /v1/anomalies/:id
  app.get(
    '/v1/anomalies/:id',
    {
      schema: {
        description: 'Retrieves an anomaly record by UUID',
        tags: ['Anomalies'],
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      if (!app.prisma) {
        return reply.status(404).send({ error: 'not_found', message: 'Anomaly not found' });
      }

      const anomaly = await app.prisma.anomaly.findFirst({
        where: { id, deletedAt: null },
      });

      if (!anomaly) {
        return reply.status(404).send({ error: 'not_found', message: `Anomaly '${id}' not found` });
      }

      return anomaly;
    },
  );

  // POST /v1/anomalies
  app.post(
    '/v1/anomalies',
    {
      schema: {
        description: 'Flags a new anomaly detected on a payroll item, invoice, or contract',
        tags: ['Anomalies'],
      },
    },
    async (req, reply) => {
      const parsed = createAnomalyBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'validation_failed', issues: parsed.error.issues });
      }

      const data = parsed.data;

      if (!app.prisma) {
        return reply.status(201).send({ id: 'mock-anomaly-id', status: 'OPEN', ...data });
      }

      const created = await app.prisma.anomaly.create({
        data: {
          companyId: data.companyId,
          entityType: data.entityType,
          entityId: data.entityId,
          rule: data.rule,
          severity: data.severity,
          detector: data.detector,
          summary: data.summary,
          details: data.details ? JSON.parse(JSON.stringify(data.details)) : null,
          status: 'OPEN',
        },
      });

      return reply.status(201).send(created);
    },
  );

  // POST /v1/anomalies/:id/resolve
  app.post(
    '/v1/anomalies/:id/resolve',
    {
      schema: {
        description: 'Resolves an open anomaly',
        tags: ['Anomalies'],
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = resolveAnomalyBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'validation_failed', issues: parsed.error.issues });
      }

      if (!app.prisma) {
        return reply.status(200).send({ id, status: 'RESOLVED', resolvedBy: parsed.data.resolvedBy });
      }

      const updated = await app.prisma.anomaly.update({
        where: { id },
        data: {
          status: 'RESOLVED',
          resolvedBy: parsed.data.resolvedBy,
          resolvedAt: new Date(),
        },
      });

      return reply.status(200).send(updated);
    },
  );

  // POST /v1/anomalies/:id/dismiss
  app.post(
    '/v1/anomalies/:id/dismiss',
    {
      schema: {
        description: 'Dismisses a false-positive anomaly',
        tags: ['Anomalies'],
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };

      if (!app.prisma) {
        return reply.status(200).send({ id, status: 'DISMISSED' });
      }

      const updated = await app.prisma.anomaly.update({
        where: { id },
        data: { status: 'DISMISSED' },
      });

      return reply.status(200).send(updated);
    },
  );
}
