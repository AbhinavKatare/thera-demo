import { buildMockTheraApp } from './app.js';

const port = Number(process.env.MOCK_THERA_PORT ?? 4100);
const host = process.env.MOCK_THERA_HOST ?? '127.0.0.1';
const token = process.env.MOCK_THERA_TOKEN ?? 'mock-thera-secret-token';
const defaultLatencyMs = Number(process.env.MOCK_THERA_LATENCY_MS ?? 50);
const failureRate = Number(process.env.MOCK_THERA_FAILURE_RATE ?? 0);

async function main() {
  const app = buildMockTheraApp({
    token,
    defaultLatencyMs,
    failureRate,
  });

  try {
    const address = await app.listen({ port, host });
    console.log(`🚀 Mock Thera server listening on ${address}`);
    console.log(`   Config: token=${token}, latency=${defaultLatencyMs}ms, failureRate=${failureRate * 100}%`);
  } catch (err) {
    console.error('Failed to start Mock Thera server:', err);
    process.exit(1);
  }
}

void main();
