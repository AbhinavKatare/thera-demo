export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreakerOpenError extends Error {
  public readonly statusCode = 503;
  constructor(public readonly serviceName: string, public readonly resetTimeoutRemainingMs: number) {
    super(
      `Circuit breaker for service '${serviceName}' is OPEN. Requests are failing fast to protect upstream services. Retry in ${Math.ceil(
        resetTimeoutRemainingMs / 1000,
      )}s.`,
    );
    this.name = 'CircuitBreakerOpenError';
  }
}

export interface CircuitBreakerOptions {
  serviceName?: string;
  failureThreshold?: number;
  resetTimeoutMs?: number;
  successThreshold?: number;
}

export class CircuitBreaker {
  private state: CircuitBreakerState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;

  public readonly serviceName: string;
  public readonly failureThreshold: number;
  public readonly resetTimeoutMs: number;
  public readonly successThreshold: number;

  constructor(options?: CircuitBreakerOptions) {
    this.serviceName = options?.serviceName ?? 'thera-api';
    this.failureThreshold = options?.failureThreshold ?? 5;
    this.resetTimeoutMs = options?.resetTimeoutMs ?? 10_000;
    this.successThreshold = options?.successThreshold ?? 1;
  }

  public getState(): CircuitBreakerState {
    if (this.state === 'OPEN') {
      const now = Date.now();
      if (now - this.lastFailureTime >= this.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      }
    }
    return this.state;
  }

  public getMetrics() {
    return {
      state: this.getState(),
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  public reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }

  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'OPEN') {
      const remainingMs = Math.max(0, this.resetTimeoutMs - (Date.now() - this.lastFailureTime));
      throw new CircuitBreakerOpenError(this.serviceName, remainingMs);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successCount += 1;
      if (this.successCount >= this.successThreshold) {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
      }
    } else if (this.state === 'CLOSED') {
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount += 1;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      // Any failure during trial immediately re-opens the circuit
      this.state = 'OPEN';
    } else if (this.state === 'CLOSED' && this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
}
