# PayPilot

A Slack-first payroll copilot, contractor invoice automation, and
accounting-connector platform, built as a pnpm monorepo.

- **Money moves only through human approval**: every payout starts as a
  `PaymentDraft`; nothing executes without a recorded human `Approval`.
- **Every external API sits behind an adapter interface** with a free,
  deterministic mock implementation (`@paypilot/connectors`, `@paypilot/ai`).
- **Every write is idempotent and audit-logged** (`Approval.idempotencyKey`,
  `AuditLog`).

## Repo structure

```
apps/api            Fastify + TS service (pino logging, request IDs, /health)
apps/web            Next.js + Tailwind (shadcn-ready) dashboard
apps/slack          Bolt JS worker in Socket Mode
packages/core       shared zod schemas + TS types (all domain entities)
packages/connectors accounting/payment adapters (QuickBooks/Xero, mock included)
packages/ai         anomaly-detection LLM adapters (mock included)
```

## One-command local setup

**Prerequisites:** Node >= 22 and pnpm (12.x), Docker (for Postgres only).

```bash
# 1. Start Postgres (only external process you need)
pnpm db:up                      # runs docker compose up -d (postgres:16-alpine)

# 2. Install + start everything in dev mode
pnpm install
pnpm dev                        # api:4000 + web:3000 in parallel (slack idles without tokens)
```

That's it — `pnpm dev` works with zero configuration because the API falls
back to the docker-compose Postgres defaults and mock adapters; no Slack/AI
credentials are required locally. All writes through the real connector are
still gated behind draft + approval, and the mock connector never moves money.

### First-run (optional) database sync

```bash
pnpm db:push     # push the Prisma schema to the local DB
```

## Other useful commands

| Command            | What it does                                    |
| ------------------ | ----------------------------------------------- |
| `pnpm test`        | Vitest across all packages (integration + unit) |
| `pnpm lint`        | ESLint across all packages                      |
| `pnpm typecheck`   | tsc --noEmit across all packages                |
| `pnpm format`      | Prettier (writes) / `pnpm format:check`         |
| `pnpm db:generate` | regenerate the Prisma client after schema edits |
| `pnpm db:studio`   | browse Postgres in Prisma Studio                |
| `pnpm db:down`     | stop the local Postgres container               |

## Configuration

Copy [.env.example](.env.example) to `apps/api/.env` if you want to override
the defaults (DATABASE_URL, LOG_LEVEL, SLACK_*, ACCOUNTING_CONNECTOR, AI_PROVIDER…).
Without a `.env`, everything runs on the local defaults + mocks.

## Testing

Per-package:

```bash
pnpm -C packages/core exec vitest run
pnpm -C packages/connectors exec vitest run
pnpm -C packages/ai exec vitest run
pnpm -C apps/api exec vitest run
pnpm -C apps/slack exec vitest run
```

Or everything: `pnpm test`.

## API quick check

```bash
curl -s http://localhost:4000/health
# {"status":"healthy","db":{"ok":true,"kind":"postgres"},"uptimeSeconds":…}
```

- Responses always carry `x-request-id` (inbound `x-request-id` is reused when
  well-formed, otherwise a UUID is generated and echoed on every response).
- Errors return `{error, requestId[, details]}` — 5xx messages are never leaked.
- structured logs are JSON (pretty local), one line per request with
  `requestId`, `statusCode`, and `duration`.

## Conventions

- strict TypeScript (`noUncheckedIndexedAccess` + more) — see `tsconfig.base.json`
- shared ESLint flat config in `eslint.config.mjs`, shared Prettier config
- zod for all validation, shared in `packages/core`

### Project rules (enforced in review)

1. Only free/open-source services — no paid SaaS dependencies.
2. Every external API goes behind an adapter interface, always with a mock
   implementation for tests and offline dev.
3. Never auto-move money — always create a draft requiring human approval.
4. Every write is idempotent and audit-logged.


Created by Me (Abhinav katare), Just for showing my potential to thera team and looking for my opportunity (remote internship) 