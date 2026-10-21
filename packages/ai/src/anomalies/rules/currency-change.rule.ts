import { AnomalyRule, DetectedAnomaly, PayrollAnomalyDetectionContext } from '../types.js';
import { generateAnomalyFingerprint } from '../fingerprint.js';

export class CurrencyChangeRule implements AnomalyRule {
  readonly id = 'payroll.currency_change';
  readonly name = 'Contractor Currency Change Detector';

  evaluate(context: PayrollAnomalyDetectionContext): DetectedAnomaly[] {
    const anomalies: DetectedAnomaly[] = [];

    const contractorProfileMap = new Map(context.activeContractors.map((c) => [c.id, c]));

    for (const item of context.items) {
      const profile = contractorProfileMap.get(item.contractorId);
      const expectedCurrency = profile?.currency;

      // Check contract currency mismatch
      if (expectedCurrency && expectedCurrency.toUpperCase() !== item.currency.toUpperCase()) {
        const evidence = {
          contractorId: item.contractorId,
          contractorName: item.contractorName ?? profile?.name ?? 'Unknown',
          itemCurrency: item.currency.toUpperCase(),
          expectedProfileCurrency: expectedCurrency.toUpperCase(),
          grossMinor: item.grossMinor,
          payrollRunId: context.payrollRunId,
        };

        anomalies.push({
          rule: this.id,
          severity: 'high',
          summary: `Contractor '${evidence.contractorName}' is scheduled to be paid in ${item.currency}, but contract currency is ${expectedCurrency}.`,
          evidence,
          fingerprint: generateAnomalyFingerprint(this.id, 'payroll_item', item.id, evidence),
          entityType: 'payroll_item',
          entityId: item.id,
          companyId: context.companyId,
        });
        continue;
      }

      // Check against historical payout currency
      const historicalPayouts = context.historicalPayouts.filter((p) => p.contractorId === item.contractorId);
      if (historicalPayouts.length > 0) {
        const lastPayout = historicalPayouts[historicalPayouts.length - 1]!;
        if (lastPayout.currency.toUpperCase() !== item.currency.toUpperCase()) {
          const evidence = {
            contractorId: item.contractorId,
            contractorName: item.contractorName ?? 'Unknown',
            currentCurrency: item.currency.toUpperCase(),
            previousCurrency: lastPayout.currency.toUpperCase(),
            previousRunDate: lastPayout.runDate,
            grossMinor: item.grossMinor,
            payrollRunId: context.payrollRunId,
          };

          anomalies.push({
            rule: this.id,
            severity: 'high',
            summary: `Contractor '${evidence.contractorName}' currency shifted from ${lastPayout.currency} to ${item.currency} without contract amendment.`,
            evidence,
            fingerprint: generateAnomalyFingerprint(this.id, 'payroll_item', item.id, evidence),
            entityType: 'payroll_item',
            entityId: item.id,
            companyId: context.companyId,
          });
        }
      }
    }

    return anomalies;
  }
}
