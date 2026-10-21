import { AnomalyRule, DetectedAnomaly, PayrollAnomalyDetectionContext } from '../types.js';
import { generateAnomalyFingerprint } from '../fingerprint.js';

export class DuplicatePaymentsRule implements AnomalyRule {
  readonly id = 'payroll.duplicate_payment';
  readonly name = 'Duplicate Payment Detector';

  evaluate(context: PayrollAnomalyDetectionContext): DetectedAnomaly[] {
    const anomalies: DetectedAnomaly[] = [];
    const contractorItemsMap = new Map<string, typeof context.items>();

    for (const item of context.items) {
      const existing = contractorItemsMap.get(item.contractorId) ?? [];
      existing.push(item);
      contractorItemsMap.set(item.contractorId, existing);
    }

    for (const [contractorId, items] of contractorItemsMap.entries()) {
      if (items.length <= 1) continue;

      // Group by amount and currency
      const seenAmounts = new Map<string, typeof items>();
      for (const item of items) {
        const key = `${item.grossMinor}:${item.currency}`;
        const match = seenAmounts.get(key) ?? [];
        match.push(item);
        seenAmounts.set(key, match);
      }

      for (const [amountKey, duplicateItems] of seenAmounts.entries()) {
        if (duplicateItems.length > 1) {
          const itemIds = duplicateItems.map((i) => i.id);
          const firstItem = duplicateItems[0]!;
          const evidence = {
            contractorId,
            contractorName: firstItem.contractorName ?? 'Unknown',
            duplicatedItemCount: duplicateItems.length,
            itemIds,
            grossMinor: firstItem.grossMinor,
            currency: firstItem.currency,
            payrollRunId: context.payrollRunId,
          };

          anomalies.push({
            rule: this.id,
            severity: 'critical',
            summary: `Contractor '${firstItem.contractorName ?? contractorId}' has ${duplicateItems.length} duplicate payment items of identical amount ${firstItem.grossMinor / 100} ${firstItem.currency} in payroll run.`,
            evidence,
            fingerprint: generateAnomalyFingerprint(this.id, 'payroll_item', firstItem.id, evidence),
            entityType: 'payroll_item',
            entityId: firstItem.id,
            companyId: context.companyId,
          });
        }
      }
    }

    return anomalies;
  }
}
