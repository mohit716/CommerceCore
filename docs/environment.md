# Environment reference

Copy templates only when they do not already exist. Never commit `.env`, provider
keys, database passwords, session cookies, or deployment tokens.

| Variable                                               | Consumer              | Purpose                                                         |
| ------------------------------------------------------ | --------------------- | --------------------------------------------------------------- |
| NODE_ENV                                               | API/worker            | development, test, production; production requires HTTPS origin |
| API_PORT / PORT                                        | API                   | API_PORT defaults 3001; platform PORT overrides listener        |
| WEB_ORIGIN                                             | API/worker            | Exact frontend origin for CSRF and Stripe redirect URLs         |
| DATABASE_URL                                           | API/worker            | PostgreSQL runtime URL; URL-encode credentials                  |
| DIRECT_URL                                             | Prisma CLI            | Optional direct migration URL, otherwise DATABASE_URL           |
| REDIS_URL                                              | API/worker            | Redis protocol URL; use rediss for external TLS                 |
| POSTGRES_USER/PASSWORD/DB                              | Local Compose         | Local database initialization settings                          |
| PROCESS_ROLE                                           | API/worker            | api by default; worker entrypoint sets worker itself            |
| SMTP_HOST/PORT                                         | Worker                | Local defaults localhost / 1025 (Mailpit)                       |
| SMTP_SECURE                                            | Worker                | true for implicit TLS (usually 465), false for STARTTLS/local   |
| SMTP_USER/PASSWORD                                     | Worker                | Optional pair for production SMTP authentication                |
| MAIL_FROM                                              | Worker                | Verified production sender; local example.test sender otherwise |
| STRIPE_SECRET_KEY                                      | API/worker            | Optional sk_test_ key; live keys rejected                       |
| STRIPE_WEBHOOK_SECRET                                  | API/worker            | Matching whsec_ secret; configure with Stripe key               |
| CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET/UPLOAD_PRESET | API                   | Optional complete group; signed preset required                 |
| SENTRY_DSN                                             | API/worker/web server | Optional HTTPS monitoring DSN; empty disables initialization    |
| NEXT_PUBLIC_SENTRY_DSN                                 | Browser               | Optional public DSN embedded at web build time                  |
| API_INTERNAL_URL                                       | Next.js server        | Backend base URL; never expose via NEXT_PUBLIC_                 |

Local root `.env` is loaded by NestJS/Prisma; Next.js reads `apps/web/.env.local`.
Cloud variables belong in the hosting provider's secret settings. Cloudinary API
keys are not the API secret; neither database nor Stripe secrets belong in frontend
environment variables. A Sentry DSN is a routing identifier, but enabling telemetry
still requires deliberate configuration and verification.

Database URLs support a `schema` query parameter for test isolation. Production
uses `public`. The Prisma pool is capped at five connections per process; readiness
uses a separate pool capped at two. Start with one API and one worker replica.

CI uses `.env.example` and disposable local services. All provider tests use explicit
fixtures. Do not add real provider secrets to pull-request test jobs.
