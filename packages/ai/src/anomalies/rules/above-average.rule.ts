import { AnomalyRule, DetectedAnomaly, PayrollAnomalyDetectionContext } from '../types.js';
import { generateAnomalyFingerprint } from '../fingerprint.js';

export class AboveAveragePayoutRule implements AnomalyRule {
  readonly id = 'payroll.above_average_threshold';
  readonly name = 'Above 3-Month Average Payout Detector';

  evaluate(context: PayrollAnomalyDetectionContext): DetectedAnomaly[] {
    const anomalies: DetectedAnomaly[] = [];
    const thresholdPercent = context.options?.aboveAverageThresholdPercent ?? 25;

    // Filter historical payouts to past 90 days
    const runEnd = new Date(context.periodEnd).getTime();
    const ninetyDaysAgo = runEnd - 90 * 24 * 60 * 60 * 1000;

    for (const item of context.items) {
      const contractorHistory = context.historicalPayouts.filter((p) => {
        if (p.contractorId !== item.contractorId) return false;
        const payoutTime = new Date(p.runDate).getTime();
        return payoutTime >= ninetyDaysAgo && payoutTime <= runEnd;
      });

      if (contractorHistory.length < 2) {
        // Need at least 2 historical data points to form a baseline
        continue;
      }

      const totalHistorical = contractorHistory.reduce((acc, h) => acc + h.grossMinor, 0);
      const averageHistorical = Math.round(totalHistorical / contractorHistory.length);

      if (averageHistorical <= 0) continue;

      const percentageIncrease = ((item.grossMinor - averageHistorical) / averageHistorical) * 100;

      if (percentageIncrease > thresholdPercent) {
        const severity = percentageIncrease >= 50 ? 'high' : 'medium';
        const evidence = {
          contractorId: item.contractorId,
          contractorName: item.contractorName ?? 'Unknown',
          currentGrossMinor: item.grossMinor,
          averageGrossMinor: averageHistorical,
          percentageIncrease: Math.round(percentageIncrease * 10) / 10,
          thresholdPercent,
          historicalPmtCount: contractorHistory.length,
          currency: item.currency,
          payrollRunId: context.payrollRunId,
        };

        anomalies.push({
          rule: this.id,
          severity,
          summary: `Contractor '${item.contractorName ?? item.contractorId}' payout of ${(item.grossMinor / 100).toFixed(2)} ${item.currency} is ${evidence.percentageIncrease}% above their 3-month average of ${(averageHistorical / 100).toFixed(2)} ${item.currency}.`,
          evidence,
          fingerprint: generateAnomalyFingerprint(this.id, 'payroll_item', item.id, evidence),
          entityType: 'payroll_item',
          entityId: item.id,
          companyId: context.companyId,
        });
      }
    }

    return anomalies;
  }
}
