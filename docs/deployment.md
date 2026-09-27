# Deployment runbook (prepared, not deployed)

These are reviewable instructions, not a record of a public deployment. Creating
cloud services, using real credentials, and publishing require separate approval.

## Low-cost topology

Use Vercel for the personal demo frontend, Railway for API + worker + Redis, and
Neon for PostgreSQL. Keep one API replica, one worker replica, and one Redis service.
Vercel Hobby is for personal non-commercial projects. Railway has a minimum usage
commitment and resource-based charges; do not assume a free always-on worker.
See [Vercel plans](https://vercel.com/pricing), [Railway pricing](https://docs.railway.com/pricing),
and [Neon plans](https://neon.com/pricing) before provisioning. Set spending limits.

The ten-second worker poll keeps a database active. For an infrequently demonstrated
portfolio, stop the worker/API between sessions if accepting delayed emails and
reconciliation; resume the worker before reopening the demo. A sleeping worker must
not be presented as continuously processing reservations. Local Docker is the
zero-hosting-cost option.

## PostgreSQL and Redis

Create a dedicated Neon database and role. Start with its direct TLS connection URL
for this small two-process deployment; set DATABASE_URL and DIRECT_URL securely.
The small pool sizes avoid requiring an extra pooler. If adopting the Neon pooler,
verify schema/search_path options against the provider and retain a direct migration
URL. Never weaken certificate verification to fix a connection error.

Use a Redis service supporting TCP/TLS persistent connections, Lua, and BullMQ's
blocking operations. Configure AOF persistence and maxmemory-policy=noeviction.
An HTTP-only cache API is insufficient. Use private networking inside Railway and
avoid publishing Redis publicly. Rotate credentials through provider settings.

## Backend and worker on Railway

Use repository root as the build context. Select `deploy/railway-api.json` for the
API service and `deploy/railway-worker.json` for the worker. Both build
`apps/api/Dockerfile`; their start commands differ. Set NODE_ENV=production,
WEB_ORIGIN to the exact HTTPS frontend origin, DATABASE_URL, DIRECT_URL and REDIS_URL.
The API listens on Railway's PORT. The worker has no public HTTP endpoint.

The API pre-deploy command runs `npm run db:deploy`. Review SQL and take a database
backup before applying future migrations. Do not run migrate dev or reset against
cloud data. Deploy additive migrations before the new worker. Roll back application
images independently; do not automatically reverse data migrations.

Configure Stripe test keys/webhook secret and register only required Checkout Session
events at `https://API_HOST/api/v1/payments/webhook`. Configure SMTP credentials and
a verified sender for email. Without those secrets, local mocks do not turn into
real provider behavior. Cloudinary uses a signed restricted upload preset; see Phase 4.

Health checks: `/api/v1/health/live` tests process liveness; `/api/v1/health/ready`
checks PostgreSQL and Redis. Watch worker startup/error logs, failed notification
counts, oldest pending outbox age, and PAYMENT_REVIEW_REQUIRED events. The admin
operations page shows failures and offers notification retries. Investigate uncertain
Stripe attempts in the provider dashboard before any manual database intervention.

## Frontend on Vercel

Import the monorepo with Root Directory `apps/web`; enable access to workspace files
outside that directory. The checked-in vercel.json selects Next.js and pnpm commands.
Set API_INTERNAL_URL to the HTTPS backend origin, then optional SENTRY_DSN and
NEXT_PUBLIC_SENTRY_DSN. Never set database, Stripe, SMTP or Cloudinary secrets here.
The browser uses a fixed same-origin proxy; session cookies need no cross-site domain.
WEB_ORIGIN on the API must match the chosen frontend deployment exactly. Preview
origins require separate backend configuration; do not add wildcard CSRF origins.

Connecting Git auto-deploy can publish future commits. Enable it only after approval
and after configuring provider checks to wait for successful GitHub CI. CI itself
builds images without pushing them or applying migrations to cloud databases.

## Local production image checks

```sh
docker build -f apps/api/Dockerfile -t commercecore-api:local .
docker build -f apps/web/Dockerfile -t commercecore-web:local .
pnpm test:containers
```

Images run as the unprivileged node user. `.dockerignore` excludes local secrets and
build artifacts. The backend retains the Prisma CLI for pre-deploy migration support;
it does not bundle the frontend. The web image uses Next.js standalone output.
Runtime secrets must be injected, never baked into image layers. For container-to-host
development services, use host.docker.internal instead of localhost in runtime URLs.
The container smoke script joins the existing commercecore_default Compose network,
uses only a temporary database schema, checks API/web/worker startup as the node user,
then stops only its own temporary containers. CI runs the same smoke after image builds.

References: [Railway configuration](https://docs.railway.com/config-as-code/reference),
[Vercel monorepos](https://vercel.com/docs/monorepos),
[Prisma connection URLs](https://docs.prisma.io/docs/orm/v7/reference/connection-urls).
