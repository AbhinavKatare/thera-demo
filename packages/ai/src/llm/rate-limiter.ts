import { RateLimiterOptions } from './types.js';

interface RequestTimestamp {
  timestamp: number;
  tokens: number;
}

export class RateLimiter {
  private readonly maxRequestsPerMinute: number;
  private readonly maxTokensPerMinute: number;
  private readonly windowMs: number = 60_000;
  private readonly requests: RequestTimestamp[] = [];

  constructor(options: RateLimiterOptions = {}) {
    // Default free tier limits: 15 RPM, 30,000 TPM (safe default for Gemini/Groq free tiers)
    this.maxRequestsPerMinute = options.maxRequestsPerMinute ?? 15;
    this.maxTokensPerMinute = options.maxTokensPerMinute ?? 30_000;
  }

  private pruneOldRequests(now: number): void {
    const cutoff = now - this.windowMs;
    while (this.requests.length > 0 && this.requests[0]!.timestamp <= cutoff) {
      this.requests.shift();
    }
  }

  public getCurrentUsage(): { requestCount: number; tokenCount: number } {
    const now = Date.now();
    this.pruneOldRequests(now);
    const tokenCount = this.requests.reduce((sum, r) => sum + r.tokens, 0);
    return { requestCount: this.requests.length, tokenCount };
  }

  public async acquire(estimatedTokens: number = 100): Promise<void> {
    while (true) {
      const now = Date.now();
      this.pruneOldRequests(now);

      const currentTokens = this.requests.reduce((sum, r) => sum + r.tokens, 0);

      const requestLimitReached = this.requests.length >= this.maxRequestsPerMinute;
      const tokenLimitReached = currentTokens + estimatedTokens > this.maxTokensPerMinute;

      if (!requestLimitReached && !tokenLimitReached) {
        this.requests.push({ timestamp: now, tokens: estimatedTokens });
        return;
      }

      // Calculate how long to sleep until the oldest request leaves the 60s window
      const oldest = this.requests[0];
      const waitMs = oldest ? Math.max(50, oldest.timestamp + this.windowMs - now + 50) : 500;

      await new Promise((resolve) => setTimeout(resolve, Math.min(waitMs, 2000)));
    }
  }

  public recordActualUsage(estimatedTokens: number, actualTokens: number): void {
    // Adjust the last request tokens with actual values if known
    if (this.requests.length > 0) {
      const last = this.requests[this.requests.length - 1]!;
      last.tokens = Math.max(1, last.tokens - estimatedTokens + actualTokens);
    }
  }
}
