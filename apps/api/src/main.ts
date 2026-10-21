import 'dotenv/config';
import { buildApp } from './app.js';
import { createLogger } from './logging.js';
import { createPostgresDatabase } from './prisma.js';

const DEFAULT_DATABASE_URL = 'postgresql://paypilot:paypilot@localhost:5432/paypilot?schema=public';

async function main(): Promise<void> {
  const logger = createLogger();

  if (process.env.DATABASE_URL === undefined) {
    // One-command local setup: fall back to the docker-compose defaults.
    logger.warn(
      { url: DEFAULT_DATABASE_URL },
      'DATABASE_URL not set; using local docker-compose Postgres defaults (run: pnpm db:up)',
    );
    process.env.DATABASE_URL = DEFAULT_DATABASE_URL;
  }

  const db = await createPostgresDatabase();

  const app = await buildApp({ logger, db });

  const port = Number(process.env.PORT) || 4000;
  const host = process.env.HOST || '0.0.0.0';

  await app.listen({ port, host });
  logger.info({ port, host }, 'paypilot api listening');
}

void main().catch((err) => {
  // Surface startup failures with a fatal log and a non-zero exit code.
  console.error(err);
  process.exit(1);
});
