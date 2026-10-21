/**
 * Adapter contract so everything (including /health) can be tested without a
 * running Postgres. Real check goes through Prisma; the mock has no I/O.
 */
export interface DatabaseAdapter {
  /** Returns true if a trivial round-trip query succeeds. */
  ping(): Promise<boolean>;
  /** Free-form availability line for /health. */
  readonly kind: string;
}

export class PostgresDatabase implements DatabaseAdapter {
  readonly kind = 'postgres';

  constructor(
    /** Lazy import keeps test environments from loading @prisma/client at all. */
    private readonly getExecutor: () => { $queryRaw<T>(query: TemplateStringsArray): Promise<T[]> },
  ) {}

  async ping(): Promise<boolean> {
    const db = this.getExecutor();
    await db.$queryRaw`SELECT 1`;
    return true;
  }
}

export class MockDatabase implements DatabaseAdapter {
  readonly kind = 'mock';

  constructor(private readonly healthy = true) {}

  async ping(): Promise<boolean> {
    return this.healthy;
  }
}
