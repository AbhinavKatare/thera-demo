import { z } from 'zod';
import { maskObjectPii } from '@paypilot/core';
import { LLMProvider } from '../llm/types.js';
import { DetectedAnomaly } from '../anomalies/types.js';

export const explanationOutputSchema = z.object({
  explanation: z.string().min(10).max(400),
  suggestedAction: z.string().min(10).max(300),
  factsUsed: z.array(z.string()).default([]),
});

export type ExplanationOutput = z.infer<typeof explanationOutputSchema>;

export interface AnomalyExplanationResult {
  anomalyFingerprint: string;
  rule: string;
  severity: string;
  explanation: string;
  suggestedAction: string;
  factsUsed: string[];
}

export class AnomalyExplainer {
  constructor(private readonly llm: LLMProvider) {}

  public async explain(anomaly: DetectedAnomaly): Promise<AnomalyExplanationResult> {
    if (this.llm.name === 'mock' && ('hasCustomHandler' in this.llm ? !(this.llm as any).hasCustomHandler() : true)) {
      return this.generateDeterministicExplanation(anomaly);
    }

    // Mask PII (bank coordinates, IBAN, account numbers) before feeding to LLM
    const sanitizedEvidence = maskObjectPii(anomaly.evidence);
    const evidenceJson = JSON.stringify(sanitizedEvidence, null, 2);

    const systemPrompt = `
You are a senior payroll compliance auditor at PayPilot.
Your task is to write a concise 1-2 sentence explanation of the detected anomaly for a human payroll approver, plus a clear suggested action.

CRITICAL INVARIANTS:
1. STRICT FACTUAL GROUNDING: You may ONLY use facts, dates, names, and numbers explicitly present in the EVIDENCE JSON below.
2. ZERO NUMBER HALLUCINATION: NEVER invent, estimate, or hallucinate numbers, dollar values, percentages, or hours.
3. Length: Exactly 1 to 2 sentences for explanation. Exactly 1 sentence for suggestedAction.
4. Output RFC 8259 JSON matching the schema: {"explanation": "...", "suggestedAction": "...", "factsUsed": ["..."]}.
`.trim();

    const userPrompt = `
Flagged Anomaly:
- Rule: ${anomaly.rule}
- Severity: ${anomaly.severity}
- Summary: ${anomaly.summary}
- Entity: ${anomaly.entityType} (${anomaly.entityId})

EVIDENCE JSON:
${evidenceJson}
`.trim();

    try {
      const result = await this.llm.generateStructured({
        prompt: userPrompt,
        systemPrompt,
        schema: explanationOutputSchema,
        schemaName: 'AnomalyExplanation',
        temperature: 0.1, // Near-zero temperature to eliminate hallucination
      });

      this.verifyStrictFactuality(result.data.explanation, anomaly.evidence);

      return {
        anomalyFingerprint: anomaly.fingerprint,
        rule: anomaly.rule,
        severity: anomaly.severity,
        explanation: result.data.explanation,
        suggestedAction: result.data.suggestedAction,
        factsUsed: result.data.factsUsed ?? [],
      };
    } catch (err: any) {
      // Deterministic rule-based fallback if LLM is unavailable or fails verification
      return this.generateDeterministicExplanation(anomaly);
    }
  }

  /**
   * Verifies that any numbers appearing in the explanation text are strictly
   * derived from values present in the evidence object.
   */
  public verifyStrictFactuality(text: string, evidence: Record<string, unknown>): boolean {
    const numbersInText = text.match(/\b\d+(?:\.\d+)?\b/g) ?? [];
    if (numbersInText.length === 0) return true;

    // Extract all allowed numeric tokens from evidence
    const allowedNumericTokens = new Set<string>();
    const collectNumbers = (obj: unknown) => {
      if (typeof obj === 'number') {
        allowedNumericTokens.add(String(obj));
        // Add minor to major unit conversion (e.g. 500000 -> 5000)
        if (obj >= 100 && obj % 100 === 0) {
          allowedNumericTokens.add(String(obj / 100));
        }
        allowedNumericTokens.add(String(Math.round(obj)));
      } else if (typeof obj === 'string') {
        const matches = obj.match(/\b\d+(?:\.\d+)?\b/g);
        if (matches) matches.forEach((m) => allowedNumericTokens.add(m));
      } else if (Array.isArray(obj)) {
        obj.forEach(collectNumbers);
      } else if (obj && typeof obj === 'object') {
        Object.values(obj).forEach(collectNumbers);
      }
    };

    collectNumbers(evidence);

    // Common non-hallucinated sentence words with numbers (e.g. "1-2 sentences", "1 item")
    const benignNumbers = new Set(['1', '2', '7']); // 7 days window, 1-2 items

    for (const num of numbersInText) {
      if (!allowedNumericTokens.has(num) && !benignNumbers.has(num)) {
        throw new Error(
          `Factuality verification failed: Number '${num}' found in explanation but not present in evidence JSON.`,
        );
      }
    }

    return true;
  }

  private generateDeterministicExplanation(anomaly: DetectedAnomaly): AnomalyExplanationResult {
    const e = anomaly.evidence;
    let explanation = anomaly.summary;
    let suggestedAction = 'Review the transaction details with the finance team before approval.';

    switch (anomaly.rule) {
      case 'payroll.duplicate_payment':
        explanation = `Contractor '${e.contractorName ?? e.contractorId}' appears ${e.duplicatedItemCount ?? 2} times with identical amount in payroll run ${e.payrollRunId}. This indicates potential double-billing or re-submission.`;
        suggestedAction = 'Inspect line items and void the duplicate entry prior to processing.';
        break;
      case 'payroll.above_average_threshold':
        explanation = `Payout of ${Number(e.currentGrossMinor ?? 0) / 100} ${e.currency} is ${e.percentageIncrease}% higher than their historical 3-month average of ${Number(e.averageGrossMinor ?? 0) / 100} ${e.currency}.`;
        suggestedAction = 'Cross-reference submitted invoice timesheets or contract milestones to confirm authorized rate increase.';
        break;
      case 'payroll.missing_contractor':
        explanation = `Active contractor '${e.contractorName ?? e.contractorId}' has active contract status but was omitted from payroll run ${e.payrollRunId}.`;
        suggestedAction = 'Verify whether the contractor submitted invoices for this cycle or if their contract is paused.';
        break;
      case 'payroll.unusual_overtime':
        explanation = `Contractor '${e.contractorName ?? e.contractorId}' logged ${e.currentOvertimeHours} overtime hours, exceeding normal operational thresholds.`;
        suggestedAction = 'Request manager sign-off on the excess overtime hours.';
        break;
      case 'payroll.currency_change':
        explanation = `Contractor '${e.contractorName ?? e.contractorId}' payment was submitted in ${e.itemCurrency ?? e.currentCurrency}, differing from the expected profile currency ${e.expectedProfileCurrency ?? e.previousCurrency}.`;
        suggestedAction = 'Verify contractor payout banking details and signed currency addendum.';
        break;
      case 'payroll.recent_bank_change':
        explanation = `Contractor '${e.contractorName ?? e.contractorId}' bank account was modified ${e.daysSinceChange ?? 0} days prior to payroll execution.`;
        suggestedAction = 'Conduct out-of-band verification via phone or video call with the contractor before releasing funds.';
        break;
    }

    return {
      anomalyFingerprint: anomaly.fingerprint,
      rule: anomaly.rule,
      severity: anomaly.severity,
      explanation,
      suggestedAction,
      factsUsed: Object.keys(anomaly.evidence),
    };
  }
}
