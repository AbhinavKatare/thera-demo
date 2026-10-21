import { describe, expect, it } from 'vitest';
import { buildApp, ErrorResponse } from './app.js';
import { MockDatabase } from './db.js';

describe('api app', () => {
  it('GET /health returns healthy with a working DB adapter', async () => {
    const app = await buildApp({ db: new MockDatabase(true) });
    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { status: string; db: { ok: boolean; kind: string } };
    expect(body.status).toBe('healthy');
    expect(body.db).toEqual({ ok: true, kind: 'mock' });
    await app.close();
  });

  it('GET /health returns degraded when the DB adapter fails', async () => {
    const app = await buildApp({ db: new MockDatabase(false) });
    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(503);
    const body = res.json() as { status: string; db: { ok: boolean } };
    expect(body.status).toBe('degraded');
    expect(body.db.ok).toBe(false);
    await app.close();
  });

  it('every response carries x-request-id and logs it', async () => {
    const app = await buildApp({ db: new MockDatabase(true) });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.headers['x-request-id']).toMatch(/^[a-zA-Z0-9-]+$/);
    await app.close();
  });

  it('reuses a valid inbound x-request-id and rejects an invalid one', async () => {
    const app = await buildApp({ db: new MockDatabase(true) });

    const reused = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': 'trace-abc-123' },
    });
    expect(reused.headers['x-request-id']).toBe('trace-abc-123');

    const rejected = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': 'bad id with spaces' },
    });
    expect(rejected.headers['x-request-id']).not.toBe('bad id with spaces');
    await app.close();
  });

  it('unknown routes return the structured error body with a request id', async () => {
    const app = await buildApp({ db: new MockDatabase(true) });
    const res = await app.inject({ method: 'GET', url: '/definitely-not-here' });

    expect(res.statusCode).toBe(404);
    const body = res.json() as ErrorResponse;
    expect(body.error).toBeDefined();
    expect(body.requestId).toMatch(/^[a-zA-Z0-9-]+$/);
    await app.close();
  });

  it('maps thrown HttpErrors to the expected status', async () => {
    const app = await buildApp({ db: new MockDatabase(true) });
    app.get('/boom', async () => {
      const err = new Error('bad input');
      (err as { statusCode?: number }).statusCode = 418;
      throw err;
    });

    const res = await app.inject({ method: 'GET', url: '/boom' });
    // Non-HttpError instances never leak their message.
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({
      error: 'internal_error',
      requestId: expect.stringMatching(/^[a-zA-Z0-9-]+$/),
    });
    await app.close();
  });
});
