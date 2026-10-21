import { AnomalyRule, DetectedAnomaly, PayrollAnomalyDetectionContext } from '../types.js';
import { generateAnomalyFingerprint } from '../fingerprint.js';

export class MissingContractorsRule implements AnomalyRule {
  readonly id = 'payroll.missing_contractor';
  readonly name = 'Missing Expected Contractor Detector';

  evaluate(context: PayrollAnomalyDetectionContext): DetectedAnomaly[] {
    const anomalies: DetectedAnomaly[] = [];
    const presentContractorIds = new Set(context.items.map((i) => i.contractorId));

    for (const contractor of context.activeContractors) {
      if (contractor.status !== 'ACTIVE') continue;

      // Contractor is marked as expected or was paid in recent history
      const hasRecentPayout = context.historicalPayouts.some((p) => p.contractorId === contractor.id);
      const isExpected = contractor.isExpectedInPayroll ?? hasRecentPayout;

      if (isExpected && !presentContractorIds.has(contractor.id)) {
        const evidence = {
          contractorId: contractor.id,
          contractorName: contractor.name,
          contractorStatus: contractor.status,
          currency: contractor.currency,
          payrollRunId: context.payrollRunId,
          periodStart: context.periodStart,
          periodEnd: context.periodEnd,
        };

        anomalies.push({
          rule: this.id,
          severity: 'medium',
          summary: `Active contractor '${contractor.name}' was expected in this payroll run but has no line items.`,
          evidence,
          fingerprint: generateAnomalyFingerprint(this.id, 'contractor', contractor.id, evidence),
          entityType: 'contractor',
          entityId: contractor.id,
          companyId: context.companyId,
        });
      }
    }

    return anomalies;
  }
}
