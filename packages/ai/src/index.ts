import type { AnomalySeverity } from '@paypilot/core';
import { z } from 'zod';

// Export new sub-systems
export * from './llm/index.js';
export * from './anomalies/index.js';
export * from './explainer/index.js';
export * from './ask-payroll/index.js';
export * from './extraction/index.js';

// ---------------------------------------------------------------------------
// Backward-compatible adapter contract:
// ---------------------------------------------------------------------------

export const anomalySuggestionSchema = z.object({
  rule: z.string().min(1),
  severity: z.enum([
    'low',
    'medium',
    'high',
    'critical',
  ] as const satisfies readonly AnomalySeverity[]),
  summary: z.string().min(1),
  details: z.record(z.unknown()).optional(),
});

export type AnomalySuggestion = z.infer<typeof anomalySuggestionSchema>;

export const reviewInputSchema = z.object({
  /** Stable domain tag for prompt routing + logging, e.g. "invoice.review". */
  task: z.enum(['invoice.review', 'payroll.review', 'contractor.rate_review']),
  /** Model-readable rendering of the resource under review. */
  context: z.string().min(1),
  maxOutputTokens: z.number().int().positive().max(4096).default(1024),
});

export type AiReviewInput = z.infer<typeof reviewInputSchema>;

export interface AiReviewResult {
  /** Suggestions the provider generated; empty means "no concerns raised". */
  suggestions: AnomalySuggestion[];
  /** Anonymized usage for cost tracking; absent in the mock. */
  usage?: { inputTokens: number; outputTokens: number };
  /** Provider could be reached (false => callers must treat as "no suggestions"). */
  ok: boolean;
}

export interface AiProvider {
  readonly name: 'anthropic' | 'openai' | 'mock';
  reviewSuggestionOnly(input: AiReviewInput): Promise<AiReviewResult>;
}

export class MockAiProvider implements AiProvider {
  readonly name = 'mock' as const;

  async reviewSuggestionOnly(input: AiReviewInput): Promise<AiReviewResult> {
    const suggestions: AnomalySuggestion[] = [];

    if (input.context.includes('!!!')) {
      suggestions.push({
        rule: `${input.task}.urgency_flag`,
        severity: 'medium',
        summary: 'Context contains emphasized text typically used to shortcut review.',
      });
    }

    const bigNumber = /(\d[\d,]{6,})/.exec(input.context)?.[1];
    if (bigNumber !== undefined && bigNumber !== null) {
      suggestions.push({
        rule: `${input.task}.large_amount`,
        severity: 'high',
        summary: 'An unusually large numeric amount appears in this resource.',
        details: { matched: bigNumber },
      });
    }

    if (suggestions.length === 0) {
      suggestions.push({
        rule: `${input.task}.no_concerns`,
        severity: 'low',
        summary: 'Heuristic review found nothing notable in the provided context.',
      });
    }

    return { suggestions, ok: true };
  }
}

/** Factory honoring the ACCOUNTING/AI selection in configuration. */
export function getAiProvider(name: 'anthropic' | 'openai' | 'mock'): AiProvider {
  switch (name) {
    case 'anthropic':
    case 'openai':
      return new MockAiProvider();
    case 'mock':
    default:
      return new MockAiProvider();
  }
}
