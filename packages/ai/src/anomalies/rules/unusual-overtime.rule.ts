import { AnomalyRule, DetectedAnomaly, PayrollAnomalyDetectionContext } from '../types.js';
import { generateAnomalyFingerprint } from '../fingerprint.js';

export class UnusualOvertimeRule implements AnomalyRule {
  readonly id = 'payroll.unusual_overtime';
  readonly name = 'Unusual Overtime Detector';

  evaluate(context: PayrollAnomalyDetectionContext): DetectedAnomaly[] {
    const anomalies: DetectedAnomaly[] = [];
    const absoluteHoursThreshold = context.options?.unusualOvertimeHoursThreshold ?? 20;
    const increasePercentThreshold = context.options?.unusualOvertimeIncreasePercent ?? 50;

    for (const item of context.items) {
      const currentOT = item.overtimeHours ?? 0;
      if (currentOT <= 0) continue;

      // Check historical overtime hours for this contractor
      const contractorHistory = context.historicalPayouts.filter(
        (p) => p.contractorId === item.contractorId && p.overtimeHours !== undefined,
      );

      const historicalOTCount = contractorHistory.length;
      const totalHistoricalOT = contractorHistory.reduce((acc, h) => acc + (h.overtimeHours ?? 0), 0);
      const avgHistoricalOT = historicalOTCount > 0 ? totalHistoricalOT / historicalOTCount : 0;

      let shouldFlag = false;
      let severity: 'medium' | 'high' = 'medium';
      let reason = '';

      if (currentOT >= absoluteHoursThreshold) {
        shouldFlag = true;
        severity = currentOT >= 35 ? 'high' : 'medium';
        reason = `Logged ${currentOT} overtime hours, exceeding the ${absoluteHoursThreshold}h threshold.`;
      } else if (historicalOTCount >= 2 && avgHistoricalOT > 0) {
        const percentIncrease = ((currentOT - avgHistoricalOT) / avgHistoricalOT) * 100;
        if (percentIncrease > increasePercentThreshold) {
          shouldFlag = true;
          severity = percentIncrease >= 100 ? 'high' : 'medium';
          reason = `Logged ${currentOT}h overtime, ${Math.round(percentIncrease)}% higher than 3-month average of ${avgHistoricalOT.toFixed(1)}h.`;
        }
      }

      if (shouldFlag) {
        const evidence = {
          contractorId: item.contractorId,
          contractorName: item.contractorName ?? 'Unknown',
          currentOvertimeHours: currentOT,
          regularHours: item.regularHours ?? 0,
          averageHistoricalOvertimeHours: Math.round(avgHistoricalOT * 10) / 10,
          reason,
          payrollRunId: context.payrollRunId,
        };

        anomalies.push({
          rule: this.id,
          severity,
          summary: `Contractor '${item.contractorName ?? item.contractorId}' unusual overtime: ${reason}`,
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
