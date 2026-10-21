import { ExtractedInvoice } from '@paypilot/ai';

export interface ContractCandidate {
  id: string;
  contractorId: string;
  companyId: string;
  status: string;
  rateType: string;
  rateMinor: number;
  currency: string;
  monthlyCapMinor?: number | null;
  effectiveDate: Date | string;
  endDate?: Date | string | null;
}

export interface ExistingInvoiceRecord {
  id: string;
  invoiceNumber: string;
  contractorId: string;
  totalMinor: number;
  currency: string;
  issueDate: Date | string;
  createdAt: Date | string;
}

export interface DetectedContractAnomaly {
  rule: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  evidence: Record<string, unknown>;
}

export interface ContractCheckResult {
  matchedContract: ContractCandidate | null;
  isClean: boolean;
  anomalies: DetectedContractAnomaly[];
  reasons: string[];
}

export class ContractMatchingService {
  public checkInvoiceAgainstContracts(
    extracted: ExtractedInvoice,
    contractorId: string,
    contracts: ContractCandidate[],
    existingInvoices: ExistingInvoiceRecord[],
  ): ContractCheckResult {
    const anomalies: DetectedContractAnomaly[] = [];
    const reasons: string[] = [];

    // 1. Match Active Contract
    const activeContracts = contracts.filter((c) => c.status === 'ACTIVE');
    const matchedContract =
      activeContracts.find((c) => c.currency.toUpperCase() === extracted.currency.toUpperCase()) ??
      activeContracts[0] ??
      null;

    if (!matchedContract) {
      const summary = `No active contract found for contractor '${contractorId}'.`;
      anomalies.push({
        rule: 'contract.missing_contract',
        severity: 'high',
        summary,
        evidence: { contractorId, invoiceNumber: extracted.invoiceNumber },
      });
      reasons.push(summary);
      return { matchedContract: null, isClean: false, anomalies, reasons };
    }

    // 2. Check Currency Mismatch
    if (extracted.currency.toUpperCase() !== matchedContract.currency.toUpperCase()) {
      const summary = `Invoice currency '${extracted.currency}' does not match contract currency '${matchedContract.currency}'.`;
      anomalies.push({
        rule: 'invoice.currency_mismatch',
        severity: 'high',
        summary,
        evidence: {
          contractorId,
          contractId: matchedContract.id,
          invoiceCurrency: extracted.currency,
          contractCurrency: matchedContract.currency,
        },
      });
      reasons.push(summary);
    }

    // 3. Check Contract Rate Discrepancy
    if (matchedContract.rateType === 'HOURLY') {
      // Check if any line item unit price exceeds contract hourly rate
      for (const item of extracted.lineItems) {
        if (item.unitPriceMinor > matchedContract.rateMinor) {
          const summary = `Line item unit price of ${(item.unitPriceMinor / 100).toFixed(2)} exceeds contract hourly rate of ${(matchedContract.rateMinor / 100).toFixed(2)}.`;
          anomalies.push({
            rule: 'invoice.rate_discrepancy',
            severity: 'high',
            summary,
            evidence: {
              contractId: matchedContract.id,
              contractRateMinor: matchedContract.rateMinor,
              invoicedRateMinor: item.unitPriceMinor,
              description: item.description,
            },
          });
          reasons.push(summary);
        }
      }
    } else if (matchedContract.rateType === 'FIXED') {
      if (extracted.subtotalMinor > matchedContract.rateMinor) {
        const summary = `Fixed invoice subtotal ${(extracted.subtotalMinor / 100).toFixed(2)} exceeds contract fixed rate of ${(matchedContract.rateMinor / 100).toFixed(2)}.`;
        anomalies.push({
          rule: 'invoice.rate_discrepancy',
          severity: 'high',
          summary,
          evidence: {
            contractId: matchedContract.id,
            contractRateMinor: matchedContract.rateMinor,
            invoicedRateMinor: extracted.subtotalMinor,
          },
        });
        reasons.push(summary);
      }
    }

    // 4. Check Monthly Cap Exceeded
    if (matchedContract.monthlyCapMinor && matchedContract.monthlyCapMinor > 0) {
      const invoiceIssueTime = new Date(extracted.issueDate).getTime();
      const invoiceMonth = new Date(extracted.issueDate).getMonth();
      const invoiceYear = new Date(extracted.issueDate).getFullYear();

      // Sum all invoices from this contractor in the same calendar month
      const pastBilledInMonth = existingInvoices
        .filter((inv) => {
          if (inv.contractorId !== contractorId) return false;
          const d = new Date(inv.issueDate);
          return d.getFullYear() === invoiceYear && d.getMonth() === invoiceMonth;
        })
        .reduce((sum, inv) => sum + inv.totalMinor, 0);

      const totalProjected = pastBilledInMonth + extracted.totalMinor;

      if (totalProjected > matchedContract.monthlyCapMinor) {
        const cap = matchedContract.monthlyCapMinor;
        const summary = `Monthly billing total of ${(totalProjected / 100).toFixed(2)} ${extracted.currency} exceeds contract monthly cap of ${(cap / 100).toFixed(2)} ${matchedContract.currency}.`;
        anomalies.push({
          rule: 'invoice.monthly_cap_exceeded',
          severity: 'high',
          summary,
          evidence: {
            contractId: matchedContract.id,
            monthlyCapMinor: cap,
            pastBilledInMonth,
            currentInvoiceTotalMinor: extracted.totalMinor,
            projectedTotalMinor: totalProjected,
          },
        });
        reasons.push(summary);
      }
    }

    // 5. Detect Duplicate Invoices
    const invoiceIssueTime = new Date(extracted.issueDate).getTime();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    for (const pastInv of existingInvoices) {
      // Duplicate invoice number
      if (pastInv.invoiceNumber.trim().toUpperCase() === extracted.invoiceNumber.trim().toUpperCase()) {
        const summary = `Duplicate invoice number '${extracted.invoiceNumber}' was already submitted.`;
        anomalies.push({
          rule: 'invoice.duplicate_number',
          severity: 'critical',
          summary,
          evidence: {
            existingInvoiceId: pastInv.id,
            invoiceNumber: extracted.invoiceNumber,
            pastInvoiceTotalMinor: pastInv.totalMinor,
          },
        });
        reasons.push(summary);
      }

      // Same contractor + identical amount within 30 days
      if (pastInv.contractorId === contractorId && pastInv.totalMinor === extracted.totalMinor) {
        const pastTime = new Date(pastInv.issueDate).getTime();
        const diffMs = Math.abs(invoiceIssueTime - pastTime);
        if (diffMs <= thirtyDaysMs) {
          const daysDiff = Math.round(diffMs / (24 * 60 * 60 * 1000));
          const summary = `Potential duplicate invoice: contractor was already billed for identical amount ${(extracted.totalMinor / 100).toFixed(2)} ${extracted.currency} ${daysDiff} days ago (Invoice #${pastInv.invoiceNumber}).`;
          anomalies.push({
            rule: 'invoice.duplicate_amount_30_days',
            severity: 'critical',
            summary,
            evidence: {
              existingInvoiceId: pastInv.id,
              existingInvoiceNumber: pastInv.invoiceNumber,
              totalMinor: extracted.totalMinor,
              daysDiff,
            },
          });
          reasons.push(summary);
        }
      }
    }

    const isClean = anomalies.length === 0;
    return {
      matchedContract,
      isClean,
      anomalies,
      reasons,
    };
  }
}
