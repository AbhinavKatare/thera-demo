import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ApprovalStatus, ApprovalTargetType } from '@prisma/client';
import { ApprovalWorkflowService } from '../../services/approval-workflow.service.js';
import { paginationQuerySchema, paginateArray } from '../pagination.js';

export const approvalFilterSchema = paginationQuerySchema.extend({
  companyId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SENT', 'all']).optional(),
  targetType: z.enum(['INVOICE', 'PAYMENT_DRAFT', 'PAYROLL_RUN']).optional(),
});

export const createApprovalBodySchema = z.object({
  companyId: z.string().uuid(),
  targetType: z.enum(['INVOICE', 'PAYMENT_DRAFT', 'PAYROLL_RUN']),
  targetId: z.string().uuid(),
  requestedBy: z.string().min(1),
  amountMinor: z.number().int().nonnegative().default(0),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  idempotencyKey: z.string().min(8),
});

export const decisionBodySchema = z.object({
  approverId: z.string().min(1),
  idempotencyKey: z.string().min(8),
  decisionNote: z.string().optional(),
});

export const markSentBodySchema = z.object({
  actorId: z.string().min(1),
  externalTransactionId: z.string().optional(),
});

export async function approvalsRoutes(
  app: FastifyInstance,
  options: { approvalService: ApprovalWorkflowService },
): Promise<void> {
  const { approvalService } = options;

  // GET /v1/approvals
  app.get(
    '/v1/approvals',
    {
      schema: {
        description: 'Lists approval records with cursor pagination and status/target filters',
        tags: ['Approvals'],
      },
    },
    async (req, reply) => {
      const parsed = approvalFilterSchema.safeParse(req.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'validation_failed', issues: parsed.error.issues });
      }

      const { limit, cursor, status, targetType, companyId } = parsed.data;

      if (app.prisma) {
        const where: any = { deletedAt: null };
        if (companyId) where.companyId = companyId;
        if (status && status !== 'all') where.status = status;
        if (targetType) where.targetType = targetType;

        const items = await app.prisma.approval.findMany({
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

  // GET /v1/approvals/:id
  app.get(
    '/v1/approvals/:id',
    {
      schema: {
        description: 'Retrieves an approval record by UUID',
        tags: ['Approvals'],
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      if (!app.prisma) {
        return reply.status(404).send({ error: 'not_found', message: 'Approval not found' });
      }

      const approval = await app.prisma.approval.findFirst({
        where: { id, deletedAt: null },
      });

      if (!approval) {
        return reply.status(404).send({ error: 'not_found', message: `Approval '${id}' not found` });
      }

      return approval;
    },
  );

  // POST /v1/approvals (Create Draft)
  app.post(
    '/v1/approvals',
    {
      schema: {
        description: 'Creates a new approval in DRAFT state with required approvers evaluated by amount',
        tags: ['Approvals'],
      },
    },
    async (req, reply) => {
      const parsed = createApprovalBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'validation_failed', issues: parsed.error.issues });
      }

      try {
        const approval = await approvalService.createDraft({
          companyId: parsed.data.companyId,
          targetType: parsed.data.targetType as ApprovalTargetType,
          targetId: parsed.data.targetId,
          requestedBy: parsed.data.requestedBy,
          amountMinor: parsed.data.amountMinor,
          currency: parsed.data.currency,
          idempotencyKey: parsed.data.idempotencyKey,
        });
        return reply.status(201).send(approval);
      } catch (err: any) {
        return reply.status(400).send({ error: 'draft_creation_failed', message: err.message });
      }
    },
  );

  // POST /v1/approvals/:id/submit (DRAFT -> PENDING_APPROVAL)
  app.post(
    '/v1/approvals/:id/submit',
    {
      schema: {
        description: 'Transitions an approval from DRAFT to PENDING_APPROVAL',
        tags: ['Approvals'],
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const body = (req.body as any) ?? {};
      const submittedBy = body.submittedBy ?? (req.user ? req.user.userId : 'system');

      try {
        const updated = await approvalService.submitForApproval({
          approvalId: id,
          submittedBy,
        });
        return reply.status(200).send(updated);
      } catch (err: any) {
        const statusCode = err.statusCode ?? 400;
        return reply.status(statusCode).send({ error: err.name, message: err.message });
      }
    },
  );

  // POST /v1/approvals/:id/approve (PENDING_APPROVAL -> APPROVED, or partial if 2 required)
  app.post(
    '/v1/approvals/:id/approve',
    {
      schema: {
        description: 'Submits an approval decision. Enforces multi-approver threshold if amount >= $5,000',
        tags: ['Approvals'],
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = decisionBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'validation_failed', issues: parsed.error.issues });
      }

      try {
        const updated = await approvalService.approve({
          approvalId: id,
          approverId: parsed.data.approverId,
          idempotencyKey: parsed.data.idempotencyKey,
          decisionNote: parsed.data.decisionNote,
        });
        return reply.status(200).send(updated);
      } catch (err: any) {
        const statusCode = err.statusCode ?? 400;
        return reply.status(statusCode).send({ error: err.name, message: err.message });
      }
    },
  );

  // POST /v1/approvals/:id/reject (PENDING_APPROVAL -> REJECTED)
  app.post(
    '/v1/approvals/:id/reject',
    {
      schema: {
        description: 'Rejects a pending approval',
        tags: ['Approvals'],
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = decisionBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'validation_failed', issues: parsed.error.issues });
      }

      try {
        const updated = await approvalService.reject({
          approvalId: id,
          approverId: parsed.data.approverId,
          idempotencyKey: parsed.data.idempotencyKey,
          decisionNote: parsed.data.decisionNote,
        });
        return reply.status(200).send(updated);
      } catch (err: any) {
        const statusCode = err.statusCode ?? 400;
        return reply.status(statusCode).send({ error: err.name, message: err.message });
      }
    },
  );

  // POST /v1/approvals/:id/send (APPROVED -> SENT)
  app.post(
    '/v1/approvals/:id/send',
    {
      schema: {
        description: 'Marks an already-approved target as SENT to payment connector',
        tags: ['Approvals'],
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = markSentBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'validation_failed', issues: parsed.error.issues });
      }

      try {
        const updated = await approvalService.markSent({
          approvalId: id,
          actorId: parsed.data.actorId,
          externalTransactionId: parsed.data.externalTransactionId,
        });
        return reply.status(200).send(updated);
      } catch (err: any) {
        const statusCode = err.statusCode ?? 400;
        return reply.status(statusCode).send({ error: err.name, message: err.message });
      }
    },
  );
}
