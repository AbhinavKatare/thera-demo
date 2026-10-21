import type { ConnectorProvider } from '@paypilot/core';
import {
  type AccountingConnector,
  type UpsertVendorInput,
  type CreateBillInput,
  type MarkBillPaidInput,
  type VendorRecord,
  type BillRecord,
  type BillPaymentRecord,
} from './accounting-connector.js';

export interface FieldMappingConfig {
  defaultExpenseAccountCode: string;
  defaultBankAccountId?: string;
  defaultTaxRate?: number;
  currencyOverrides?: Record<string, string>;
  vendorPrefix?: string;
}

export interface SyncContractorInput {
  id: string; // contractor ID in PayPilot
  name: string;
  email?: string;
  taxId?: string;
  currency: string;
  bankDetails?: {
    accountName?: string;
    accountNumber?: string;
    routingNumber?: string;
    iban?: string;
    bic?: string;
  };
}

export interface SyncInvoiceInput {
  id: string; // invoice ID in PayPilot
  invoiceNumber: string;
  contractorId: string;
  issueDate: string; // YYYY-MM-DD
  dueDate: string;
  currency: string;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPriceMinor: number;
    amountMinor: number;
    accountCode?: string;
  }>;
  notes?: string;
}

export interface SyncPaymentInput {
  paymentDraftId: string;
  invoiceId: string;
  billId: string;
  amountMinor: number;
  currency: string;
  paidDate: string;
  reference?: string;
}

export interface ConflictRecord {
  id: string;
  companyId: string;
  provider: ConnectorProvider;
  entityType: 'vendor' | 'bill' | 'payment';
  entityId: string; // internal ID
  externalId?: string;
  conflictType: 'DATA_MISMATCH' | 'CURRENCY_MISMATCH' | 'DUPLICATE_NUMBER' | 'AMOUNT_MISMATCH';
  message: string;
  localData: Record<string, unknown>;
  remoteData?: Record<string, unknown>;
  detectedAt: string;
}

export interface SyncEngineOptions {
  mappingConfig?: Partial<FieldMappingConfig>;
  maxRetries?: number;
  baseDelayMs?: number;
}

export class SharedSyncEngine {
  private readonly mappingConfig: FieldMappingConfig;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;

  /** Cache of completed operations by idempotency key */
  private readonly idempotencyCache = new Map<string, unknown>();

  /** List of detected conflict records */
  private readonly conflicts: ConflictRecord[] = [];

  constructor(options: SyncEngineOptions = {}) {
    this.mappingConfig = {
      defaultExpenseAccountCode: options.mappingConfig?.defaultExpenseAccountCode ?? 'EXP-400',
      defaultTaxRate: options.mappingConfig?.defaultTaxRate ?? 0,
      vendorPrefix: options.mappingConfig?.vendorPrefix ?? '',
      ...options.mappingConfig,
    };
    this.maxRetries = options.maxRetries ?? 3;
    this.baseDelayMs = options.baseDelayMs ?? 100;
  }

  /**
   * Executes an operation with exponential backoff, jitter, and HTTP 429 rate limit respect.
   */
  public async executeWithRetry<T>(operation: () => Promise<T>, opName: string = 'sync_operation'): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (err: any) {
        lastError = err;

        // Check if retryable (429, 502, 503, 504, network error)
        const status = err.status ?? err.statusCode;
        const isRateLimit = status === 429;
        const isServerError = status >= 500 && status <= 504;
        const isNetwork = err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT';

        if (attempt === this.maxRetries || (!isRateLimit && !isServerError && !isNetwork)) {
          throw err;
        }

        // Calculate backoff
        let delayMs = this.baseDelayMs * Math.pow(2, attempt) + Math.random() * 50;
        if (isRateLimit && err.retryAfterSeconds) {
          delayMs = Math.max(delayMs, err.retryAfterSeconds * 1000);
        }

        await new Promise((res) => setTimeout(res, delayMs));
      }
    }

    throw lastError;
  }

  /**
   * Syncs a contractor to an accounting vendor record.
   * Performs conflict detection and applies field mapping.
   */
  public async syncVendor(
    connector: AccountingConnector,
    companyId: string,
    contractor: SyncContractorInput,
  ): Promise<{ vendor: VendorRecord; isNew: boolean; conflict?: ConflictRecord }> {
    const idempotencyKey = `sync-vendor-${companyId}-${contractor.id}`;

    // Check idempotency cache
    const cached = this.idempotencyCache.get(idempotencyKey);
    if (cached) {
      return cached as { vendor: VendorRecord; isNew: boolean };
    }

    // 1. Check existing remote vendors to detect duplicates or conflicts
    const remoteList = await this.executeWithRetry(
      () => connector.listVendors({ search: contractor.name }),
      'list_vendors_check',
    );

    const existingMatch = remoteList.vendors.find(
      (v) =>
        v.externalReference === contractor.id ||
        v.name.toLowerCase() === contractor.name.toLowerCase() ||
        (contractor.email && v.email && v.email.toLowerCase() === contractor.email.toLowerCase()),
    );

    let conflict: ConflictRecord | undefined;

    if (existingMatch) {
      // Check for conflict (e.g. taxId mismatch or currency mismatch)
      if (contractor.taxId && existingMatch.taxId && contractor.taxId !== existingMatch.taxId) {
        conflict = {
          id: `conf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          companyId,
          provider: connector.provider,
          entityType: 'vendor',
          entityId: contractor.id,
          externalId: existingMatch.id,
          conflictType: 'DATA_MISMATCH',
          message: `Tax ID mismatch for vendor '${contractor.name}': PayPilot=${contractor.taxId}, Accounting=${existingMatch.taxId}`,
          localData: contractor as unknown as Record<string, unknown>,
          remoteData: existingMatch as unknown as Record<string, unknown>,
          detectedAt: new Date().toISOString(),
        };
        this.conflicts.push(conflict);
      }
    }

    // 2. Field Mapping: Map contractor to vendor input
    const vendorInput: UpsertVendorInput = {
      id: existingMatch?.id,
      name: `${this.mappingConfig.vendorPrefix}${contractor.name}`,
      email: contractor.email,
      taxId: contractor.taxId,
      currency: this.mappingConfig.currencyOverrides?.[contractor.currency] ?? contractor.currency,
      bankDetails: contractor.bankDetails,
      externalReference: contractor.id,
      idempotencyKey,
    };

    // 3. Upsert via connector with retry
    const vendor = await this.executeWithRetry(
      () => connector.upsertVendor(vendorInput),
      `upsert_vendor_${contractor.id}`,
    );

    const result = { vendor, isNew: !existingMatch, conflict };
    this.idempotencyCache.set(idempotencyKey, result);
    return result;
  }

  /**
   * Syncs an approved PayPilot invoice to an accounts payable bill.
   */
  public async syncInvoiceToBill(
    connector: AccountingConnector,
    companyId: string,
    invoice: SyncInvoiceInput,
    externalVendorId: string,
  ): Promise<{ bill: BillRecord; conflict?: ConflictRecord }> {
    const idempotencyKey = `sync-bill-${companyId}-${invoice.id}-${invoice.totalMinor}`;

    const cached = this.idempotencyCache.get(idempotencyKey);
    if (cached) {
      return cached as { bill: BillRecord };
    }

    // 1. Field Mapping: Map line items with default expense accounts
    const mappedLineItems = invoice.lineItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPriceMinor: item.unitPriceMinor,
      amountMinor: item.amountMinor,
      accountCode: item.accountCode ?? this.mappingConfig.defaultExpenseAccountCode,
      taxRate: this.mappingConfig.defaultTaxRate,
    }));

    const billInput: CreateBillInput = {
      vendorId: externalVendorId,
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate.slice(0, 10),
      dueDate: invoice.dueDate.slice(0, 10),
      currency: this.mappingConfig.currencyOverrides?.[invoice.currency] ?? invoice.currency,
      lineItems: mappedLineItems,
      subtotalMinor: invoice.subtotalMinor,
      taxMinor: invoice.taxMinor,
      totalMinor: invoice.totalMinor,
      notes: invoice.notes,
      idempotencyKey,
      externalReference: invoice.id,
    };

    // 2. Create bill with retry
    const bill = await this.executeWithRetry(
      () => connector.createBill(billInput),
      `create_bill_${invoice.invoiceNumber}`,
    );

    // Conflict check on amounts
    let conflict: ConflictRecord | undefined;
    if (bill.totalMinor !== invoice.totalMinor) {
      conflict = {
        id: `conf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        companyId,
        provider: connector.provider,
        entityType: 'bill',
        entityId: invoice.id,
        externalId: bill.id,
        conflictType: 'AMOUNT_MISMATCH',
        message: `Total amount mismatch for bill '${invoice.invoiceNumber}': PayPilot=${invoice.totalMinor}, Accounting=${bill.totalMinor}`,
        localData: invoice as unknown as Record<string, unknown>,
        remoteData: bill as unknown as Record<string, unknown>,
        detectedAt: new Date().toISOString(),
      };
      this.conflicts.push(conflict);
    }

    const result = { bill, conflict };
    this.idempotencyCache.set(idempotencyKey, result);
    return result;
  }

  /**
   * Syncs payment execution by marking an accounting bill as paid.
   */
  public async syncPayment(
    connector: AccountingConnector,
    companyId: string,
    payment: SyncPaymentInput,
  ): Promise<BillPaymentRecord> {
    const idempotencyKey = `sync-pay-${companyId}-${payment.paymentDraftId}`;

    const cached = this.idempotencyCache.get(idempotencyKey);
    if (cached) {
      return cached as BillPaymentRecord;
    }

    const markPaidInput: MarkBillPaidInput = {
      billId: payment.billId,
      paymentDate: payment.paidDate.slice(0, 10),
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      paymentAccountId: this.mappingConfig.defaultBankAccountId,
      reference: payment.reference ?? `PayPilot draft ${payment.paymentDraftId.slice(0, 8)}`,
      idempotencyKey,
    };

    const paymentRecord = await this.executeWithRetry(
      () => connector.markBillPaid(markPaidInput),
      `mark_paid_${payment.billId}`,
    );

    this.idempotencyCache.set(idempotencyKey, paymentRecord);
    return paymentRecord;
  }

  public getConflicts(companyId?: string): ConflictRecord[] {
    if (!companyId) return this.conflicts;
    return this.conflicts.filter((c) => c.companyId === companyId);
  }

  public clearConflicts(): void {
    this.conflicts.length = 0;
  }
}
