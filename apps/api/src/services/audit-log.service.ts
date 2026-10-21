import { ActorType, PrismaClient, AuditLog } from '@prisma/client';

export type PrismaOrTransaction = Pick<PrismaClient, 'auditLog'>;

export interface AuditActor {
  type: ActorType | 'user' | 'service' | 'connector';
  id: string;
}

export interface WriteAuditLogInput {
  companyId?: string | null;
  actor: AuditActor;
  action: string;
  resourceType: string;
  resourceId: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown> | null;
  timestamp?: Date;
}

/**
 * Normalizes input actor type to Prisma's ActorType enum.
 */
function normalizeActorType(type: AuditActor['type']): ActorType {
  const upper = String(type).toUpperCase();
  if (upper === 'USER') return ActorType.USER;
  if (upper === 'SERVICE') return ActorType.SERVICE;
  if (upper === 'CONNECTOR') return ActorType.CONNECTOR;
  throw new Error(`Invalid actor type: ${type}`);
}

/**
 * Safely converts an object or primitive into a Prisma-compatible JSON value.
 */
function toPrismaJson(val: unknown): any {
  if (val === undefined) return null;
  if (val === null) return null;
  try {
    return JSON.parse(JSON.stringify(val));
  } catch {
    return String(val);
  }
}

/**
 * Single service function for writing append-only AuditLog entries.
 * All audit writes (approvals, rejections, extractions, connector syncs) MUST pass through this function.
 */
export async function writeAuditLog(
  client: PrismaOrTransaction,
  input: WriteAuditLogInput,
): Promise<AuditLog> {
  if (!input.actor || !input.actor.id || !input.actor.type) {
    throw new Error('AuditLog entry requires a valid actor with id and type');
  }
  if (!input.action || input.action.trim().length === 0) {
    throw new Error('AuditLog entry requires a valid action');
  }
  if (!input.resourceType || !input.resourceId) {
    throw new Error('AuditLog entry requires resourceType and resourceId');
  }

  const actorType = normalizeActorType(input.actor.type);
  const timestamp = input.timestamp ?? new Date();

  return client.auditLog.create({
    data: {
      companyId: input.companyId ?? null,
      timestamp,
      actorType,
      actorId: input.actor.id,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      before: toPrismaJson(input.before),
      after: toPrismaJson(input.after),
      metadata: input.metadata ? toPrismaJson(input.metadata) : null,
    },
  });
}

// ---------------------------------------------------------------------------
// Typed domain helper operations required by specification
// ---------------------------------------------------------------------------

export interface ApprovalAuditInput {
  companyId?: string | null;
  actor: AuditActor;
  targetType: 'INVOICE' | 'PAYMENT_DRAFT' | 'PAYROLL_RUN' | string;
  targetId: string;
  before: unknown;
  after: unknown;
  decisionNote?: string | null;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Records an approval event through writeAuditLog.
 */
export async function recordApproval(
  client: PrismaOrTransaction,
  input: ApprovalAuditInput,
): Promise<AuditLog> {
  return writeAuditLog(client, {
    companyId: input.companyId,
    actor: input.actor,
    action: 'approval.approved',
    resourceType: input.targetType,
    resourceId: input.targetId,
    before: input.before,
    after: input.after,
    timestamp: input.timestamp ?? new Date(),
    metadata: {
      decision: 'APPROVED',
      decisionNote: input.decisionNote ?? null,
      ...input.metadata,
    },
  });
}

/**
 * Records a rejection event through writeAuditLog.
 */
export async function recordRejection(
  client: PrismaOrTransaction,
  input: ApprovalAuditInput,
): Promise<AuditLog> {
  return writeAuditLog(client, {
    companyId: input.companyId,
    actor: input.actor,
    action: 'approval.rejected',
    resourceType: input.targetType,
    resourceId: input.targetId,
    before: input.before,
    after: input.after,
    timestamp: input.timestamp ?? new Date(),
    metadata: {
      decision: 'REJECTED',
      decisionNote: input.decisionNote ?? null,
      ...input.metadata,
    },
  });
}

export interface ExtractionAuditInput {
  companyId?: string | null;
  actor: AuditActor;
  invoiceId: string;
  before?: unknown;
  after: unknown;
  extractedFields?: string[];
  confidenceScore?: number;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Records an AI or OCR invoice extraction event through writeAuditLog.
 */
export async function recordExtraction(
  client: PrismaOrTransaction,
  input: ExtractionAuditInput,
): Promise<AuditLog> {
  return writeAuditLog(client, {
    companyId: input.companyId,
    actor: input.actor,
    action: 'invoice.extracted',
    resourceType: 'INVOICE',
    resourceId: input.invoiceId,
    before: input.before ?? null,
    after: input.after,
    timestamp: input.timestamp ?? new Date(),
    metadata: {
      extractedFields: input.extractedFields ?? [],
      confidenceScore: input.confidenceScore ?? null,
      ...input.metadata,
    },
  });
}

export interface ConnectorSyncAuditInput {
  companyId?: string | null;
  actor: AuditActor;
  provider: 'QUICKBOOKS' | 'XERO' | 'MOCK' | string;
  connectorAccountId: string;
  before?: unknown;
  after?: unknown;
  syncType?: string;
  status?: 'SUCCESS' | 'FAILED' | 'PARTIAL' | string;
  syncedRecordsCount?: number;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Records an external connector sync event through writeAuditLog.
 */
export async function recordConnectorSync(
  client: PrismaOrTransaction,
  input: ConnectorSyncAuditInput,
): Promise<AuditLog> {
  return writeAuditLog(client, {
    companyId: input.companyId,
    actor: input.actor,
    action: 'connector.sync',
    resourceType: `CONNECTOR_${input.provider.toUpperCase()}`,
    resourceId: input.connectorAccountId,
    before: input.before ?? null,
    after: input.after ?? null,
    timestamp: input.timestamp ?? new Date(),
    metadata: {
      provider: input.provider,
      syncType: input.syncType ?? 'full_sync',
      status: input.status ?? 'SUCCESS',
      syncedRecordsCount: input.syncedRecordsCount ?? 0,
      ...input.metadata,
    },
  });
}
