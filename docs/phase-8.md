# Phase 8: Caching and background processing

Run the API and a worker from the same modular-monolith codebase:
`pnpm dev:api`, `pnpm dev:web`, and `pnpm dev:worker`. Production worker entrypoint:
`pnpm --filter @commerce-core/api start:worker`. Both use the same PostgreSQL/Redis
configuration; only the worker processes jobs and runs reconciliation every ten seconds.

## Durable notifications

Payment confirmation inserts an OutboxEvent in the payment transaction. A dispatcher
enqueues its ID with BullMQ. Redis failure leaves the database event available for
retry. BullMQ uses exponential retry/backoff; periodic dispatch can recover lost
Redis jobs. A database lease prevents concurrent deliveries, and delivered events
are ignored. After ten attempts, events remain visible via admin-only
GET `/api/v1/admin/jobs`; POST `/api/v1/admin/jobs/:id/retry` restarts failed delivery.
The same status endpoint shows uncertain payments requiring review.

Delivery is at least once. SMTP has no universal idempotency API: a crash after
acceptance but before recording delivery can cause a duplicate. Stable Message-ID
and database delivery receipts reduce duplicates without claiming exactly once.
The outbox contains order references rather than sensitive email payloads.

Mailpit captures local emails at http://localhost:8025. Integration tests exercise
the actual Redis queue, worker, SMTP delivery, and Mailpit search, using unique
test-owned database schemas and queue prefixes. They never flush shared Redis or
delete the user's mailbox. Provider failure injection tests durable retry behavior.

## Cache consistency

Catalog responses cache for 60 seconds. A database revision increments atomically
with catalog and inventory changes, including reservations and payments. Redis keys
include this revision. Reads still perform one cheap revision lookup in PostgreSQL;
expensive catalog joins/searches are cached. This trades a database read for simple,
durable invalidation even when Redis is unavailable. Reads fall back to PostgreSQL.
Old cache entries expire naturally. Never update catalog tables manually without
bumping CatalogRevision; normal APIs and the demo seed do this automatically.

## Limits and recovery

Atomic Redis counters limit authentication to 10 requests/minute, other writes to
120, and reads to 600 per source IP. Sensitive requests return 503 if Redis cannot
enforce limits; public reads remain available. Webhooks bypass this user limit and
always require Stripe signatures. Arbitrary forwarded IP headers are not trusted;
behind the Next.js proxy, the source IP can represent the shared proxy, a deliberate
conservative limit for this low-traffic demo. Production edge limits can add finer
client-level protection without trusting spoofable headers.

Redis uses AOF and noeviction in Compose. BullMQ requires persistent Redis protocol
connections, not an HTTP-only cache service. Worker recovery retains uncertain
payment reservations and retries provider reconciliation before releasing inventory.

References: [BullMQ connections](https://docs.bullmq.io/guide/connections),
[retry/backoff](https://docs.bullmq.io/guide/retrying-failing-jobs),
[SMTP transport](https://nodemailer.com/smtp).
