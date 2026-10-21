import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ApprovalStatus } from '@prisma/client';
import {
  ApprovalWorkflowService,
  InvalidStateTransitionError,
  DuplicateApproverError,
} from './approval-workflow.service.js';

describe('ApprovalWorkflowService', () => {
  let store: Map<string, any>;
  let auditLogs: any[];
  let service: ApprovalWorkflowService;

  beforeEach(() => {
    store = new Map<string, any>();
    auditLogs = [];

    const mockPrisma = {
      approval: {
        findUnique: vi.fn().mockImplementation(async ({ where }: any) => {
          if (where.id) return store.get(where.id) ?? null;
          if (where.idempotencyKey) {
            return Array.from(store.values()).find((a) => a.idempotencyKey === where.idempotencyKey) ?? null;
          }
          return null;
        }),
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          const id = `appr-${store.size + 1}`;
          const rec = { id, createdAt: new Date(), updatedAt: new Date(), ...data };
          store.set(id, rec);
          return rec;
        }),
        update: vi.fn().mockImplementation(async ({ where, data }: any) => {
          const existing = store.get(where.id);
          const updated = { ...existing, ...data, updatedAt: new Date() };
          store.set(where.id, updated);
          return updated;
        }),
      },
      auditLog: {
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          auditLogs.push(data);
          return { id: `audit-${auditLogs.length}`, ...data };
        }),
      },
    };

    service = new ApprovalWorkflowService(mockPrisma as any);
  });

  describe('Standard Workflow (Amount < $5,000 => 1 Approver)', () => {
    it('executes full valid lifecycle: DRAFT -> PENDING_APPROVAL -> APPROVED -> SENT', async () => {
      // 1. Create DRAFT ($2,000 = 200,000 minor units)
      const draft = await service.createDraft({
        companyId: 'comp-100',
        targetType: 'PAYMENT_DRAFT',
        targetId: 'pd-1',
        requestedBy: 'finance-associate',
        amountMinor: 200_000,
        idempotencyKey: 'idem-flow-1',
      });

      expect(draft.status).toBe(ApprovalStatus.DRAFT);
      expect(draft.requiredApproversCount).toBe(1);

      // 2. Submit: DRAFT -> PENDING_APPROVAL
      const submitted = await service.submitForApproval({
        approvalId: draft.id,
        submittedBy: 'finance-associate',
      });
      expect(submitted.status).toBe(ApprovalStatus.PENDING_APPROVAL);

      // 3. Approve: PENDING_APPROVAL -> APPROVED
      const approved = await service.approve({
        approvalId: draft.id,
        approverId: 'manager-1',
        idempotencyKey: 'decision-idem-1',
        decisionNote: 'Authorized under budget',
      });
      expect(approved.status).toBe(ApprovalStatus.APPROVED);
      expect(approved.approvers).toEqual(['manager-1']);

      // 4. Send: APPROVED -> SENT
      const sent = await service.markSent({
        approvalId: draft.id,
        actorId: 'payment-dispatcher-service',
        externalTransactionId: 'txn-thera-12345',
      });
      expect(sent.status).toBe(ApprovalStatus.SENT);

      // Verify audit logs generated for each transition
      const actions = auditLogs.map((a) => a.action);
      expect(actions).toContain('approval.draft_created');
      expect(actions).toContain('approval.submitted');
      expect(actions).toContain('approval.approved');
      expect(actions).toContain('approval.sent');
    });

    it('executes rejection flow: DRAFT -> PENDING_APPROVAL -> REJECTED', async () => {
      const draft = await service.createDraft({
        companyId: 'comp-100',
        targetType: 'INVOICE',
        targetId: 'inv-99',
        requestedBy: 'contractor-user',
        amountMinor: 100_000,
        idempotencyKey: 'idem-reject-1',
      });

      await service.submitForApproval({ approvalId: draft.id, submittedBy: 'contractor-user' });

      const rejected = await service.reject({
        approvalId: draft.id,
        approverId: 'manager-2',
        idempotencyKey: 'rej-idem-1',
        decisionNote: 'Scope not verified',
      });

      expect(rejected.status).toBe(ApprovalStatus.REJECTED);
      expect(rejected.decisionNote).toBe('Scope not verified');
    });
  });

  describe('Amount-Based Rules (Amount >= $5,000 => 2 Distinct Approvers)', () => {
    it('requires 2 distinct approvers for amounts >= $5,000 (500,000 minor units)', async () => {
      // Create high-value request ($12,500 = 1,250,000 minor units)
      const draft = await service.createDraft({
        companyId: 'comp-100',
        targetType: 'PAYMENT_DRAFT',
        targetId: 'pd-large',
        requestedBy: 'finance-lead',
        amountMinor: 1_250_000,
        idempotencyKey: 'idem-large-1',
      });

      expect(draft.requiredApproversCount).toBe(2);

      await service.submitForApproval({ approvalId: draft.id, submittedBy: 'finance-lead' });

      // 1st Approver decides: Status remains PENDING_APPROVAL
      const firstDecision = await service.approve({
        approvalId: draft.id,
        approverId: 'approver-alex',
        idempotencyKey: 'alex-appr-key',
        decisionNote: 'Looks good from engineering budget',
      });

      expect(firstDecision.status).toBe(ApprovalStatus.PENDING_APPROVAL);
      expect(firstDecision.approvers).toEqual(['approver-alex']);

      // Same approver cannot approve again
      await expect(
        service.approve({
          approvalId: draft.id,
          approverId: 'approver-alex',
          idempotencyKey: 'alex-appr-key-2',
        }),
      ).rejects.toThrowError(DuplicateApproverError);

      // 2nd distinct approver decides: Status transitions to APPROVED
      const secondDecision = await service.approve({
        approvalId: draft.id,
        approverId: 'approver-charlotte',
        idempotencyKey: 'charlotte-appr-key',
        decisionNote: 'Authorized by VP Finance',
      });

      expect(secondDecision.status).toBe(ApprovalStatus.APPROVED);
      expect(secondDecision.approvers).toEqual(['approver-alex', 'approver-charlotte']);
    });
  });

  describe('Invalid State Transitions', () => {
    it('disallows directly approving a DRAFT without submission', async () => {
      const draft = await service.createDraft({
        companyId: 'comp-100',
        targetType: 'INVOICE',
        targetId: 'inv-1',
        requestedBy: 'user-1',
        amountMinor: 50_000,
        idempotencyKey: 'idem-invalid-1',
      });

      await expect(
        service.approve({
          approvalId: draft.id,
          approverId: 'approver-1',
          idempotencyKey: 'key-1',
        }),
      ).rejects.toThrowError(InvalidStateTransitionError);
    });

    it('disallows marking REJECTED target as SENT', async () => {
      const draft = await service.createDraft({
        companyId: 'comp-100',
        targetType: 'INVOICE',
        targetId: 'inv-2',
        requestedBy: 'user-1',
        amountMinor: 50_000,
        idempotencyKey: 'idem-invalid-2',
      });

      await service.submitForApproval({ approvalId: draft.id, submittedBy: 'user-1' });
      await service.reject({ approvalId: draft.id, approverId: 'approver-1', idempotencyKey: 'key-2' });

      await expect(
        service.markSent({
          approvalId: draft.id,
          actorId: 'worker',
        }),
      ).rejects.toThrowError(InvalidStateTransitionError);
    });
  });

  describe('Idempotency', () => {
    it('createDraft returns existing record on repeated idempotencyKey', async () => {
      const draft1 = await service.createDraft({
        companyId: 'comp-100',
        targetType: 'INVOICE',
        targetId: 'inv-idem',
        requestedBy: 'user-1',
        amountMinor: 80_000,
        idempotencyKey: 'shared-idem-key',
      });

      const draft2 = await service.createDraft({
        companyId: 'comp-100',
        targetType: 'INVOICE',
        targetId: 'inv-idem',
        requestedBy: 'user-1',
        amountMinor: 80_000,
        idempotencyKey: 'shared-idem-key',
      });

      expect(draft1.id).toBe(draft2.id);
    });
  });
});
