import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  createLLMProvider,
  MockLLMProvider,
  RateLimiter,
} from './index.js';

describe('LLMProvider & RateLimiter', () => {
  it('creates providers based on env or parameter', () => {
    const mock = createLLMProvider('mock');
    expect(mock.name).toBe('mock');

    const gemini = createLLMProvider('gemini', { apiKey: 'dummy' });
    expect(gemini.name).toBe('gemini');

    const groq = createLLMProvider('groq', { apiKey: 'dummy' });
    expect(groq.name).toBe('groq');

    const ollama = createLLMProvider('ollama');
    expect(ollama.name).toBe('ollama');
  });

  it('tracks token and request metrics accurately', async () => {
    const provider = new MockLLMProvider();
    await provider.generateText({ prompt: 'Hello PayPilot AI' });

    const metrics = provider.getMetrics();
    expect(metrics.totalRequests).toBe(1);
    expect(metrics.successfulRequests).toBe(1);
    expect(metrics.failedRequests).toBe(0);
    expect(metrics.inputTokens).toBeGreaterThan(0);
    expect(metrics.outputTokens).toBeGreaterThan(0);
  });

  it('validates structured JSON output with Zod schema', async () => {
    const schema = z.object({
      category: z.string(),
      score: z.number(),
    });

    const provider = new MockLLMProvider(() =>
      JSON.stringify({ category: 'payroll_compliance', score: 98 }),
    );

    const result = await provider.generateStructured({
      prompt: 'Score the compliance',
      schema,
    });

    expect(result.data.category).toBe('payroll_compliance');
    expect(result.data.score).toBe(98);
    expect(result.retryCount).toBe(0);
  });

  it('retries on invalid JSON or schema mismatch and recovers', async () => {
    let callCount = 0;
    const schema = z.object({
      status: z.enum(['APPROVED', 'REJECTED']),
    });

    const provider = new MockLLMProvider(() => {
      callCount++;
      if (callCount === 1) {
        // First attempt returns invalid markdown with malformed JSON
        return '```json\n{ status: INVALID_SYNTAX }\n```';
      }
      // Second attempt returns valid schema JSON
      return JSON.stringify({ status: 'APPROVED' });
    });

    const result = await provider.generateStructured({
      prompt: 'Check status',
      schema,
      maxRetries: 3,
    });

    expect(result.data.status).toBe('APPROVED');
    expect(result.retryCount).toBe(1);
    expect(callCount).toBe(2);
  });

  it('rate limiter tracks sliding window usage and limits spikes', async () => {
    const limiter = new RateLimiter({ maxRequestsPerMinute: 2, maxTokensPerMinute: 1000 });

    await limiter.acquire(100);
    await limiter.acquire(100);

    const usage = limiter.getCurrentUsage();
    expect(usage.requestCount).toBe(2);
    expect(usage.tokenCount).toBe(200);
  });
});
