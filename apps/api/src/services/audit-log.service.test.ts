import { describe, expect, it, vi } from 'vitest';
import { ActorType } from '@prisma/client';
import {
  writeAuditLog,
  recordApproval,
  recordRejection,
  recordExtraction,
  recordConnectorSync,
  PrismaOrTransaction,
} from './audit-log.service.js';

describe('AuditLog Service', () => {
  function createMockPrisma() {
    const createdLogs: any[] = [];
    const mockClient: PrismaOrTransaction = {
      auditLog: {
        create: vi.fn().mockImplementation(async ({ data }) => {
          const record = {
            id: 'mock-uuid-' + (createdLogs.length + 1),
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
            ...data,
          };
          createdLogs.push(record);
          return record;
        }),
      } as any,
    };
    return { mockClient, createdLogs };
  }

  describe('writeAuditLog (Single write function)', () => {
    it('successfully writes an append-only audit log entry', async () => {
      const { mockClient, createdLogs } = createMockPrisma();
      const testDate = new Date('2025-05-10T12:00:00Z');

      const result = await writeAuditLog(mockClient, {
        companyId: 'comp-123',
        actor: { type: 'user', id: 'usr-999' },
        action: 'invoice.status_changed',
        resourceType: 'INVOICE',
        resourceId: 'inv-456',
        before: { status: 'DRAFT', total: 1000 },
        after: { status: 'SUBMITTED', total: 1000 },
        timestamp: testDate,
        metadata: { clientIp: '127.0.0.1' },
      });

      expect(result.id).toBe('mock-uuid-1');
      expect(createdLogs).toHaveLength(1);
      expect(mockClient.auditLog.create).toHaveBeenCalledTimes(1);

      const logged = createdLogs[0];
      expect(logged.companyId).toBe('comp-123');
      expect(logged.actorType).toBe(ActorType.USER);
      expect(logged.actorId).toBe('usr-999');
      expect(logged.action).toBe('invoice.status_changed');
      expect(logged.resourceType).toBe('INVOICE');
      expect(logged.resourceId).toBe('inv-456');
      expect(logged.before).toEqual({ status: 'DRAFT', total: 1000 });
      expect(logged.after).toEqual({ status: 'SUBMITTED', total: 1000 });
      expect(logged.timestamp).toEqual(testDate);
      expect(logged.metadata).toEqual({ clientIp: '127.0.0.1' });
    });

    it('validates actor presence and fields', async () => {
      const { mockClient } = createMockPrisma();
      await expect(
        writeAuditLog(mockClient, {
          actor: { type: '' as any, id: '' },
          action: 'test.action',
          resourceType: 'TEST',
          resourceId: '123',
        }),
      ).rejects.toThrow('AuditLog entry requires a valid actor');
    });

    it('validates action presence', async () => {
      const { mockClient } = createMockPrisma();
      await expect(
        writeAuditLog(mockClient, {
          actor: { type: 'service', id: 'api-service' },
          action: '  ',
          resourceType: 'TEST',
          resourceId: '123',
        }),
      ).rejects.toThrow('AuditLog entry requires a valid action');
    });

    it('normalizes actor types correctly (USER, SERVICE, CONNECTOR)', async () => {
      const { mockClient, createdLogs } = createMockPrisma();

      await writeAuditLog(mockClient, {
        actor: { type: 'service', id: 'cron-job' },
        action: 'payroll.draft_created',
        resourceType: 'PAYROLL_RUN',
        resourceId: 'pr-1',
      });
      expect(createdLogs[0].actorType).toBe(ActorType.SERVICE);

      await writeAuditLog(mockClient, {
        actor: { type: 'connector', id: 'qb-sync' },
        action: 'connector.sync',
        resourceType: 'CONNECTOR_QUICKBOOKS',
        resourceId: 'acc-1',
      });
      expect(createdLogs[1].actorType).toBe(ActorType.CONNECTOR);
    });
  });

  describe('Approval audit logging', () => {
    it('recordApproval writes through writeAuditLog with action, actor, before, after, timestamp', async () => {
      const { mockClient, createdLogs } = createMockPrisma();
      const testTimestamp = new Date('2025-06-01T15:30:00Z');

      await recordApproval(mockClient, {
        companyId: 'comp-100',
        actor: { type: 'user', id: 'approver-42' },
        targetType: 'INVOICE',
        targetId: 'inv-888',
        before: { status: 'SUBMITTED' },
        after: { status: 'APPROVED' },
        decisionNote: 'All line items match contract hours',
        timestamp: testTimestamp,
      });

      expect(createdLogs).toHaveLength(1);
      const entry = createdLogs[0];
      expect(entry.action).toBe('approval.approved');
      expect(entry.actorType).toBe(ActorType.USER);
      expect(entry.actorId).toBe('approver-42');
      expect(entry.resourceType).toBe('INVOICE');
      expect(entry.resourceId).toBe('inv-888');
      expect(entry.before).toEqual({ status: 'SUBMITTED' });
      expect(entry.after).toEqual({ status: 'APPROVED' });
      expect(entry.timestamp).toEqual(testTimestamp);
      expect(entry.metadata.decision).toBe('APPROVED');
      expect(entry.metadata.decisionNote).toBe('All line items match contract hours');
    });

    it('recordRejection writes through writeAuditLog with action, actor, before, after, timestamp', async () => {
      const { mockClient, createdLogs } = createMockPrisma();
      const testTimestamp = new Date('2025-06-02T10:00:00Z');

      await recordRejection(mockClient, {
        companyId: 'comp-100',
        actor: { type: 'user', id: 'manager-12' },
        targetType: 'PAYMENT_DRAFT',
        targetId: 'pd-555',
        before: { status: 'AWAITING_APPROVAL' },
        after: { status: 'REJECTED' },
        decisionNote: 'Missing contractor milestone receipt',
        timestamp: testTimestamp,
      });

      expect(createdLogs).toHaveLength(1);
      const entry = createdLogs[0];
      expect(entry.action).toBe('approval.rejected');
      expect(entry.actorType).toBe(ActorType.USER);
      expect(entry.actorId).toBe('manager-12');
      expect(entry.resourceType).toBe('PAYMENT_DRAFT');
      expect(entry.resourceId).toBe('pd-555');
      expect(entry.before).toEqual({ status: 'AWAITING_APPROVAL' });
      expect(entry.after).toEqual({ status: 'REJECTED' });
      expect(entry.timestamp).toEqual(testTimestamp);
      expect(entry.metadata.decision).toBe('REJECTED');
    });
  });

  describe('Extraction audit logging', () => {
    it('recordExtraction writes through writeAuditLog with actor, before, after, and timestamp', async () => {
      const { mockClient, createdLogs } = createMockPrisma();
      const testTimestamp = new Date('2025-06-03T08:15:00Z');

      await recordExtraction(mockClient, {
        companyId: 'comp-100',
        actor: { type: 'service', id: 'ai-ocr-extractor' },
        invoiceId: 'inv-333',
        before: { rawPdfHash: 'hash-abc', processed: false },
        after: {
          invoiceNumber: 'INV-2025-099',
          totalMinor: 50000,
          currency: 'USD',
          lineItemsCount: 2,
        },
        extractedFields: ['invoiceNumber', 'totalMinor', 'currency', 'lineItems'],
        confidenceScore: 0.98,
        timestamp: testTimestamp,
      });

      expect(createdLogs).toHaveLength(1);
      const entry = createdLogs[0];
      expect(entry.action).toBe('invoice.extracted');
      expect(entry.actorType).toBe(ActorType.SERVICE);
      expect(entry.actorId).toBe('ai-ocr-extractor');
      expect(entry.resourceType).toBe('INVOICE');
      expect(entry.resourceId).toBe('inv-333');
      expect(entry.before).toEqual({ rawPdfHash: 'hash-abc', processed: false });
      expect(entry.after.invoiceNumber).toBe('INV-2025-099');
      expect(entry.timestamp).toEqual(testTimestamp);
      expect(entry.metadata.confidenceScore).toBe(0.98);
      expect(entry.metadata.extractedFields).toContain('invoiceNumber');
    });
  });

  describe('Connector sync audit logging', () => {
    it('recordConnectorSync writes through writeAuditLog with actor, before, after, and timestamp', async () => {
      const { mockClient, createdLogs } = createMockPrisma();
      const testTimestamp = new Date('2025-06-04T04:00:00Z');

      await recordConnectorSync(mockClient, {
        companyId: 'comp-100',
        actor: { type: 'connector', id: 'quickbooks-sync-worker' },
        provider: 'QUICKBOOKS',
        connectorAccountId: 'qb-realm-9876',
        before: { lastSyncedAt: '2025-06-03T04:00:00Z', totalAccounts: 12 },
        after: { lastSyncedAt: '2025-06-04T04:00:00Z', totalAccounts: 14 },
        syncType: 'daily_delta',
        status: 'SUCCESS',
        syncedRecordsCount: 24,
        timestamp: testTimestamp,
      });

      expect(createdLogs).toHaveLength(1);
      const entry = createdLogs[0];
      expect(entry.action).toBe('connector.sync');
      expect(entry.actorType).toBe(ActorType.CONNECTOR);
      expect(entry.actorId).toBe('quickbooks-sync-worker');
      expect(entry.resourceType).toBe('CONNECTOR_QUICKBOOKS');
      expect(entry.resourceId).toBe('qb-realm-9876');
      expect(entry.before.totalAccounts).toBe(12);
      expect(entry.after.totalAccounts).toBe(14);
      expect(entry.timestamp).toEqual(testTimestamp);
      expect(entry.metadata.provider).toBe('QUICKBOOKS');
      expect(entry.metadata.status).toBe('SUCCESS');
      expect(entry.metadata.syncedRecordsCount).toBe(24);
    });
  });
});
