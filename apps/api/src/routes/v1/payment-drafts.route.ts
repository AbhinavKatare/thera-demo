import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CreatePaymentDraftSchema } from '@paypilot/core';
import { paginationQuerySchema, paginateArray } from '../pagination.js';

export const paymentDraftFilterSchema = paginationQuerySchema.extend({
  companyId: z.string().uuid().optional(),
  status: z
    .enum([
      'DRAFT',
      'AWAITING_APPROVAL',
      'APPROVED',
      'REJECTED',
      'SCHEDULED',
      'EXECUTED',
      'VOID',
      'FAILED',
      'all',
    ])
    .optional(),
});

export async function paymentDraftsRoutes(app: FastifyInstance): Promise<void> {
  // GET /v1/payment-drafts
  app.get(
    '/v1/payment-drafts',
    {
      schema: {
        description: 'Lists payment drafts with cursor pagination and status filters',
        tags: ['Payment Drafts'],
      },
    },
    async (req, reply) => {
      const parsed = paymentDraftFilterSchema.safeParse(req.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'validation_failed', issues: parsed.error.issues });
      }

      const { limit, cursor, status, companyId } = parsed.data;

      if (app.prisma) {
        const where: any = { deletedAt: null };
        if (companyId) where.companyId = companyId;
        if (status && status !== 'all') where.status = status;

        const items = await app.prisma.paymentDraft.findMany({
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

  // GET /v1/payment-drafts/:id
  app.get(
    '/v1/payment-drafts/:id',
    {
      schema: {
        description: 'Retrieves a single payment draft by UUID',
        tags: ['Payment Drafts'],
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      if (!app.prisma) {
        return reply.status(404).send({ error: 'not_found', message: 'Payment draft not found' });
      }

      const draft = await app.prisma.paymentDraft.findFirst({
        where: { id, deletedAt: null },
      });

      if (!draft) {
        return reply.status(404).send({ error: 'not_found', message: `Payment draft '${id}' not found` });
      }

      return draft;
    },
  );

  // POST /v1/payment-drafts
  app.post(
    '/v1/payment-drafts',
    {
      schema: {
        description: 'Creates a new payment draft requiring human approval before execution',
        tags: ['Payment Drafts'],
      },
    },
    async (req, reply) => {
      const parsed = CreatePaymentDraftSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'validation_failed', issues: parsed.error.issues });
      }

      const d = parsed.data;

      if (!app.prisma) {
        return reply.status(201).send({ id: 'mock-draft-id', ...d });
      }

      // Check idempotency
      const existing = await app.prisma.paymentDraft.findUnique({
        where: { idempotencyKey: d.idempotencyKey },
      });
      if (existing) {
        return reply.status(200).send(existing);
      }

      const created = await app.prisma.paymentDraft.create({
        data: {
          companyId: d.companyId,
          source: d.source.toUpperCase() as any,
          sourceId: d.sourceId,
          amountMinor: d.amountMinor,
          currency: d.currency,
          status: d.status.toUpperCase() as any,
          idempotencyKey: d.idempotencyKey,
        },
      });

      return reply.status(201).send(created);
    },
  );
}
