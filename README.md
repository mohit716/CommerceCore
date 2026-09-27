# CommerceCore

A portfolio ecommerce application built incrementally as a modular monolith.
This repository currently contains **Phase 1: project foundation only**.

## Requirements

- Node.js 24 (see `.node-version`)
- pnpm 10.32.1 (pinned in `package.json`)
- Docker Desktop with Linux containers and Docker Compose v2

If pnpm is not installed, use `npm exec --yes --package=pnpm@10.32.1 -- pnpm`
in place of `pnpm` in the commands below. This does not require a global install.

## Start locally

From the repository root, in PowerShell:

```powershell
Copy-Item .env.example .env
Copy-Item apps/web/.env.example apps/web/.env.local
pnpm install --frozen-lockfile
pnpm infra:up
pnpm db:validate
pnpm dev
```

Copy the environment files only on first setup; preserve existing local settings.
On macOS/Linux, replace `Copy-Item` with `cp`.

| Service                      | Address                                   |
| ---------------------------- | ----------------------------------------- |
| Web                          | http://localhost:3000                     |
| API liveness                 | http://localhost:3001/api/v1/health/live  |
| API readiness                | http://localhost:3001/api/v1/health/ready |
| Same-origin web health proxy | http://localhost:3000/api/health          |
| PostgreSQL                   | localhost:5432                            |
| Redis                        | localhost:6379                            |
| Mailpit web inbox            | http://localhost:8025                     |
| Mailpit SMTP                 | localhost:1025                            |

`pnpm infra:down` stops the containers and preserves database/Redis volumes.
The development credentials in `.env.example` are only for local use.
Compose binds ports to loopback, so these services are not exposed to the LAN.
Changing PostgreSQL credentials after initializing the volume requires changing the
database role credentials too; changing `.env` alone does not update an existing database.

## Repository layout

```text
apps/
  web/                     Next.js App Router, React, TypeScript, Tailwind CSS
    src/app/               Pages and the fixed health proxy route
    src/components/        Shared UI components as they are introduced
    src/features/          Feature-specific UI as it is introduced
    src/lib/               Server/client utilities
    test/                  Node test runner tests
  api/                     NestJS application
    src/common/config/     Validated environment configuration
    src/infrastructure/    PostgreSQL and Redis health connections
    src/modules/health/    Liveness and readiness endpoints
    prisma/                Prisma schema and future migrations
    test/                  Configuration and HTTP contract tests
      integration/         Tests using real PostgreSQL and Redis
packages/                  Reserved for shared packages introduced when needed
docs/                      Architecture notes and future decisions
.github/workflows/ci.yml    Validation pipeline
compose.yaml               Local PostgreSQL, Redis, and Mailpit
```

## Configuration

NestJS and the Prisma CLI load `apps/api/.env` if present, then the root `.env`.
Existing process environment values take precedence. Run commands through the workspace
scripts so each app uses its expected working directory.

NestJS validates `NODE_ENV`, `API_PORT`, `WEB_ORIGIN`, `DATABASE_URL`, and `REDIS_URL`
at startup. Missing or invalid connection settings prevent startup, with field names
reported instead of secret values. HTTP URLs are rejected for database/Redis connections.

Next.js loads `apps/web/.env.local`. `API_INTERNAL_URL` is server-only and defaults
to `http://localhost:3001`. The root environment file is not automatically loaded by
Next.js. If you change `API_PORT`, also update `API_INTERNAL_URL`.
SMTP settings are documented for the local inbox; there is no email-sending code yet.

## Health semantics

- **Live:** the HTTP process can respond; this endpoint does not depend on infrastructure.
- **Ready:** performs PostgreSQL `SELECT 1` and Redis `PING` in parallel. Returns `200`
  when both succeed, or `503` with `up`/`down` indicators when either fails.
- Probes use short timeouts and never expose connection strings in responses.
- The web health route uses a fixed upstream path, disables caching, and returns a
  generic `503` on a backend error or timeout.
- Mailpit is optional development tooling and does not gate API readiness.

The API uses Nest's JSON console logger, Helmet, an explicit CORS origin, and graceful
connection shutdown. Authentication and ecommerce-specific middleware arrive in later phases.

## Prisma initialization

The Prisma 7 configuration separates the connection URL (`prisma.config.ts`) from the
schema (`prisma/schema.prisma`). The schema intentionally contains **no domain models**.
There are no migrations or fabricated placeholder tables in Phase 1.

```powershell
pnpm db:validate
```

Client generation, the PostgreSQL Prisma adapter, repository wiring, and the first migration
will be added with actual models in Phase 2. `db:generate`, `db:migrate`, and `db:deploy`
are prepared as API package scripts for that phase; no migration or client generation is
required for the current application. The small `pg` pool currently exists only for readiness.

## Quality checks

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm db:validate
pnpm build
# Requires pnpm infra:up:
pnpm test:integration
```

`pnpm format` applies formatting. `pnpm test` runs environment validation, API HTTP
health contracts with controlled dependency failures, and the web health proxy tests.
`pnpm test:integration` boots the real Nest application and queries real PostgreSQL/Redis;
it fails rather than silently skips when those services are unavailable.

Node's built-in test runner keeps the foundation small. API tests are compiled with
TypeScript first so Nest's decorator metadata is preserved. `next typegen` runs before
the web type check so route types also exist on a clean checkout.

ESLint is currently pinned to the 9.x major for compatibility with the React, import, and
accessibility plugins in Next.js's configuration. ESLint 9 is deprecated upstream; upgrade
the lint stack together once those plugins support ESLint 10. The lockfile fixes the exact
installed versions for reproducible local and CI runs.

GitHub Actions installs the frozen lockfile, starts Compose, checks formatting/lint/types,
validates Prisma, runs both test suites, verifies Mailpit, and builds both applications.
It runs on pull requests, pushes to `main`, and manual dispatch. Cloud deployments are
not configured in Phase 1.

After building, use `pnpm --filter @commerce-core/api start` and
`pnpm --filter @commerce-core/web start` in separate terminals to run production builds.

## Scope

No auth, products, cart, checkout, payment, queues, storage integrations, or domain models
are implemented yet. Redis is connected for readiness only; BullMQ arrives with actual jobs.
Future modules follow controller → service → data-access boundaries without generating
unused boilerplate now. See [architecture notes](docs/architecture.md).
