import { DatabaseAdapter } from './db.js';

/** The slice of PrismaClient we depend on; keeps the adapter interface narrow. */
export interface PrismaExecutor {
  $queryRaw<T>(query: TemplateStringsArray): Promise<T[]>;
}

let cached: PrismaExecutor | null = null;

/** Lazily construct the singleton PrismaClient (after `prisma generate`). */
export async function getPrismaExecutor(): Promise<PrismaExecutor> {
  if (cached !== null) return cached;
  const mod = await import('@prisma/client');
  cached = new mod.PrismaClient();
  return cached;
}

/** Convenient adapter for main.ts: Prisma-backed DB check. */
export async function createPostgresDatabase(): Promise<
  DatabaseAdapter & { executor: PrismaExecutor }
> {
  const { PostgresDatabase } = await import('./db.js');
  const executor = await getPrismaExecutor();
  const adapter = new PostgresDatabase(() => executor);
  return Object.assign(adapter, { executor });
}
