# Portfolio walkthrough

## Five-minute demo

1. Start local infrastructure, web/API and worker; seed the catalog. Open Swagger.
2. Filter/search products and inspect a detail page. Explain integer prices and indexes.
3. Sign up, add items, edit quantities, and show the cart survives a page reload.
4. Create an order. Explain the transaction, stock reservations, snapshots and
   idempotency header in the API contract. Do not enter a real payment card.
5. Without Stripe credentials, show the explicit configuration message and run
   the signed webhook integration tests. With separately authorized test credentials,
   complete hosted Stripe test checkout and refresh the order confirmation.
6. Show order history, the admin catalog/stock audit, and `/admin/operations`.
7. Open Mailpit and demonstrate confirmation delivery using the background test.
8. Show CI and the architecture diagram; describe what remains unverified externally.

## Evidence worth discussing in an interview

- `test/integration/orders.test.ts`: two customers compete for one unit; exactly one
  order commits. Multi-item failures roll back reservations and cart changes.
- `test/integration/payments.test.ts`: ambiguous provider response recovery, duplicate
  signatures/events, amount/currency mismatch, delayed events, expiration safety.
- `test/integration/background.test.ts`: cache invalidation, Redis disconnect/recovery,
  rate limits, queue failures, SMTP retry, actual BullMQ delivery to Mailpit.
- `scripts/smoke.mjs`: production Next.js + API, isolated database migrations, proxy
  auth/CSRF, cart, checkout, order history and admin operations pages.
- Explain why order creation and email intent share a database transaction, while
  network calls occur outside it; why email is at least once; and why uncertain
  payments retain inventory instead of trusting an elapsed timer.

## Suggested project description

Built a full-stack ecommerce modular monolith with Next.js, NestJS and PostgreSQL.
Implemented transactional inventory reservations, idempotent checkout, verified Stripe
test webhooks, and a PostgreSQL outbox feeding BullMQ email jobs. Added isolated
integration tests for concurrent checkout, provider retries and Redis recovery,
plus production-build smoke tests and deployable container configuration.

Only claim a live deployment, real-provider verification, or browser accessibility
testing after performing it. Include a short recording and test output in the
portfolio; never include environment files, tokens, customer addresses or passwords.
