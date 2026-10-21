import { AnomalySeverity } from '@paypilot/core';

export interface AnomalyEvidence {
  [key: string]: unknown;
}

export interface DetectedAnomaly {
  rule: string;
  severity: AnomalySeverity;
  summary: string;
  evidence: AnomalyEvidence;
  fingerprint: string;
  entityType: 'payroll_item' | 'contractor' | 'payroll_run';
  entityId: string;
  companyId: string;
}

export interface PayrollRunItemInput {
  id: string;
  contractorId: string;
  contractorName?: string;
  grossMinor: number;
  taxMinor: number;
  netMinor: number;
  currency: string;
  regularHours?: number;
  overtimeHours?: number;
  destinationBankAccountId?: string;
  paymentDraftId?: string;
}

export interface HistoricalPayout {
  contractorId: string;
  payrollRunId?: string;
  runDate: Date | string;
  grossMinor: number;
  currency: string;
  overtimeHours?: number;
}

export interface ActiveContractorProfile {
  id: string;
  name: string;
  currency: string;
  status: 'ACTIVE' | 'INVITED' | 'OFFBOARDED' | string;
  bankAccountCreatedAt?: Date | string;
  bankAccountUpdatedAt?: Date | string;
  isExpectedInPayroll?: boolean;
}

export interface PayrollAnomalyDetectionContext {
  companyId: string;
  payrollRunId: string;
  periodStart: Date | string;
  periodEnd: Date | string;
  currency: string;
  items: PayrollRunItemInput[];
  historicalPayouts: HistoricalPayout[];
  activeContractors: ActiveContractorProfile[];
  options?: {
    /** Percentage threshold above 3-month average to flag (e.g. 25 = 25% above average) */
    aboveAverageThresholdPercent?: number;
    /** Overtime hours threshold per pay period to flag */
    unusualOvertimeHoursThreshold?: number;
    /** Overtime percentage increase above historical average */
    unusualOvertimeIncreasePercent?: number;
    /** Number of days before payroll run to flag recent bank account changes */
    bankAccountChangeWindowDays?: number;
  };
}

export interface AnomalyRule {
  readonly id: string;
  readonly name: string;
  evaluate(context: PayrollAnomalyDetectionContext): DetectedAnomaly[];
}
