import { describe, expect, it } from 'vitest';
import {
  PayrollAnomalyDetectionContext,
  PayrollAnomalyDetector,
} from './index.js';

describe('PayrollAnomalyDetector (Rules-based)', () => {
  const baseContext: PayrollAnomalyDetectionContext = {
    companyId: 'c0000000-0000-0000-0000-000000000001',
    payrollRunId: 'r0000000-0000-0000-0000-000000000001',
    periodStart: '2026-10-01',
    periodEnd: '2026-10-31',
    currency: 'USD',
    items: [],
    historicalPayouts: [],
    activeContractors: [],
  };

  it('detects duplicate payments in the same payroll run', () => {
    const detector = new PayrollAnomalyDetector();
    const context: PayrollAnomalyDetectionContext = {
      ...baseContext,
      items: [
        {
          id: 'item-1',
          contractorId: 'contractor-1',
          contractorName: 'Elena Rostova',
          grossMinor: 450000,
          taxMinor: 45000,
          netMinor: 405000,
          currency: 'USD',
        },
        {
          id: 'item-2',
          contractorId: 'contractor-1',
          contractorName: 'Elena Rostova',
          grossMinor: 450000,
          taxMinor: 45000,
          netMinor: 405000,
          currency: 'USD',
        },
      ],
    };

    const anomalies = detector.detectAnomalies(context);
    const duplicate = anomalies.find((a) => a.rule === 'payroll.duplicate_payment');

    expect(duplicate).toBeDefined();
    expect(duplicate?.severity).toBe('critical');
    expect(duplicate?.evidence.contractorId).toBe('contractor-1');
    expect(duplicate?.evidence.grossMinor).toBe(450000);
    expect(duplicate?.fingerprint).toBeTruthy();
  });

  it('detects contractor paid above 3-month average by more than X%', () => {
    const detector = new PayrollAnomalyDetector();
    const context: PayrollAnomalyDetectionContext = {
      ...baseContext,
      items: [
        {
          id: 'item-10',
          contractorId: 'contractor-2',
          contractorName: 'Kenji Sato',
          grossMinor: 700000, // $7,000 (historical avg was $4,000 -> +75% increase)
          taxMinor: 70000,
          netMinor: 630000,
          currency: 'USD',
        },
      ],
      historicalPayouts: [
        { contractorId: 'contractor-2', runDate: '2026-08-31', grossMinor: 400000, currency: 'USD' },
        { contractorId: 'contractor-2', runDate: '2026-09-30', grossMinor: 400000, currency: 'USD' },
      ],
      options: { aboveAverageThresholdPercent: 25 },
    };

    const anomalies = detector.detectAnomalies(context);
    const aboveAvg = anomalies.find((a) => a.rule === 'payroll.above_average_threshold');

    expect(aboveAvg).toBeDefined();
    expect(aboveAvg?.severity).toBe('high');
    expect(aboveAvg?.evidence.percentageIncrease).toBe(75);
    expect(aboveAvg?.evidence.averageGrossMinor).toBe(400000);
  });

  it('detects missing expected contractors', () => {
    const detector = new PayrollAnomalyDetector();
    const context: PayrollAnomalyDetectionContext = {
      ...baseContext,
      items: [], // Contractor is missing from items
      activeContractors: [
        {
          id: 'contractor-3',
          name: 'Amara Okafor',
          currency: 'USD',
          status: 'ACTIVE',
          isExpectedInPayroll: true,
        },
      ],
    };

    const anomalies = detector.detectAnomalies(context);
    const missing = anomalies.find((a) => a.rule === 'payroll.missing_contractor');

    expect(missing).toBeDefined();
    expect(missing?.severity).toBe('medium');
    expect(missing?.evidence.contractorId).toBe('contractor-3');
    expect(missing?.evidence.contractorName).toBe('Amara Okafor');
  });

  it('detects unusual overtime exceeding threshold', () => {
    const detector = new PayrollAnomalyDetector();
    const context: PayrollAnomalyDetectionContext = {
      ...baseContext,
      items: [
        {
          id: 'item-30',
          contractorId: 'contractor-4',
          contractorName: 'Carlos Mendez',
          grossMinor: 500000,
          taxMinor: 50000,
          netMinor: 450000,
          currency: 'USD',
          regularHours: 40,
          overtimeHours: 28, // High overtime!
        },
      ],
      options: { unusualOvertimeHoursThreshold: 20 },
    };

    const anomalies = detector.detectAnomalies(context);
    const ot = anomalies.find((a) => a.rule === 'payroll.unusual_overtime');

    expect(ot).toBeDefined();
    expect(ot?.evidence.currentOvertimeHours).toBe(28);
  });

  it('detects unexpected currency changes', () => {
    const detector = new PayrollAnomalyDetector();
    const context: PayrollAnomalyDetectionContext = {
      ...baseContext,
      items: [
        {
          id: 'item-40',
          contractorId: 'contractor-5',
          contractorName: 'Liam O-Connor',
          grossMinor: 500000,
          taxMinor: 50000,
          netMinor: 450000,
          currency: 'EUR', // Item submitted in EUR
        },
      ],
      activeContractors: [
        {
          id: 'contractor-5',
          name: 'Liam O-Connor',
          currency: 'GBP', // Contract profile currency is GBP
          status: 'ACTIVE',
        },
      ],
    };

    const anomalies = detector.detectAnomalies(context);
    const curr = anomalies.find((a) => a.rule === 'payroll.currency_change');

    expect(curr).toBeDefined();
    expect(curr?.severity).toBe('high');
    expect(curr?.evidence.itemCurrency).toBe('EUR');
    expect(curr?.evidence.expectedProfileCurrency).toBe('GBP');
  });

  it('detects recent bank account change within 7 days', () => {
    const detector = new PayrollAnomalyDetector();
    // periodEnd is 2026-10-31; bank was updated on 2026-10-28 (3 days prior)
    const context: PayrollAnomalyDetectionContext = {
      ...baseContext,
      periodEnd: '2026-10-31',
      items: [
        {
          id: 'item-50',
          contractorId: 'contractor-6',
          contractorName: 'Sophie Dubois',
          grossMinor: 350000,
          taxMinor: 35000,
          netMinor: 315000,
          currency: 'USD',
          destinationBankAccountId: 'bank-acc-999',
        },
      ],
      activeContractors: [
        {
          id: 'contractor-6',
          name: 'Sophie Dubois',
          currency: 'USD',
          status: 'ACTIVE',
          bankAccountUpdatedAt: '2026-10-28T00:00:00Z',
        },
      ],
    };

    const anomalies = detector.detectAnomalies(context);
    const bank = anomalies.find((a) => a.rule === 'payroll.recent_bank_change');

    expect(bank).toBeDefined();
    expect(bank?.severity).toBe('critical');
    expect(bank?.evidence.daysSinceChange).toBe(3);
  });

  it('generates stable deterministic fingerprints across repeated runs', () => {
    const detector = new PayrollAnomalyDetector();
    const context: PayrollAnomalyDetectionContext = {
      ...baseContext,
      items: [
        {
          id: 'item-1',
          contractorId: 'contractor-1',
          contractorName: 'Elena Rostova',
          grossMinor: 450000,
          taxMinor: 45000,
          netMinor: 405000,
          currency: 'USD',
        },
        {
          id: 'item-2',
          contractorId: 'contractor-1',
          contractorName: 'Elena Rostova',
          grossMinor: 450000,
          taxMinor: 45000,
          netMinor: 405000,
          currency: 'USD',
        },
      ],
    };

    const run1 = detector.detectAnomalies(context);
    const run2 = detector.detectAnomalies(context);

    expect(run1[0]!.fingerprint).toBe(run2[0]!.fingerprint);
  });
});
