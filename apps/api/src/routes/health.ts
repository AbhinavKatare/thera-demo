import { FastifyInstance } from 'fastify';

const MAX_HEALTH_LATENCY_MS = 3000;

export interface HealthResponse {
  status: 'healthy' | 'degraded';
  db: { ok: boolean; kind: string };
  uptimeSeconds: number;
  timestamp: string;
}

export async function healthRoute(app: FastifyInstance): Promise<void> {
  app.get('/health', async (request, reply) => {
    const started = Date.now();
    let dbOk = false;
    try {
      dbOk = (await Promise.race([
        app.db.ping(),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), MAX_HEALTH_LATENCY_MS)),
      ])) as boolean;
    } catch {
      dbOk = false;
    }
    const dbLatencyMs = Date.now() - started;

    const body: HealthResponse = {
      status: dbOk ? 'healthy' : 'degraded',
      db: { ok: dbOk, kind: app.db.kind },
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
    request.log.info(
      { dbOk, dbKind: app.db.kind, dbLatencyMs, requestId: request.id },
      'health check',
    );
    return reply.status(dbOk ? 200 : 503).send(body);
  });
}
