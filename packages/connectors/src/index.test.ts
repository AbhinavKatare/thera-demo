import { describe, expect, it } from 'vitest';
import { executePaymentInputSchema, getConnector, MockConnector } from './index.js';

const COMPANY_ID = '51665823-2115-4c03-b597-3f01df5a7f0f';
const DRAFT_ID = '755068b6-a0b6-4cdd-bdc6-30c2687fae9e';

const validInput = executePaymentInputSchema.parse({
  paymentDraftId: DRAFT_ID,
  idempotencyKey: 'idemp-key-0001',
  companyId: COMPANY_ID,
  amountMinor: 200000,
  currency: 'USD',
  destination: 'acct_9fja83',
});

describe('MockConnector', () => {
  it('reports a submitted transaction on execute', async () => {
    const connector = new MockConnector();
    const result = await connector.executePayment(validInput);
    expect(result.status).toBe('submitted');
    expect(result.externalTransactionId).toMatch(/^mock-txn-/);
  });

  it('is idempotent by idempotency key', async () => {
    const connector = new MockConnector();
    const first = await connector.executePayment(validInput);
    const second = await connector.executePayment({ ...validInput, amountMinor: 1 });
    expect(second).toStrictEqual(first);
    expect(connector.hasResultFor(validInput.idempotencyKey)).toBe(true);
  });

  it('surfaces deterministic failures', async () => {
    const connector = new MockConnector();
    const result = await connector.executePayment({ ...validInput, destination: 'fail-me' });
    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('test_forced_failure');
  });

  it('getConnector falls back to a working mock-backed connector for unimplemented providers', async () => {
    for (const provider of ['mock', 'quickbooks', 'xero'] as const) {
      const connector = getConnector(provider);
      const result = await connector.executePayment!(validInput);
      expect(result.status).toBe('submitted');
    }
  });
});
