import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CreateContractorSchema } from '@paypilot/core';
import { paginationQuerySchema, paginateArray } from '../pagination.js';

export const contractorFilterSchema = paginationQuerySchema.extend({
  companyId: z.string().uuid().optional(),
  status: z.enum(['INVITED', 'ACTIVE', 'OFFBOARDED', 'all']).optional(),
  countryCode: z.string().length(2).optional(),
});

export async function contractorsRoutes(app: FastifyInstance): Promise<void> {
  // GET /v1/contractors
  app.get(
    '/v1/contractors',
    {
      schema: {
        description: 'Lists contractors with cursor pagination and filtering by status and country',
        tags: ['Contractors'],
      },
    },
    async (req, reply) => {
      const parsed = contractorFilterSchema.safeParse(req.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'validation_failed', issues: parsed.error.issues });
      }

      const { limit, cursor, status, countryCode, companyId } = parsed.data;

      if (app.prisma) {
        const where: any = { deletedAt: null };
        if (companyId) where.companyId = companyId;
        if (status && status !== 'all') where.status = status;
        if (countryCode) where.countryCode = countryCode;

        const items = await app.prisma.contractor.findMany({
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

      // Memory fallback for mock db
      return paginateArray([], limit, cursor);
    },
  );

  // GET /v1/contractors/:id
  app.get(
    '/v1/contractors/:id',
    {
      schema: {
        description: 'Retrieves a single contractor by UUID',
        tags: ['Contractors'],
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      if (!app.prisma) {
        return reply.status(404).send({ error: 'not_found', message: 'Contractor not found' });
      }

      const contractor = await app.prisma.contractor.findFirst({
        where: { id, deletedAt: null },
        include: { contracts: true },
      });

      if (!contractor) {
        return reply.status(404).send({ error: 'not_found', message: `Contractor '${id}' not found` });
      }

      return contractor;
    },
  );

  // POST /v1/contractors
  app.post(
    '/v1/contractors',
    {
      schema: {
        description: 'Creates a new contractor record',
        tags: ['Contractors'],
      },
    },
    async (req, reply) => {
      const parsed = CreateContractorSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'validation_failed', issues: parsed.error.issues });
      }

      if (!app.prisma) {
        return reply.status(201).send({ id: 'mock-contractor-id', ...parsed.data });
      }

      const created = await app.prisma.contractor.create({
        data: {
          companyId: parsed.data.companyId,
          legalName: parsed.data.legalName,
          displayName: parsed.data.displayName,
          email: parsed.data.email,
          taxId: parsed.data.taxId ?? null,
          countryCode: parsed.data.countryCode,
          status: parsed.data.status.toUpperCase() as any,
          defaultRateMinor: parsed.data.defaultRateMinor,
          timezone: parsed.data.timezone,
        },
      });

      return reply.status(201).send(created);
    },
  );
}
