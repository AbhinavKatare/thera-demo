import { describe, expect, it } from 'vitest';
import { AnomalyExplainer } from './explainer.js';
import { MockLLMProvider } from '../llm/mock-provider.js';
import { DetectedAnomaly } from '../anomalies/types.js';

describe('AnomalyExplainer', () => {
  const duplicateAnomalyFixture: DetectedAnomaly = {
    rule: 'payroll.duplicate_payment',
    severity: 'critical',
    summary: 'Duplicate payment detected for contractor Elena Rostova',
    evidence: {
      contractorId: 'c-100',
      contractorName: 'Elena Rostova',
      duplicatedItemCount: 2,
      grossMinor: 450000,
      currency: 'USD',
      payrollRunId: 'pr-2026-10',
    },
    fingerprint: 'fp-dup-1',
    entityType: 'payroll_item',
    entityId: 'item-100',
    companyId: 'comp-1',
  };

  const aboveAverageFixture: DetectedAnomaly = {
    rule: 'payroll.above_average_threshold',
    severity: 'high',
    summary: 'Payout is 75% above 3-month average',
    evidence: {
      contractorId: 'c-200',
      contractorName: 'Kenji Sato',
      currentGrossMinor: 700000,
      averageGrossMinor: 400000,
      percentageIncrease: 75,
      currency: 'USD',
      payrollRunId: 'pr-2026-10',
    },
    fingerprint: 'fp-above-1',
    entityType: 'payroll_item',
    entityId: 'item-200',
    companyId: 'comp-1',
  };

  it('generates a 1-2 sentence explanation and actionable suggestion from evidence', async () => {
    const mockLlm = new MockLLMProvider(() =>
      JSON.stringify({
        explanation: 'Elena Rostova appears 2 times with identical payment of 4500 USD in payroll run pr-2026-10.',
        suggestedAction: 'Review line items and void duplicate before approval.',
        factsUsed: ['Elena Rostova', '4500 USD', '2 times'],
      }),
    );

    const explainer = new AnomalyExplainer(mockLlm);
    const result = await explainer.explain(duplicateAnomalyFixture);

    expect(result.explanation).toContain('Elena Rostova');
    expect(result.explanation).toContain('4500');
    expect(result.suggestedAction).toBeTruthy();
    expect(result.anomalyFingerprint).toBe('fp-dup-1');
  });

  it('strictly validates factuality and catches invented numbers', () => {
    const explainer = new AnomalyExplainer(new MockLLMProvider());

    const validText = 'Elena Rostova was scheduled 2 times for 4500 USD.';
    expect(() => explainer.verifyStrictFactuality(validText, duplicateAnomalyFixture.evidence)).not.toThrow();

    // Text containing a hallucinated number "9999" not in the evidence
    const hallucinatedText = 'Elena Rostova was previously billed 9999 USD in bonus payments.';
    expect(() => explainer.verifyStrictFactuality(hallucinatedText, duplicateAnomalyFixture.evidence)).toThrow(
      /Factuality verification failed: Number '9999' found in explanation/,
    );
  });

  it('falls back to deterministic factual explanation when LLM encounters an error', async () => {
    const failingLlm = new MockLLMProvider(() => {
      throw new Error('LLM rate limit or connection timeout');
    });

    const explainer = new AnomalyExplainer(failingLlm);
    const result = await explainer.explain(aboveAverageFixture);

    expect(result.explanation).toContain('75% higher');
    expect(result.explanation).toContain('7000');
    expect(result.suggestedAction).toContain('timesheets');
  });
});
