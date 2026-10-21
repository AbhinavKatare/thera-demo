import type { ConnectorProvider } from '@paypilot/core';
import {
  type AccountingConnector,
  type ConnectInput,
  type ConnectResult,
  type ListVendorsFilter,
  type VendorListResult,
  type UpsertVendorInput,
  type VendorRecord,
  type CreateBillInput,
  type BillRecord,
  type MarkBillPaidInput,
  type BillPaymentRecord,
  type ListAccountsFilter,
  type AccountListResult,
  type SyncStatusResult,
  type ExecutePaymentInput,
  type PaymentExecutionResult,
} from './accounting-connector.js';
import { XeroConnector } from './xero/xero-connector.js';
import { ZohoBooksConnector } from './zoho/zoho-connector.js';
import { NetSuiteConnector } from './netsuite/netsuite-connector.js';

export * from './payroll-provider.js';
export * from './circuit-breaker.js';
export * from './thera-provider.js';
export * from './accounting-connector.js';
export * from './sync-engine.js';
export * from './token-store.js';
export * from './xero/xero-connector.js';
export * from './zoho/zoho-connector.js';
export * from './netsuite/netsuite-connector.js';
export * from './netsuite/netsuite-mock-server.js';

// ---------------------------------------------------------------------------
// Mock Accounting Connector (free/local dev + CI tests)
// ---------------------------------------------------------------------------

export class MockAccountingConnector implements AccountingConnector {
  readonly provider: ConnectorProvider = 'mock';

  private readonly executedPayments = new Map<string, PaymentExecutionResult>();
  private readonly vendors = new Map<string, VendorRecord>();
  private readonly bills = new Map<string, BillRecord>();
  private readonly payments = new Map<string, BillPaymentRecord>();
  private readonly accounts = new Map<string, any>();

  constructor(
    /** Destination value that forces a deterministic failure in tests. */
    private readonly failOnDestination = 'fail-me',
  ) {
    // Seed default mock chart of accounts
    this.accounts.set('400', {
      id: 'acc-400',
      code: '400',
      name: 'Contractor Expense',
      type: 'EXPENSE',
      isActive: true,
    });
    this.accounts.set('090', {
      id: 'acc-090',
      code: '090',
      name: 'Business Checking',
      type: 'BANK',
      isActive: true,
    });
  }

  async connect(input: ConnectInput): Promise<ConnectResult> {
    return {
      connected: true,
      provider: 'mock',
      externalAccountId: input.tenantId ?? 'mock-tenant-001',
      tenantName: 'Mock Accounting Sandbox',
      tokens: {
        accessToken: 'mock-access-token-123',
        tokenType: 'Bearer',
        expiresAt: Date.now() + 3600_000,
      },
    };
  }

  async listVendors(filter?: ListVendorsFilter): Promise<VendorListResult> {
    let list = Array.from(this.vendors.values());
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter((v) => v.name.toLowerCase().includes(q));
    }
    return {
      vendors: list,
      hasMore: false,
      totalCount: list.length,
    };
  }

  async upsertVendor(input: UpsertVendorInput): Promise<VendorRecord> {
    const id = input.id ?? `v-${this.vendors.size + 101}`;
    const record: VendorRecord = {
      id,
      name: input.name,
      email: input.email,
      taxId: input.taxId,
      currency: input.currency,
      bankDetails: input.bankDetails,
      externalReference: input.externalReference,
      isActive: true,
      updatedAt: new Date().toISOString(),
    };
    this.vendors.set(id, record);
    return record;
  }

  async createBill(input: CreateBillInput): Promise<BillRecord> {
    const id = `bill-${this.bills.size + 201}`;
    const record: BillRecord = {
      id,
      billNumber: input.invoiceNumber,
      vendorId: input.vendorId,
      status: 'AUTHORISED',
      totalMinor: input.totalMinor,
      currency: input.currency,
      dueDate: input.dueDate,
      externalReference: input.externalReference,
      createdAt: new Date().toISOString(),
    };
    this.bills.set(id, record);
    return record;
  }

  async markBillPaid(input: MarkBillPaidInput): Promise<BillPaymentRecord> {
    const id = `pay-${this.payments.size + 301}`;
    const record: BillPaymentRecord = {
      id,
      billId: input.billId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      paymentDate: input.paymentDate,
      status: 'RECORDED',
      reference: input.reference,
    };
    this.payments.set(id, record);
    return record;
  }

  async listAccounts(filter?: ListAccountsFilter): Promise<AccountListResult> {
    let list = Array.from(this.accounts.values());
    if (filter?.type) {
      list = list.filter((a) => a.type === filter.type);
    }
    return {
      accounts: list,
      totalCount: list.length,
    };
  }

  async getSyncStatus(externalAccountId: string): Promise<SyncStatusResult> {
    return {
      provider: 'mock',
      status: 'CONNECTED',
      externalAccountId,
      tenantName: 'Mock Accounting Sandbox',
      lastSyncedAt: new Date().toISOString(),
      errors: [],
    };
  }

  async executePayment(input: ExecutePaymentInput): Promise<PaymentExecutionResult> {
    const existing = this.executedPayments.get(input.idempotencyKey);
    if (existing !== undefined) {
      return existing;
    }

    const result: PaymentExecutionResult =
      input.destination === this.failOnDestination
        ? {
            paymentDraftId: input.paymentDraftId,
            status: 'failed',
            errorCode: 'test_forced_failure',
          }
        : {
            paymentDraftId: input.paymentDraftId,
            status: 'submitted',
            externalTransactionId: `mock-txn-${input.idempotencyKey}`,
          };

    this.executedPayments.set(input.idempotencyKey, result);
    return result;
  }

  hasResultFor(idempotencyKey: string): boolean {
    return this.executedPayments.has(idempotencyKey);
  }
}

/** Backward compatibility alias */
export { MockAccountingConnector as MockConnector };

/**
 * Registry of accounting connector factories.
 */
export function getConnector(provider: ConnectorProvider): AccountingConnector {
  switch (provider) {
    case 'xero':
      return new XeroConnector();
    case 'zoho':
      return new ZohoBooksConnector();
    case 'netsuite':
      return new NetSuiteConnector();
    case 'mock':
    case 'quickbooks':
    default:
      return new MockAccountingConnector();
  }
}
