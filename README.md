# CommerceCore

A startup-style ecommerce portfolio application: Next.js, NestJS, PostgreSQL/Prisma,
Redis/BullMQ, and Stripe test payments in a modular monolith.

The interesting parts live behind the storefront: atomic inventory reservations,
last-unit concurrency protection, request-hash idempotency, payment webhook safety,
a transactional outbox, and cache invalidation that survives Redis outages.

## Run locally

Requires Node.js 24, pnpm 10.32.1, and Docker Desktop with Linux containers.
If pnpm is unavailable, substitute `npm exec --yes --package=pnpm@10.32.1 -- pnpm`.
Copy environment templates only on first setup; preserve existing `.env` files.

```powershell
Copy-Item .env.example .env
Copy-Item apps/web/.env.example apps/web/.env.local
pnpm install --frozen-lockfile
pnpm infra:up
pnpm --filter @commerce-core/api db:generate
pnpm --filter @commerce-core/api db:deploy
pnpm --filter @commerce-core/api db:seed
pnpm dev
```

In another terminal, run `pnpm dev:worker`. The seed inserts missing demo records
without overwriting existing products or inventory. Signup creates customers only.
To grant your own chosen account admin access, review and run
`pnpm admin:promote your-email@example.com --confirm`.

| Service                   | Local address                                       |
| ------------------------- | --------------------------------------------------- |
| Storefront                | http://localhost:3000                               |
| API documentation         | http://localhost:3001/docs                          |
| OpenAPI JSON              | http://localhost:3001/openapi.json                  |
| Liveness / readiness      | http://localhost:3001/api/v1/health/live and /ready |
| Mailpit inbox             | http://localhost:8025                               |
| PostgreSQL / Redis / SMTP | localhost:5432 / 6379 / 1025                        |

Compose binds infrastructure ports to loopback. `pnpm infra:down` stops containers
without deleting volumes. Never use volume-reset commands against valuable data.

## Verification

```sh
pnpm --filter @commerce-core/api db:generate
pnpm --filter @commerce-core/api db:deploy
pnpm verify
```

The full gate runs formatting, lint, type checks, unit/HTTP tests, Prisma validation,
real PostgreSQL/Redis/Mailpit integration tests, production builds, and an end-to-end
HTTP smoke test through the built Next.js proxy and NestJS API. Individual commands:
`pnpm test`, `pnpm test:integration`, `pnpm build`, `pnpm test:smoke`.

Tests create unique PostgreSQL schemas and queue namespaces. They do not reset your
catalog, promote your account, stop shared infrastructure, or delete your mailbox.
Stripe API calls and Cloudinary responses are mocked. Stripe signatures are verified
with the SDK using local test fixtures. The HTTP smoke suite is not a browser-driven
accessibility audit; see the review document for remaining manual checks.

## Features and boundaries

- Searchable, filtered, paginated catalog and product detail pages.
- Sessions, HttpOnly cookies, CSRF protection, customer/admin roles and ownership checks.
- Admin catalog, signed Cloudinary uploads, archival, and inventory adjustment audit trail.
- Persistent versioned carts with server prices; transactional checkout and order snapshots.
- Stripe hosted test checkout, event deduplication, state validation, and reconciliation.
- Order history, confirmation state, admin fulfillment, and failed-job visibility/retry.
- Redis catalog cache and rate limits; BullMQ confirmation emails via a durable outbox.
- Request IDs, structured logs, optional Sentry, health checks, Dockerfiles, and CI.

Payments require Stripe test credentials. Image uploads require Cloudinary credentials.
Sentry and production SMTP are optional until configured. No real credentials are
committed; no live provider verification or public deployment has been performed.
Unconfigured payment/upload endpoints return a clear 503.

This is a US/USD test store with no shipping fee or tax calculation. It is not ready
for real trading: refunds, returns, tax, privacy retention workflows, email verification,
password reset, and live-provider acceptance testing are follow-up work.

## Repository

```text
apps/web/src/app/              Storefront, account, checkout, orders, admin, same-origin proxy
apps/web/src/features/         Catalog/auth/admin/cart/order React UI
apps/api/src/modules/          Auth, users, products, categories, inventory, cart,
                              orders, payments, notifications, health (one monolith)
apps/api/src/infrastructure/   PostgreSQL, Prisma, Redis/cache adapters
apps/api/src/common/           Configuration, guards, errors, monitoring
apps/api/src/worker.ts         Background process using the same modules/database
apps/api/prisma/               Relational schema, additive migrations, demo seed
apps/api/test/                 Unit, HTTP, provider-mock and real integration tests
scripts/                      Verification, isolated production smoke, explicit admin CLI
.github/workflows/            CI, including local image builds without publishing
 deploy/                      Railway API/worker configuration
```

## Portfolio guide

- [Architecture and invariants](docs/architecture.md)
- [Implementation phase record](docs/implementation-progress.md)
- [Cart](docs/phase-5.md), [order engine](docs/phase-6.md), [payments](docs/phase-7.md), [jobs/cache](docs/phase-8.md)
- [Environment reference](docs/environment.md)
- [Deployment runbook](docs/deployment.md)
- [Security and accessibility review](docs/review.md)
- [Demo walkthrough](docs/portfolio-walkthrough.md)

The API and worker are two processes of one modular monolith. There are no
microservices, Kafka, Kubernetes, or distributed transaction coordinators.
