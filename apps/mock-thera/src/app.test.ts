import { describe, expect, it } from 'vitest';
import { buildMockTheraApp } from './app.js';

describe('Mock Thera Server App', () => {
  it('GET /health returns healthy status without auth', async () => {
    const app = buildMockTheraApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'healthy', service: 'mock-thera' });
    await app.close();
  });

  it('rejects protected endpoints without valid Bearer token', async () => {
    const app = buildMockTheraApp({ token: 'secure-token' });

    const noAuth = await app.inject({ method: 'GET', url: '/v1/contractors' });
    expect(noAuth.statusCode).toBe(401);

    const badToken = await app.inject({
      method: 'GET',
      url: '/v1/contractors',
      headers: { authorization: 'Bearer wrong-token' },
    });
    expect(badToken.statusCode).toBe(401);

    const goodToken = await app.inject({
      method: 'GET',
      url: '/v1/contractors',
      headers: { authorization: 'Bearer secure-token' },
    });
    expect(goodToken.statusCode).toBe(200);
    await app.close();
  });

  it('handles x-mock-fail header for forced failure testing', async () => {
    const app = buildMockTheraApp({ token: 'test-token' });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/contractors',
      headers: {
        authorization: 'Bearer test-token',
        'x-mock-fail': 'true',
        'x-mock-fail-code': '502',
      },
    });

    expect(res.statusCode).toBe(502);
    expect(res.json().error).toBe('simulated_forced_failure');
    await app.close();
  });

  it('handles x-mock-fail-once for transient failure testing', async () => {
    const app = buildMockTheraApp({ token: 'test-token' });
    const key = `key-${Date.now()}`;

    // 1st attempt: fails 503
    const first = await app.inject({
      method: 'GET',
      url: '/v1/contractors',
      headers: {
        authorization: 'Bearer test-token',
        'x-mock-fail-once': key,
      },
    });
    expect(first.statusCode).toBe(503);

    // 2nd attempt: succeeds 200
    const second = await app.inject({
      method: 'GET',
      url: '/v1/contractors',
      headers: {
        authorization: 'Bearer test-token',
        'x-mock-fail-once': key,
      },
    });
    expect(second.statusCode).toBe(200);
    await app.close();
  });
});
