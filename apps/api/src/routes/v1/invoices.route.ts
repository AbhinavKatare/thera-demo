import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { CreateInvoiceSchema } from '@paypilot/core';
import { paginationQuerySchema, paginateArray } from '../pagination.js';

export const invoiceFilterSchema = paginationQuerySchema.extend({
  companyId: z.string().uuid().optional(),
  contractorId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID', 'VOID', 'all']).optional(),
  dueBefore: z.string().optional(),
  dueAfter: z.string().optional(),
});

export async function invoicesRoutes(app: FastifyInstance): Promise<void> {
  // GET /v1/invoices
  app.get(
    '/v1/invoices',
    {
      schema: {
        description: 'Lists invoices with cursor pagination and filtering by status, contractor, and due dates',
        tags: ['Invoices'],
      },
    },
    async (req, reply) => {
      const parsed = invoiceFilterSchema.safeParse(req.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'validation_failed', issues: parsed.error.issues });
      }

      const { limit, cursor, status, contractorId, dueBefore, dueAfter, companyId } = parsed.data;

      if (app.prisma) {
        const where: any = { deletedAt: null };
        if (companyId) where.companyId = companyId;
        if (contractorId) where.contractorId = contractorId;
        if (status && status !== 'all') where.status = status;
        if (dueBefore || dueAfter) {
          where.dueDate = {};
          if (dueBefore) where.dueDate.lte = new Date(dueBefore);
          if (dueAfter) where.dueDate.gte = new Date(dueAfter);
        }

        const items = await app.prisma.invoice.findMany({
          where,
          include: { lineItems: true, contractor: true },
          take: limit + 1,
          cursor: cursor ? { id: cursor } : undefined,
          skip: cursor ? 1 : 0,
          orderBy: { dueDate: 'asc' },
        });

        const hasMore = items.length > limit;
        const resultItems = hasMore ? items.slice(0, limit) : items;
        const nextCursor = hasMore ? resultItems[resultItems.length - 1]!.id : null;

        return { items: resultItems, nextCursor, limit };
      }

      return paginateArray([], limit, cursor);
    },
  );

  // GET /v1/invoices/:id
  app.get(
    '/v1/invoices/:id',
    {
      schema: {
        description: 'Retrieves an invoice by UUID with line items and contractor details',
        tags: ['Invoices'],
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      if (!app.prisma) {
        return reply.status(404).send({ error: 'not_found', message: 'Invoice not found' });
      }

      const invoice = await app.prisma.invoice.findFirst({
        where: { id, deletedAt: null },
        include: { lineItems: true, contractor: true, contract: true },
      });

      if (!invoice) {
        return reply.status(404).send({ error: 'not_found', message: `Invoice '${id}' not found` });
      }

      return invoice;
    },
  );

  // POST /v1/invoices
  app.post(
    '/v1/invoices',
    {
      schema: {
        description: 'Creates a new invoice with verified line items and auto-generated SHA-256 hash',
        tags: ['Invoices'],
      },
    },
    async (req, reply) => {
      const parsed = CreateInvoiceSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'validation_failed', issues: parsed.error.issues });
      }

      const inv = parsed.data;
      const subtotalMinor = inv.lineItems.reduce((acc, l) => acc + l.amountMinor, 0);
      const totalMinor = subtotalMinor + inv.taxMinor;
      const invoiceHash = createHash('sha256')
        .update(`${inv.invoiceNumber}:${inv.contractorId}:${totalMinor}`)
        .digest('hex');

      if (!app.prisma) {
        return reply.status(201).send({
          id: 'mock-invoice-id',
          invoiceHash,
          ...inv,
        });
      }

      const created = await app.prisma.invoice.create({
        data: {
          companyId: inv.companyId,
          contractorId: inv.contractorId,
          contractId: inv.contractId,
          invoiceNumber: inv.invoiceNumber,
          status: inv.status.toUpperCase() as any,
          periodStart: new Date(inv.periodStart),
          periodEnd: new Date(inv.periodEnd),
          issueDate: new Date(inv.issueDate),
          dueDate: new Date(inv.dueDate),
          currency: inv.currency,
          subtotalMinor,
          taxMinor: inv.taxMinor,
          totalMinor,
          invoiceHash,
          notes: inv.notes ?? null,
          taxDescription: inv.taxDescription ?? null,
          lineItems: {
            create: inv.lineItems.map((li) => ({
              description: li.description,
              quantity: li.quantity,
              unitPriceMinor: li.unitPriceMinor,
              amountMinor: li.amountMinor,
            })),
          },
        },
        include: { lineItems: true },
      });

      return reply.status(201).send(created);
    },
  );
}
