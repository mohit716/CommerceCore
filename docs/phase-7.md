# Phase 7: Stripe test payments

The cart links to `/checkout`, which creates an order and redirects to its detail
page. POST `/api/v1/orders/:id/payment` creates or retrieves its hosted Stripe
Checkout Session. `/orders` provides paginated history; `/orders/:id` shows server
status and confirmation. Returning from Stripe never marks an order paid.

Only `sk_test_` keys are accepted. Configure STRIPE_SECRET_KEY and
STRIPE_WEBHOOK_SECRET together. Without credentials, payment initiation returns
503; other local features continue working. Tests use SDK-generated signatures and
mocked provider API responses, never real credentials or network payment calls.

One PaymentAttempt per order is persisted before the external request. Its exact
parameters and stable Stripe idempotency key survive timeouts and process crashes.
Only card payments are enabled. The webhook endpoint
`POST /api/v1/payments/webhook` receives raw request bytes, verifies the signature,
and rejects live-mode events. It retrieves current provider state to tolerate
out-of-order notifications, verifies session/order/attempt identity and amount /
currency, then commits event deduplication, stock consumption, and state changes
together. Failed transactions do not acknowledge successful processing.

Reconciliation expires open provider sessions before releasing holds. If a payment
request timed out before its session ID was saved, reconciliation recovers it using
the same parameters/key. Provider outages retain reservations for a later retry.
Unknown sessions older than 23 hours require operator review: Stripe can prune
idempotency keys after 24 hours, so creating another session could be unsafe.
Unstarted orders can expire without a provider call. Scheduling begins in Phase 8.

The order engine uses 30-minute holds; provider sessions use their default expiry.
The reconciler explicitly expires still-open sessions when the local hold expires.
No refunds, tax engine, shipping-rate integration, or live payments are supported.

References: [Stripe Checkout](https://docs.stripe.com/api/checkout/sessions/create),
[webhooks](https://docs.stripe.com/webhooks),
[idempotency](https://docs.stripe.com/api/idempotent_requests),
[session expiration](https://docs.stripe.com/api/checkout/sessions/expire).

After separate approval to use actual test credentials, a manual sandbox walkthrough
can use the Stripe CLI to forward events to the backend webhook endpoint and card
4242 4242 4242 4242 with any future expiry. This live-provider walkthrough has not
been performed. Cloudinary live verification also remains explicitly deferred.
