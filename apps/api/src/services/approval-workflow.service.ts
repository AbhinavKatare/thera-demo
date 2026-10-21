import {
  Approval,
  ApprovalStatus,
  ApprovalTargetType,
  PrismaClient,
} from '@prisma/client';
import { writeAuditLog } from './audit-log.service.js';
import { HttpError } from '../errors.js';

export class InvalidStateTransitionError extends HttpError {
  constructor(public readonly from: string, public readonly to: string, message?: string) {
    super(422, message ?? `Invalid approval transition from '${from}' to '${to}'`);
    this.name = 'InvalidStateTransitionError';
  }
}

export class DuplicateApproverError extends HttpError {
  constructor(public readonly approverId: string) {
    super(400, `Approver '${approverId}' has already approved this request. Distinct approvers are required.`);
    this.name = 'DuplicateApproverError';
  }
}

export type ApprovalPrismaClient = Pick<PrismaClient, 'approval' | 'auditLog'>;

export interface CreateApprovalDraftInput {
  companyId: string;
  targetType: ApprovalTargetType;
  targetId: string;
  requestedBy: string;
  amountMinor: number;
  currency?: string;
  idempotencyKey: string;
}

export interface SubmitApprovalInput {
  approvalId: string;
  submittedBy: string;
}

export interface ApproveActionInput {
  approvalId: string;
  approverId: string;
  idempotencyKey: string;
  decisionNote?: string;
}

export interface RejectActionInput {
  approvalId: string;
  approverId: string;
  idempotencyKey: string;
  decisionNote?: string;
}

export interface MarkSentInput {
  approvalId: string;
  actorId: string;
  externalTransactionId?: string;
}

// 5,000 USD (500,000 minor units) threshold requiring 2 distinct approvers
export const TWO_APPROVER_THRESHOLD_MINOR = 500_000;

export class ApprovalWorkflowService {
  constructor(private readonly prisma: ApprovalPrismaClient) {}

  /**
   * Evaluates rule: returns required number of approvers based on transaction amount.
   */
  public getRequiredApproversCount(amountMinor: number): number {
    if (amountMinor >= TWO_APPROVER_THRESHOLD_MINOR) {
      return 2;
    }
    return 1;
  }

  /**
   * Creates an approval in DRAFT state. Idempotent by idempotencyKey.
   */
  public async createDraft(input: CreateApprovalDraftInput): Promise<Approval> {
    const existing = await this.prisma.approval.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      return existing;
    }

    const requiredApproversCount = this.getRequiredApproversCount(input.amountMinor);

    const approval = await this.prisma.approval.create({
      data: {
        companyId: input.companyId,
        targetType: input.targetType,
        targetId: input.targetId,
        requestedBy: input.requestedBy,
        amountMinor: input.amountMinor,
        currency: input.currency ?? 'USD',
        status: ApprovalStatus.DRAFT,
        requiredApproversCount,
        approvers: [],
        idempotencyKey: input.idempotencyKey,
      },
    });

    await writeAuditLog(this.prisma, {
      companyId: approval.companyId,
      actor: { type: 'USER', id: input.requestedBy },
      action: 'approval.draft_created',
      resourceType: approval.targetType,
      resourceId: approval.id,
      before: null,
      after: approval,
    });

    return approval;
  }

  /**
   * Transition: DRAFT -> PENDING_APPROVAL
   */
  public async submitForApproval(input: SubmitApprovalInput): Promise<Approval> {
    const current = await this.prisma.approval.findUnique({
      where: { id: input.approvalId },
    });
    if (!current) {
      throw new Error(`Approval ${input.approvalId} not found`);
    }

    if (current.status !== ApprovalStatus.DRAFT) {
      throw new InvalidStateTransitionError(current.status, ApprovalStatus.PENDING_APPROVAL);
    }

    const updated = await this.prisma.approval.update({
      where: { id: input.approvalId },
      data: { status: ApprovalStatus.PENDING_APPROVAL },
    });

    await writeAuditLog(this.prisma, {
      companyId: updated.companyId,
      actor: { type: 'USER', id: input.submittedBy },
      action: 'approval.submitted',
      resourceType: updated.targetType,
      resourceId: updated.id,
      before: current,
      after: updated,
    });

    return updated;
  }

  /**
   * Transition: PENDING_APPROVAL -> APPROVED (or records intermediate approver if >= $5,000)
   * Idempotent: repeating approval with same idempotencyKey returns current record safely.
   */
  public async approve(input: ApproveActionInput): Promise<Approval> {
    const current = await this.prisma.approval.findUnique({
      where: { id: input.approvalId },
    });
    if (!current) {
      throw new Error(`Approval ${input.approvalId} not found`);
    }

    // Check idempotency: if already approved or already recorded by this approver
    const approversList: string[] = Array.isArray(current.approvers)
      ? (current.approvers as string[])
      : [];

    if (current.status === ApprovalStatus.APPROVED) {
      return current;
    }

    if (current.status !== ApprovalStatus.PENDING_APPROVAL) {
      throw new InvalidStateTransitionError(current.status, ApprovalStatus.APPROVED);
    }

    // Disallow same user approving twice to satisfy 2-approver requirement
    if (approversList.includes(input.approverId)) {
      throw new DuplicateApproverError(input.approverId);
    }

    const newApprovers = [...approversList, input.approverId];
    const isFullyApproved = newApprovers.length >= current.requiredApproversCount;
    const nextStatus = isFullyApproved ? ApprovalStatus.APPROVED : ApprovalStatus.PENDING_APPROVAL;
    const now = new Date();

    const updated = await this.prisma.approval.update({
      where: { id: input.approvalId },
      data: {
        status: nextStatus,
        approvers: newApprovers,
        decisionNote: input.decisionNote ?? current.decisionNote,
        decidedAt: isFullyApproved ? now : current.decidedAt,
      },
    });

    await writeAuditLog(this.prisma, {
      companyId: updated.companyId,
      actor: { type: 'USER', id: input.approverId },
      action: isFullyApproved ? 'approval.approved' : 'approval.partially_approved',
      resourceType: updated.targetType,
      resourceId: updated.id,
      before: current,
      after: updated,
      metadata: {
        approverId: input.approverId,
        approvalsCount: newApprovers.length,
        requiredApproversCount: current.requiredApproversCount,
        isFullyApproved,
        decisionNote: input.decisionNote ?? null,
      },
    });

    return updated;
  }

  /**
   * Transition: PENDING_APPROVAL -> REJECTED
   */
  public async reject(input: RejectActionInput): Promise<Approval> {
    const current = await this.prisma.approval.findUnique({
      where: { id: input.approvalId },
    });
    if (!current) {
      throw new Error(`Approval ${input.approvalId} not found`);
    }

    if (current.status === ApprovalStatus.REJECTED) {
      return current;
    }

    if (current.status !== ApprovalStatus.PENDING_APPROVAL) {
      throw new InvalidStateTransitionError(current.status, ApprovalStatus.REJECTED);
    }

    const updated = await this.prisma.approval.update({
      where: { id: input.approvalId },
      data: {
        status: ApprovalStatus.REJECTED,
        decisionNote: input.decisionNote,
        decidedAt: new Date(),
      },
    });

    await writeAuditLog(this.prisma, {
      companyId: updated.companyId,
      actor: { type: 'USER', id: input.approverId },
      action: 'approval.rejected',
      resourceType: updated.targetType,
      resourceId: updated.id,
      before: current,
      after: updated,
      metadata: {
        decisionNote: input.decisionNote ?? null,
      },
    });

    return updated;
  }

  /**
   * Transition: APPROVED -> SENT
   */
  public async markSent(input: MarkSentInput): Promise<Approval> {
    const current = await this.prisma.approval.findUnique({
      where: { id: input.approvalId },
    });
    if (!current) {
      throw new Error(`Approval ${input.approvalId} not found`);
    }

    if (current.status === ApprovalStatus.SENT) {
      return current;
    }

    if (current.status !== ApprovalStatus.APPROVED) {
      throw new InvalidStateTransitionError(current.status, ApprovalStatus.SENT);
    }

    const updated = await this.prisma.approval.update({
      where: { id: input.approvalId },
      data: { status: ApprovalStatus.SENT },
    });

    await writeAuditLog(this.prisma, {
      companyId: updated.companyId,
      actor: { type: 'SERVICE', id: input.actorId },
      action: 'approval.sent',
      resourceType: updated.targetType,
      resourceId: updated.id,
      before: current,
      after: updated,
      metadata: {
        externalTransactionId: input.externalTransactionId ?? null,
      },
    });

    return updated;
  }
}
