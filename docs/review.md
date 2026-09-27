# Security and accessibility review

## Implemented protections

- Password scrypt hashes, opaque hashed sessions, expiry/revocation, HttpOnly/Lax
  cookies, and Secure/__Host cookies in production.
- Exact-origin checks and session-bound CSRF tokens on browser mutations; signed
  raw-body Stripe webhooks are the deliberate CSRF exception.
- Role checks on admin operations and ownership checks on carts/orders. Public
  signup cannot assign roles. No default admin account or password.
- DTO whitelist/validation, bounded pagination/quantities, parameterized SQL,
  integer money and database CHECK/FK/unique constraints.
- Atomic inventory reservations, deterministic row ordering, order/payment
  idempotency, webhook deduplication, and state/amount/currency verification.
- Restricted signed uploads with backend metadata verification. No secret is
  returned to the browser; Cloudinary live verification remains deferred.
- Rate limits, Helmet headers, private account responses, redacted API errors,
  server-generated request IDs and logs without bodies/cookies/query strings.
- Optional Sentry uses explicit data-collection restrictions and event scrubbing.
  Request data, user info, cookies, headers, query values, SQL values and stack-frame
  variables are disabled. Error messages are masked. Tracing/replay are disabled.
- Docker runs without root and excludes environment files. CI has read-only repository
  permissions, frozen dependencies, tests, builds and no publication credentials.

## Accessibility review of source and rendered HTTP pages

Landmarks, page headings, a skip link, labeled controls, image alt text, descriptive
quantity buttons, alert messages, keyboard focus outlines, wrapping navigation,
responsive layouts, disabled pending actions, and reduced-motion styles are present.
Checkout uses address autocomplete fields; cart errors preserve reviewable state.

This is a code/HTTP review, not WCAG certification. Before sharing the hosted demo,
manually test keyboard-only navigation, screen-reader announcements, zoom at 200%,
mobile widths, contrast, and Stripe's return flow. Add browser-driven axe/Playwright
coverage as a useful next portfolio upgrade. No visual browser audit is claimed.

## Known limits before real commerce

No real-provider acceptance testing, public deployment, refund/return workflow,
tax/shipping engine, email verification, password reset, or formal penetration test.
Sessions are revoked/expired but not automatically purged; production retention and
account-deletion workflows need a deliberate policy. Address/order data is retained.
The current rate limit sees the Next.js proxy's IP for proxied requests. Add trusted
edge enforcement for meaningful per-client limits at larger scale.

SMTP delivery is at least once; rare duplicates are possible after crashes. A global
catalog revision serializes final invalidation writes and favors low-traffic simplicity.
Outbox dispatch/reconciliation needs a running worker. Monitoring SDK initialization
and provider-facing Docker/deployment behavior still require environment-specific
acceptance tests after credentials/publication are authorized.
