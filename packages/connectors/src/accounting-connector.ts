import { z } from 'zod';
import type { ConnectorProvider } from '@paypilot/core';

// ---------------------------------------------------------------------------
// 1. OAuth & Connection Schemas
// ---------------------------------------------------------------------------

export const OAuthTokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  tokenType: z.string().default('Bearer'),
  expiresAt: z.number().int().positive().optional(), // epoch ms
  expiresInSeconds: z.number().int().positive().optional(),
  scope: z.string().optional(),
  tenantId: z.string().optional(), // e.g. Xero Tenant ID or NetSuite Account ID
  rawPayload: z.record(z.unknown()).optional(),
});

export type OAuthTokens = z.infer<typeof OAuthTokensSchema>;

export const ConnectInputSchema = z.object({
  code: z.string().optional(),
  redirectUri: z.string().optional(),
  refreshToken: z.string().optional(),
  tenantId: z.string().optional(),
  tokens: OAuthTokensSchema.optional(),
  credentials: z.record(z.string()).optional(),
});

export type ConnectInput = z.infer<typeof ConnectInputSchema>;

export const ConnectResultSchema = z.object({
  connected: z.boolean(),
  provider: z.string(),
  externalAccountId: z.string(),
  tenantName: z.string().optional(),
  tokens: OAuthTokensSchema,
});

export type ConnectResult = z.infer<typeof ConnectResultSchema>;

// ---------------------------------------------------------------------------
// 2. Vendor Schemas
// ---------------------------------------------------------------------------

export const VendorBankDetailsSchema = z.object({
  accountName: z.string().optional(),
  accountNumber: z.string().optional(),
  routingNumber: z.string().optional(),
  iban: z.string().optional(),
  bic: z.string().optional(),
  bankName: z.string().optional(),
});

export type VendorBankDetails = z.infer<typeof VendorBankDetailsSchema>;

export const VendorRecordSchema = z.object({
  id: z.string().min(1), // external provider ID
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  taxId: z.string().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  bankDetails: VendorBankDetailsSchema.optional(),
  externalReference: z.string().optional(), // internal PayPilot contractor ID
  isActive: z.boolean().default(true),
  updatedAt: z.string().optional(),
});

export type VendorRecord = z.infer<typeof VendorRecordSchema>;

export const UpsertVendorInputSchema = z.object({
  id: z.string().optional(), // external ID if updating
  name: z.string().min(1),
  email: z.string().email().optional(),
  taxId: z.string().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  bankDetails: VendorBankDetailsSchema.optional(),
  externalReference: z.string().min(1), // paypilot contractor ID
  idempotencyKey: z.string().min(8),
});

export type UpsertVendorInput = z.infer<typeof UpsertVendorInputSchema>;

export const ListVendorsFilterSchema = z.object({
  search: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(50).optional(),
  cursor: z.string().optional(),
  page: z.number().int().min(1).default(1).optional(),
});

export type ListVendorsFilter = z.infer<typeof ListVendorsFilterSchema>;

export const VendorListResultSchema = z.object({
  vendors: z.array(VendorRecordSchema),
  hasMore: z.boolean(),
  nextCursor: z.string().optional(),
  totalCount: z.number().int().optional(),
});

export type VendorListResult = z.infer<typeof VendorListResultSchema>;

// ---------------------------------------------------------------------------
// 3. Bill / Accounts Payable Schemas
// ---------------------------------------------------------------------------

export const BillLineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive().default(1),
  unitPriceMinor: z.number().int().nonnegative(),
  amountMinor: z.number().int().nonnegative(),
  accountCode: z.string().optional(),
  taxRate: z.number().nonnegative().optional(),
  taxAmountMinor: z.number().int().nonnegative().default(0).optional(),
});

export type BillLineItem = z.infer<typeof BillLineItemSchema>;

export const CreateBillInputSchema = z.object({
  vendorId: z.string().min(1), // external vendor ID in accounting system
  invoiceNumber: z.string().min(1),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/), // YYYY-MM-DD
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  lineItems: z.array(BillLineItemSchema).min(1),
  subtotalMinor: z.number().int().nonnegative(),
  taxMinor: z.number().int().nonnegative().default(0).optional(),
  totalMinor: z.number().int().positive(),
  notes: z.string().optional(),
  idempotencyKey: z.string().min(8),
  externalReference: z.string().optional(), // PayPilot invoiceId
});

export type CreateBillInput = z.infer<typeof CreateBillInputSchema>;

export const BillRecordSchema = z.object({
  id: z.string().min(1), // external bill/invoice ID
  billNumber: z.string(),
  vendorId: z.string(),
  status: z.enum(['DRAFT', 'AUTHORISED', 'PAID', 'VOID']),
  totalMinor: z.number().int(),
  currency: z.string(),
  dueDate: z.string(),
  externalReference: z.string().optional(),
  createdAt: z.string().optional(),
});

export type BillRecord = z.infer<typeof BillRecordSchema>;

// ---------------------------------------------------------------------------
// 4. Payment Recording Schemas
// ---------------------------------------------------------------------------

export const MarkBillPaidInputSchema = z.object({
  billId: z.string().min(1), // external bill ID
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  amountMinor: z.number().int().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  paymentAccountId: z.string().optional(), // external bank/clearing account
  reference: z.string().optional(),
  idempotencyKey: z.string().min(8),
});

export type MarkBillPaidInput = z.infer<typeof MarkBillPaidInputSchema>;

export const BillPaymentRecordSchema = z.object({
  id: z.string().min(1), // external payment ID
  billId: z.string(),
  amountMinor: z.number().int(),
  currency: z.string(),
  paymentDate: z.string(),
  status: z.enum(['RECORDED', 'RECONCILED', 'FAILED']),
  reference: z.string().optional(),
});

export type BillPaymentRecord = z.infer<typeof BillPaymentRecordSchema>;

// ---------------------------------------------------------------------------
// 5. Chart of Accounts Schemas
// ---------------------------------------------------------------------------

export const AccountTypeSchema = z.enum([
  'EXPENSE',
  'BANK',
  'CURRENT_LIABILITY',
  'FIXED_ASSET',
  'CURRENT_ASSET',
  'EQUITY',
  'REVENUE',
  'OTHER',
]);

export type AccountType = z.infer<typeof AccountTypeSchema>;

export const AccountRecordSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  type: AccountTypeSchema,
  currency: z.string().optional(),
  isActive: z.boolean().default(true),
});

export type AccountRecord = z.infer<typeof AccountRecordSchema>;

export const ListAccountsFilterSchema = z.object({
  type: AccountTypeSchema.optional(),
  isActive: z.boolean().optional(),
});

export type ListAccountsFilter = z.infer<typeof ListAccountsFilterSchema>;

export const AccountListResultSchema = z.object({
  accounts: z.array(AccountRecordSchema),
  totalCount: z.number().int().optional(),
});

export type AccountListResult = z.infer<typeof AccountListResultSchema>;

// ---------------------------------------------------------------------------
// 6. Sync Status Schema
// ---------------------------------------------------------------------------

export const SyncStatusResultSchema = z.object({
  provider: z.string(),
  status: z.enum(['CONNECTED', 'DISCONNECTED', 'ERROR', 'RATE_LIMITED']),
  externalAccountId: z.string(),
  tenantName: z.string().optional(),
  lastSyncedAt: z.string().optional(),
  rateLimitRemaining: z.number().int().optional(),
  rateLimitResetAt: z.string().optional(),
  errors: z.array(z.string()).default([]),
});

export type SyncStatusResult = z.infer<typeof SyncStatusResultSchema>;

export const executePaymentInputSchema = z.object({
  paymentDraftId: z.string().uuid(),
  idempotencyKey: z.string().min(8),
  companyId: z.string().uuid(),
  amountMinor: z.number().int().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  destination: z.string().min(1),
});

export type ExecutePaymentInput = z.infer<typeof executePaymentInputSchema>;
export type PaymentExecutionStatus = 'submitted' | 'failed';

export interface PaymentExecutionResult {
  paymentDraftId: ExecutePaymentInput['paymentDraftId'];
  status: PaymentExecutionStatus;
  externalTransactionId?: string;
  errorCode?: string;
}

// ---------------------------------------------------------------------------
// 7. Full AccountingConnector Interface
// ---------------------------------------------------------------------------

export interface AccountingConnector {
  readonly provider: ConnectorProvider;

  /**
   * Connect or refresh OAuth credentials with the accounting provider.
   */
  connect(input: ConnectInput): Promise<ConnectResult>;

  /**
   * List contacts/vendors from the external accounting system.
   */
  listVendors(filter?: ListVendorsFilter): Promise<VendorListResult>;

  /**
   * Creates or updates a vendor/contact. Idempotent by idempotencyKey and externalReference.
   */
  upsertVendor(vendor: UpsertVendorInput): Promise<VendorRecord>;

  /**
   * Creates an accounts payable bill from an approved PayPilot invoice.
   */
  createBill(bill: CreateBillInput): Promise<BillRecord>;

  /**
   * Records a bill payment in the accounting system.
   */
  markBillPaid(input: MarkBillPaidInput): Promise<BillPaymentRecord>;

  /**
   * Lists the Chart of Accounts (expense accounts, bank accounts).
   */
  listAccounts(filter?: ListAccountsFilter): Promise<AccountListResult>;

  /**
   * Checks real-time connection health, token expiry, and rate limits.
   */
  getSyncStatus(externalAccountId: string): Promise<SyncStatusResult>;

  /**
   * Execute an approved payment draft (optional money movement adapter).
   */
  executePayment?(input: ExecutePaymentInput): Promise<PaymentExecutionResult>;
}
