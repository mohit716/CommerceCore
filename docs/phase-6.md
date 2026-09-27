# Phase 6: Transactional order engine

POST `/api/v1/checkout` requires a session, CSRF token, UUID v4 `Idempotency-Key`,
`cartVersion`, and US shipping address. Successful checkout atomically creates an
unpaid order with immutable line snapshots, holds inventory for 30 minutes, and
empties the cart. Prices use integer USD cents; shipping and tax are not calculated
in this portfolio demo. The supported order total is $0.50–$999,999.99.

A cart version update serializes edits and checkout. Products are locked for share
and inventory rows updated conditionally in ascending product-ID order. The stock
condition lives inside the UPDATE, so competing customers cannot both reserve the
last unit. Any failure rolls back stock, order records, and cart changes together.

The unique user/key pair and canonical request hash make identical retries return
the same order, including concurrent retries. Reusing a key with a different cart
version or address returns 409. Keys are retained with orders rather than expiring
after a short cache TTL. Order reads are scoped to the session user and paginated.

Lifecycle: PENDING_PAYMENT → PAID → FULFILLED; pending orders may instead become
EXPIRED or CANCELLED. Payment transitions and safe reservation reconciliation are
implemented in Phases 7–8. Only an admin can fulfill a paid order; clients cannot
set arbitrary statuses. No endpoint marks an order paid based on a browser redirect.

Tests use real PostgreSQL transactions to demonstrate last-unit contention,
multi-product rollback, identical concurrent retries, request-hash mismatch,
ownership, snapshot stability, and fulfillment authorization/state checks.
