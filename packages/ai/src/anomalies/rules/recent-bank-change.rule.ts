import { AnomalyRule, DetectedAnomaly, PayrollAnomalyDetectionContext } from '../types.js';
import { generateAnomalyFingerprint } from '../fingerprint.js';

export class RecentBankAccountChangeRule implements AnomalyRule {
  readonly id = 'payroll.recent_bank_change';
  readonly name = 'Recent Bank Account Change Detector';

  evaluate(context: PayrollAnomalyDetectionContext): DetectedAnomaly[] {
    const anomalies: DetectedAnomaly[] = [];
    const changeWindowDays = context.options?.bankAccountChangeWindowDays ?? 7;
    const runDate = new Date(context.periodEnd).getTime();
    const windowStart = runDate - changeWindowDays * 24 * 60 * 60 * 1000;

    const contractorProfileMap = new Map(context.activeContractors.map((c) => [c.id, c]));

    for (const item of context.items) {
      const profile = contractorProfileMap.get(item.contractorId);
      if (!profile) continue;

      const changeDateStr = profile.bankAccountUpdatedAt ?? profile.bankAccountCreatedAt;
      if (!changeDateStr) continue;

      const changeTime = new Date(changeDateStr).getTime();
      // If bank account was updated/created within the 7-day window prior to the run
      if (changeTime >= windowStart && changeTime <= runDate + 24 * 60 * 60 * 1000) {
        const daysAgo = Math.max(0, Math.round((runDate - changeTime) / (24 * 60 * 60 * 1000)));

        const evidence = {
          contractorId: item.contractorId,
          contractorName: item.contractorName ?? profile.name,
          bankAccountChangeDate: changeDateStr,
          daysSinceChange: daysAgo,
          windowDays: changeWindowDays,
          grossMinor: item.grossMinor,
          currency: item.currency,
          destinationBankAccountId: item.destinationBankAccountId,
          payrollRunId: context.payrollRunId,
        };

        anomalies.push({
          rule: this.id,
          severity: 'critical',
          summary: `Contractor '${evidence.contractorName}' had payout bank account details updated ${daysAgo} days ago (within high-risk 7-day window). Potential account takeover/diversion risk.`,
          evidence,
          fingerprint: generateAnomalyFingerprint(this.id, 'contractor', item.contractorId, evidence),
          entityType: 'contractor',
          entityId: item.contractorId,
          companyId: context.companyId,
        });
      }
    }

    return anomalies;
  }
}
