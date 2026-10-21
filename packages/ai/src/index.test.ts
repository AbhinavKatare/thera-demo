import { describe, expect, it } from 'vitest';
import { getAiProvider, MockAiProvider, reviewInputSchema } from './index.js';

describe('MockAiProvider', () => {
  it('reviewSuggestionOnly always returns at least one suggestion', async () => {
    const provider = new MockAiProvider();
    const input = reviewInputSchema.parse({
      task: 'invoice.review',
      context: 'INV-0001 for 20 hours at 150.00 USD.',
    });
    const result = await provider.reviewSuggestionOnly(input);
    expect(result.ok).toBe(true);
    expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
  });

  it('flags large amounts', async () => {
    const provider = new MockAiProvider();
    const result = await provider.reviewSuggestionOnly(
      reviewInputSchema.parse({
        task: 'invoice.review',
        context: 'Invoice total 1,250,000 minor units requested.',
      }),
    );
    const ruleIds = result.suggestions.map((s) => s.rule);
    expect(ruleIds).toContain('invoice.review.large_amount');
  });

  it('maps unknown providers to the mock via getAiProvider', async () => {
    const provider = getAiProvider('openai');
    expect(provider.name).toBe('mock');
  });
});
