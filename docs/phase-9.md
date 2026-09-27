# Phase 9: Deployment and portfolio polish

Added optional Sentry integration for API/worker and Next.js with explicit data
collection restrictions, masked messages, no tracing/replay, and no initialization
without a DSN. Sentry v11's installed `dataCollection` API is used. Live event
delivery is deliberately unverified without credentials.

Every API request receives a server-generated request ID. Structured request logs
record method, route template, status and duration; they exclude bodies, cookies,
query strings and authentication values. Errors retain a consistent redacted format.
Private responses disable caching. Production origin and platform port configuration
are validated. Existing liveness and PostgreSQL/Redis readiness checks are preserved.

The admin operations page lists orders, allows paid-order fulfillment, exposes failed
notifications with retry controls, and surfaces uncertain payment attempts. Navigation
wraps on narrow screens; focus outlines and reduced-motion styles are explicit.
See the review document for the limits of the source/HTTP accessibility review.

Production Dockerfiles run unprivileged, omit environment files and use standalone
Next.js output. Railway API/worker config, Vercel monorepo config, direct migration
URL support, Dependabot and CI image builds are included. No images are pushed and
no cloud resources are created. Provider Git auto-deploy is an optional future setup
step after publication approval and CI gating.

Documentation covers architecture, database relationships, environment variables,
deployment/recovery, cost tradeoffs, security/accessibility limitations, and a portfolio
walkthrough. The seed remains additive and does not introduce default credentials.

Final local verification passed: formatting, lint, type checks, 29 unit/HTTP tests,
8 integration tests, Prisma validation and migration status, both production builds,
HTTP smoke, both Docker image builds, and API/web/worker container smoke as node.
No GitHub Actions run or public deployment is claimed; CI configuration is prepared.
