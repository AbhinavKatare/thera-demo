import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { paginationQuerySchema, paginateArray } from '../pagination.js';

export const payrollRunFilterSchema = paginationQuerySchema.extend({
  companyId: z.string().uuid().optional(),
  status: z
    .enum(['DRAFT', 'REVIEW', 'APPROVED', 'SCHEDULED', 'PROCESSING', 'PROCESSED', 'FAILED', 'CANCELLED', 'all'])
    .optional(),
});

export const createPayrollRunSchema = z.object({
  companyId: z.string().uuid(),
  periodStart: z.string(),
  periodEnd: z.string(),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  grossMinor: z.number().int().nonnegative().optional(),
  taxMinor: z.number().int().nonnegative().optional(),
  netMinor: z.number().int().nonnegative().optional(),
  items: z
    .array(
      z.object({
        contractorId: z.string().uuid(),
        grossMinor: z.number().int().nonnegative(),
        taxMinor: z.number().int().nonnegative(),
        netMinor: z.number().int().nonnegative(),
        currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
        status: z.enum(['PENDING', 'APPROVED', 'PAID', 'FAILED']).default('PENDING'),
      }),
    )
    .optional(),
});

export async function payrollRunsRoutes(app: FastifyInstance): Promise<void> {
  // GET /v1/payroll-runs
  app.get(
    '/v1/payroll-runs',
    {
      schema: {
        description: 'Lists payroll runs with cursor pagination and status filters',
        tags: ['Payroll Runs'],
      },
    },
    async (req, reply) => {
      const parsed = payrollRunFilterSchema.safeParse(req.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'validation_failed', issues: parsed.error.issues });
      }

      const { limit, cursor, status, companyId } = parsed.data;

      if (app.prisma) {
        const where: any = { deletedAt: null };
        if (companyId) where.companyId = companyId;
        if (status && status !== 'all') where.status = status;

        const items = await app.prisma.payrollRun.findMany({
          where,
          include: { items: true },
          take: limit + 1,
          cursor: cursor ? { id: cursor } : undefined,
          skip: cursor ? 1 : 0,
          orderBy: { periodStart: 'desc' },
        });

        const hasMore = items.length > limit;
        const resultItems = hasMore ? items.slice(0, limit) : items;
        const nextCursor = hasMore ? resultItems[resultItems.length - 1]!.id : null;

        return { items: resultItems, nextCursor, limit };
      }

      return paginateArray([], limit, cursor);
    },
  );

  // GET /v1/payroll-runs/:id
  app.get(
    '/v1/payroll-runs/:id',
    {
      schema: {
        description: 'Retrieves a single payroll run with itemized contractor payments',
        tags: ['Payroll Runs'],
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      if (!app.prisma) {
        return reply.status(404).send({ error: 'not_found', message: 'Payroll run not found' });
      }

      const run = await app.prisma.payrollRun.findFirst({
        where: { id, deletedAt: null },
        include: { items: { include: { contractor: true } } },
      });

      if (!run) {
        return reply.status(404).send({ error: 'not_found', message: `Payroll run '${id}' not found` });
      }

      return run;
    },
  );

  // POST /v1/payroll-runs
  app.post(
    '/v1/payroll-runs',
    {
      schema: {
        description: 'Creates a new payroll run cycle',
        tags: ['Payroll Runs'],
      },
    },
    async (req, reply) => {
      const parsed = createPayrollRunSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'validation_failed', issues: parsed.error.issues });
      }

      const data = parsed.data;

      if (!app.prisma) {
        return reply.status(201).send({ id: 'mock-payroll-run-id', ...data });
      }

      const created = await app.prisma.payrollRun.create({
        data: {
          companyId: data.companyId,
          status: 'DRAFT',
          periodStart: new Date(data.periodStart),
          periodEnd: new Date(data.periodEnd),
          currency: data.currency,
          grossMinor: data.grossMinor ?? 0,
          taxMinor: data.taxMinor ?? 0,
          netMinor: data.netMinor ?? 0,
          items: data.items
            ? {
                create: data.items.map((item) => ({
                  contractorId: item.contractorId,
                  grossMinor: item.grossMinor,
                  taxMinor: item.taxMinor,
                  netMinor: item.netMinor,
                  currency: item.currency,
                  status: item.status,
                })),
              }
            : undefined,
        },
        include: { items: true },
      });

      return reply.status(201).send(created);
    },
  );
}
