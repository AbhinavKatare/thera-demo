export interface InvoiceFixture {
  id: string;
  name: string;
  layoutType: 'modern_tech' | 'international_agency' | 'scanned_receipt';
  rawText: string;
  expected: {
    vendorName: string;
    invoiceNumber: string;
    currency: string;
    subtotalMinor: number;
    taxMinor: number;
    totalMinor: number;
    hasIban: boolean;
  };
}

export const INVOICE_FIXTURES: Record<string, InvoiceFixture> = {
  // Layout 1: Modern Tech Consulting (Hourly billing, clean digital text)
  MODERN_TECH: {
    id: 'layout-modern-tech',
    name: 'Modern Tech Consulting Layout',
    layoutType: 'modern_tech',
    rawText: `
============================================================
                   CLOUDCRAFT DEVOPS CONSULTING LTD
       100 Market Street, Suite 400, San Francisco, CA 94105
                   contact@cloudcraft-devops.io
============================================================

INVOICE TO:
PayPilot Technologies Inc.
One Embarcadero Center, San Francisco, CA

Invoice Number:   INV-2026-104
Issue Date:       2026-10-10
Due Date:         2026-10-24
Payment Terms:    Net 14
Currency:         USD

------------------------------------------------------------
Description                                Qty    Rate    Amount
------------------------------------------------------------
Kubernetes Cluster Migration & Terraform    35  150.00  5,250.00
CI/CD Pipeline Automation Architecture

------------------------------------------------------------
                                     Subtotal:      $5,250.00
                                          Tax:          $0.00
                               TOTAL DUE (USD):     $5,250.00
------------------------------------------------------------

WIRE PAYMENT INSTRUCTIONS:
Bank: JPMorgan Chase Bank, N.A.
Account Name: CloudCraft DevOps Consulting Ltd
Account Number: 9876543210
Routing Number (ABA): 021000021
`.trim(),
    expected: {
      vendorName: 'CloudCraft DevOps Consulting Ltd',
      invoiceNumber: 'INV-2026-104',
      currency: 'USD',
      subtotalMinor: 525000,
      taxMinor: 0,
      totalMinor: 525000,
      hasIban: false,
    },
  },

  // Layout 2: International European Agency (Bilingual, VAT breakdown, IBAN/SWIFT)
  INTERNATIONAL_AGENCY: {
    id: 'layout-international-agency',
    name: 'European Agency with VAT & IBAN',
    layoutType: 'international_agency',
    rawText: `
------------------------------------------------------------
ALPINE ENGINEERING SOLUTIONS GMBH
Friedrichstraße 140, 10117 Berlin, Germany
USt-IdNr. (VAT ID): DE 314 892 105
Tax Number: 37/215/10492
Email: billing@alpine-eng.de
------------------------------------------------------------

RECHNUNG / INVOICE # INV-EU-2026-089
Date of Issue: 2026-10-15
Due Date:      2026-11-15
Client: PayPilot Technologies Inc.

Services Provided:
- Embedded Systems Architecture Consulting
  Period: October 1 - October 15, 2026
  Hours: 40.00 hrs @ 125.00 EUR / hr ................ 5,000.00 EUR

------------------------------------------------------------
Nettobetrag / Subtotal:                              5,000.00 EUR
MwSt. / VAT (19%):                                     950.00 EUR
GESAMTBETRAG / TOTAL:                                5,950.00 EUR
------------------------------------------------------------

Bankverbindung / Banking Details:
Bank: Deutsche Bank AG, Berlin
IBAN: DE89370400440532013000
BIC / SWIFT: DEUTDEDDFXX
`.trim(),
    expected: {
      vendorName: 'Alpine Engineering Solutions GmbH',
      invoiceNumber: 'INV-EU-2026-089',
      currency: 'EUR',
      subtotalMinor: 500000,
      taxMinor: 95000,
      totalMinor: 595000,
      hasIban: true,
    },
  },

  // Layout 3: Scanned / Rasterized Receipt (Low OCR readability, flagged uncertainty)
  SCANNED_RECEIPT: {
    id: 'layout-scanned-receipt',
    name: 'Scanned Hardware & Printing Slip (OCR Fallback)',
    layoutType: 'scanned_receipt',
    rawText: `
[SCANNED RECEIPT / OCR OUTPUT - CONFIDENCE 0.72]
QUICKPRINT & SUPPLIES STORE #441
123 INDUSTRIAL PARK RD
TEL: (555) 019-2831

TRANS: RCP-9901
DATE: 2026-10-18
TIME: 14:22:05

ITEM                           QTY    PRICE     TOTAL
-----------------------------------------------------
OFFICE TONER CARTRIDGES          1   245.00    245.00
PAPER REAMS MULTIPACK

SUBTOTAL:                                      245.00
EST. TAX (BLURRED / UNCERTAIN):                 22.00
TOTAL USD:                                     267.00

PAYMENT: CASH / DIRECT
`.trim(),
    expected: {
      vendorName: 'QuickPrint & Supplies',
      invoiceNumber: 'RCP-9901',
      currency: 'USD',
      subtotalMinor: 24500,
      taxMinor: 2200,
      totalMinor: 26700,
      hasIban: false,
    },
  },
};
