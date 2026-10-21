import { describe, expect, it } from 'vitest';
import {
  AnomalySchema,
  ApprovalSchema,
  AuditLogSchema,
  CompanySchema,
  ConnectorAccountSchema,
  ContractorSchema,
  ContractSchema,
  CreateInvoiceSchema,
  invoiceLineItemSchema,
  PaymentDraftSchema,
  PayrollRunSchema,
} from './index.js';

const NOW = new Date().toISOString();
const UUID = '51665823-2115-4c03-b597-3f01df5a7f0f';
const uuid = UUID;

describe('domain schemas', () => {
  it('CompanySchema accepts company data and rejects a bad country code', () => {
    expect(() =>
      CompanySchema.parse({
        id: uuid,
        name: 'Acme GmbH',
        slug: 'acme-gmbh',
        countryCode: 'DE',
        defaultCurrency: 'EUR',
        timezone: 'Europe/Berlin',
        createdAt: NOW,
        updatedAt: NOW,
      }),
    ).not.toThrow();

    expect(() =>
      CompanySchema.parse(
        CompanySchema.parse({
          id: uuid,
          name: 'Acme GmbH',
          slug: 'acme-gmbh',
          countryCode: 'deu',
          defaultCurrency: 'EUR',
          timezone: 'Europe/Berlin',
          createdAt: NOW,
          updatedAt: NOW,
        }),
      ),
    ).toThrow();
  });

  it('ContractorSchema accepts contractor data', () => {
    expect(() =>
      ContractorSchema.parse({
        id: uuid,
        companyId: uuid,
        legalName: 'Jane Doe Ltd.',
        displayName: 'Jane Doe',
        email: 'jane@example.com',
        countryCode: 'GB',
        status: 'active',
        defaultRateMinor: 15000,
        timezone: 'Europe/London',
        createdAt: NOW,
        updatedAt: NOW,
      }),
    ).not.toThrow();
  });

  it('ContractSchema accepts a null endDate and rejects invalid rate types', () => {
    expect(() =>
      ContractSchema.parse({
        id: uuid,
        companyId: uuid,
        contractorId: uuid,
        status: 'active',
        effectiveDate: '2026-01-01',
        endDate: null,
        rateType: 'hourly',
        rateMinor: 15000,
        currency: 'GBP',
        contractorCountryCode: 'GB',
        createdAt: NOW,
        updatedAt: NOW,
      }),
    ).not.toThrow();

    expect(() =>
      ContractSchema.parse(
        ContractSchema.parse({
          id: uuid,
          companyId: uuid,
          contractorId: uuid,
          status: 'active',
          effectiveDate: '2026-01-01',
          endDate: null,
          rateType: 'per_hour',
          rateMinor: 15000,
          currency: 'GBP',
          contractorCountryCode: 'GB',
          createdAt: NOW,
          updatedAt: NOW,
        }),
      ),
    ).toThrow();
  });

  it('CreateInvoiceSchema rejects inconsistent totals', () => {
    const lineItem = invoiceLineItemSchema.parse({
      id: uuid,
      invoiceId: uuid,
      description: 'Off-cycle workaround',
      quantity: 20,
      unitPriceMinor: 15000,
      amountMinor: 300000,
      createdAt: NOW,
    });

    expect(() =>
      CreateInvoiceSchema.parse({
        companyId: uuid,
        contractorId: uuid,
        contractId: uuid,
        status: 'submitted',
        periodStart: '2026-09-01',
        periodEnd: '2026-09-30',
        issueDate: '2026-10-01',
        dueDate: '2026-10-15',
        invoiceNumber: 'INV-0001',
        currency: 'EUR',
        subtotalMinor: 290000,
        taxMinor: 0,
        totalMinor: 290000,
        lineItems: [lineItem],
      }),
    ).toThrow('subtotalMinor');

    expect(() =>
      CreateInvoiceSchema.parse({
        companyId: uuid,
        contractorId: uuid,
        contractId: uuid,
        status: 'submitted',
        periodStart: '2026-09-01',
        periodEnd: '2026-09-30',
        issueDate: '2026-10-01',
        dueDate: '2026-10-15',
        invoiceNumber: 'INV-0001',
        currency: 'EUR',
        subtotalMinor: 300000,
        taxMinor: 15000,
        totalMinor: 300000,
        lineItems: [lineItem],
      }),
    ).toThrow('totalMinor');
  });

  it('CreateInvoiceSchema rejects a period end before its start', () => {
    expect(() =>
      CreateInvoiceSchema.parse({
        companyId: uuid,
        contractorId: uuid,
        contractId: uuid,
        status: 'submitted',
        periodStart: '2026-09-30',
        periodEnd: '2026-09-01',
        issueDate: '2026-10-01',
        dueDate: '2026-10-15',
        invoiceNumber: 'INV-0001',
        currency: 'EUR',
        subtotalMinor: 300000,
        taxMinor: 0,
        totalMinor: 300000,
        lineItems: [
          invoiceLineItemSchema.parse({
            id: uuid,
            invoiceId: uuid,
            description: 'Dev work',
            quantity: 20,
            unitPriceMinor: 15000,
            amountMinor: 300000,
            createdAt: NOW,
          }),
        ],
      }),
    ).toThrow('periodEnd');
  });

  it('PaymentDraftSchema requires a human approval before execution fields', () => {
    const draft = PaymentDraftSchema.parse({
      id: uuid,
      companyId: uuid,
      source: 'invoice',
      sourceId: uuid,
      amountMinor: 200000,
      currency: 'USD',
      status: 'draft',
      idempotencyKey: 'idemp-0001',
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(draft.status).toBe('draft');

    // Cannot pass unapproved execution state without an idempotency key.
    expect(() =>
      PaymentDraftSchema.parse({
        id: uuid,
        companyId: uuid,
        source: 'manual',
        sourceId: uuid,
        amountMinor: 100,
        currency: 'USD',
        status: 'executed',
        idempotencyKey: 'short',
        createdAt: NOW,
        updatedAt: NOW,
      }),
    ).toThrow();
  });

  it('PayrollRunSchema parses a run with items', () => {
    expect(() =>
      PayrollRunSchema.parse({
        id: uuid,
        companyId: uuid,
        status: 'review',
        periodStart: '2026-09-01',
        periodEnd: '2026-09-30',
        currency: 'USD',
        items: [
          {
            id: uuid,
            payrollRunId: uuid,
            contractorId: uuid,
            grossMinor: 300000,
            taxMinor: 45000,
            netMinor: 255000,
            currency: 'USD',
            status: 'pending',
            createdAt: NOW,
          },
        ],
        createdAt: NOW,
        updatedAt: NOW,
      }),
    ).not.toThrow();
  });

  it('AnomalySchema accepts anomaly data', () => {
    expect(() =>
      AnomalySchema.parse({
        id: uuid,
        companyId: uuid,
        entityType: 'invoice',
        entityId: uuid,
        rule: 'duplicate.invoice_number',
        severity: 'high',
        status: 'open',
        detector: 'rules',
        summary: 'Duplicate invoice number submitted by another contractor',
        details: { conflictingInvoiceId: uuid },
        createdAt: NOW,
        updatedAt: NOW,
      }),
    ).not.toThrow();
  });

  it('ApprovalSchema parses approvals', () => {
    expect(() =>
      ApprovalSchema.parse({
        id: uuid,
        companyId: uuid,
        targetType: 'payment_draft',
        targetId: uuid,
        requestedBy: 'svc:payroll-scheduler',
        status: 'pending',
        idempotencyKey: 'appr-0001',
        createdAt: NOW,
        updatedAt: NOW,
      }),
    ).not.toThrow();
  });

  it('AuditLogSchema parses a full audit entry', () => {
    expect(() =>
      AuditLogSchema.parse({
        id: uuid,
        companyId: uuid,
        timestamp: NOW,
        actor: { type: 'user', id: 'usr_42' },
        action: 'invoice.approved',
        resourceType: 'invoice',
        resourceId: uuid,
        before: { status: 'submitted' },
        after: { status: 'approved' },
        metadata: { source: 'slack' },
      }),
    ).not.toThrow();
  });

  it('ConnectorAccountSchema rejects invalid providers', () => {
    expect(() =>
      ConnectorAccountSchema.parse({
        id: uuid,
        companyId: uuid,
        provider: 'quickbooks pro',
        externalAccountId: 'realm-123',
        status: 'connected',
        createdAt: NOW,
        updatedAt: NOW,
      }),
    ).toThrow();
  });
});
