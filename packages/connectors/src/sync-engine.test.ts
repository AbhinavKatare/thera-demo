import { describe, expect, it, vi } from 'vitest';
import { SharedSyncEngine } from './sync-engine.js';
import { MockAccountingConnector } from './index.js';

describe('SharedSyncEngine', () => {
  const companyId = 'c0000000-0000-0000-0000-000000000001';

  it('syncs contractor to vendor with field mapping and idempotency caching', async () => {
    const connector = new MockAccountingConnector();
    const syncEngine = new SharedSyncEngine({
      mappingConfig: {
        vendorPrefix: '[PayPilot] ',
        defaultExpenseAccountCode: 'EXP-500',
      },
    });

    const contractor = {
      id: 'ctr-001',
      name: 'Sofia Rossi',
      email: 'sofia@rossi.it',
      taxId: 'IT-12345678901',
      currency: 'EUR',
      bankDetails: { iban: 'IT60X0542811101000000123456' },
    };

    // First sync
    const firstSync = await syncEngine.syncVendor(connector, companyId, contractor);
    expect(firstSync.isNew).toBe(true);
    expect(firstSync.vendor.name).toBe('[PayPilot] Sofia Rossi');
    expect(firstSync.vendor.taxId).toBe('IT-12345678901');

    // Second sync: should return cached result immediately via idempotency key
    const spy = vi.spyOn(connector, 'upsertVendor');
    const secondSync = await syncEngine.syncVendor(connector, companyId, contractor);
    expect(secondSync.vendor.id).toBe(firstSync.vendor.id);
    expect(spy).not.toHaveBeenCalled();
  });

  it('syncs invoice to bill with line items, account code mapping, and idempotency', async () => {
    const connector = new MockAccountingConnector();
    const syncEngine = new SharedSyncEngine({
      mappingConfig: {
        defaultExpenseAccountCode: '400',
        defaultTaxRate: 0.1,
      },
    });

    // 1. Create vendor
    const { vendor } = await syncEngine.syncVendor(connector, companyId, {
      id: 'ctr-002',
      name: 'DevCorp Poland',
      currency: 'USD',
    });

    // 2. Sync invoice to bill
    const invoice = {
      id: 'inv-uuid-001',
      invoiceNumber: 'INV-2026-PL1',
      contractorId: 'ctr-002',
      issueDate: '2026-10-20',
      dueDate: '2026-11-04',
      currency: 'USD',
      subtotalMinor: 500_000,
      taxMinor: 50_000,
      totalMinor: 550_000,
      lineItems: [
        {
          description: 'Fullstack engineering sprint',
          quantity: 1,
          unitPriceMinor: 500_000,
          amountMinor: 500_000,
        },
      ],
    };

    const billResult = await syncEngine.syncInvoiceToBill(connector, companyId, invoice, vendor.id);
    expect(billResult.bill.billNumber).toBe('INV-2026-PL1');
    expect(billResult.bill.totalMinor).toBe(550_000);
    expect(billResult.bill.status).toBe('AUTHORISED');

    // 3. Mark payment
    const payment = await syncEngine.syncPayment(connector, companyId, {
      paymentDraftId: 'draft-001',
      invoiceId: invoice.id,
      billId: billResult.bill.id,
      amountMinor: 550_000,
      currency: 'USD',
      paidDate: '2026-10-20',
      reference: 'Wire Ref #8899',
    });
    expect(payment.status).toBe('RECORDED');
    expect(payment.amountMinor).toBe(550_000);
  });

  it('detects and logs conflicts when remote data differs from local contractor data', async () => {
    const connector = new MockAccountingConnector();
    const syncEngine = new SharedSyncEngine();

    // Seed existing vendor in accounting with different taxId
    await connector.upsertVendor({
      name: 'Existing Contractor Corp',
      taxId: 'OLD-TAX-ID-111',
      currency: 'USD',
      externalReference: 'ctr-conflict-01',
      idempotencyKey: 'seed-idemp',
    });

    // Attempt sync with new/mismatched taxId
    const result = await syncEngine.syncVendor(connector, companyId, {
      id: 'ctr-conflict-01',
      name: 'Existing Contractor Corp',
      taxId: 'NEW-TAX-ID-999', // Mismatch!
      currency: 'USD',
    });

    expect(result.conflict).toBeDefined();
    expect(result.conflict?.conflictType).toBe('DATA_MISMATCH');
    expect(result.conflict?.message).toContain('Tax ID mismatch');

    const allConflicts = syncEngine.getConflicts(companyId);
    expect(allConflicts.length).toBe(1);
    expect(allConflicts[0]?.entityType).toBe('vendor');
  });

  it('retries transient failures with exponential backoff and jitter', async () => {
    const syncEngine = new SharedSyncEngine({ maxRetries: 3, baseDelayMs: 10 });

    let callCount = 0;
    const flakyOperation = async () => {
      callCount++;
      if (callCount < 3) {
        const error = new Error('Rate limit exceeded');
        (error as any).statusCode = 429;
        (error as any).retryAfterSeconds = 0.01;
        throw error;
      }
      return 'success_after_retry';
    };

    const res = await syncEngine.executeWithRetry(flakyOperation, 'test_retry_op');
    expect(res).toBe('success_after_retry');
    expect(callCount).toBe(3);
  });
});
