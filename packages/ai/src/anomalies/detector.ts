import { AnomalyRule, DetectedAnomaly, PayrollAnomalyDetectionContext } from './types.js';
import { DuplicatePaymentsRule } from './rules/duplicate-payments.rule.js';
import { AboveAveragePayoutRule } from './rules/above-average.rule.js';
import { MissingContractorsRule } from './rules/missing-contractors.rule.js';
import { UnusualOvertimeRule } from './rules/unusual-overtime.rule.js';
import { CurrencyChangeRule } from './rules/currency-change.rule.js';
import { RecentBankAccountChangeRule } from './rules/recent-bank-change.rule.js';

export class PayrollAnomalyDetector {
  private readonly rules: AnomalyRule[];

  constructor(customRules?: AnomalyRule[]) {
    this.rules = customRules ?? [
      new DuplicatePaymentsRule(),
      new AboveAveragePayoutRule(),
      new MissingContractorsRule(),
      new UnusualOvertimeRule(),
      new CurrencyChangeRule(),
      new RecentBankAccountChangeRule(),
    ];
  }

  public detectAnomalies(context: PayrollAnomalyDetectionContext): DetectedAnomaly[] {
    const allAnomalies: DetectedAnomaly[] = [];
    const seenFingerprints = new Set<string>();

    for (const rule of this.rules) {
      try {
        const results = rule.evaluate(context);
        for (const anomaly of results) {
          if (!seenFingerprints.has(anomaly.fingerprint)) {
            seenFingerprints.add(anomaly.fingerprint);
            allAnomalies.push(anomaly);
          }
        }
      } catch (err) {
        console.error(`Rule '${rule.id}' failed during evaluation:`, err);
      }
    }

    // Sort by severity: critical > high > medium > low
    const severityRank: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    return allAnomalies.sort((a, b) => (severityRank[b.severity] ?? 0) - (severityRank[a.severity] ?? 0));
  }
}
