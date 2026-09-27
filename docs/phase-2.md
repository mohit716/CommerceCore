# Phase 2: Data and catalog

The catalog adds Category, Product, ProductImage, and Inventory models to the existing
NestJS modular monolith. Repositories own Prisma/SQL access; services enforce public
visibility and price-range rules; controllers expose validated REST endpoints.

## Run

From the workspace root, with the existing Compose services running:

```sh
pnpm install --frozen-lockfile
pnpm --filter @commerce-core/api db:generate
pnpm --filter @commerce-core/api db:deploy
pnpm --filter @commerce-core/api db:seed
pnpm dev
```

The migration only creates new objects. The seed inserts 3 categories and 13 products
when absent; existing products and inventory are preserved. Product illustrations are
local SVG placeholders and require no image-service credentials.

Browse http://localhost:3000. OpenAPI UI is http://localhost:3001/docs and its JSON is
http://localhost:3001/openapi.json. Search uses PostgreSQL English full-text semantics
(words/stemming, not arbitrary substrings). Price filters use integer USD cents.

## Guarantees and tradeoffs

- Prices and image ordering cannot be negative. Inventory enforces
  `0 <= reserved <= onHand` in PostgreSQL.
- Products have stable unique SKU/slug identifiers. Category deletion is restricted
  while products reference it. Only ACTIVE products appear in the public catalog.
- GIN full-text indexing and category/status/price indexes support catalog queries.
- Page size is capped at 100; ordering has an ID tie-breaker. Counts and items share a
  repeatable-read transaction. Offset pagination is sufficient for this catalog size.
- Public DTOs omit internal inventory counts and image storage identifiers.
- A centralized exception filter returns `{code, message, requestId}` and redacts
  unexpected/database errors. No raw SQL or connection credentials reach responses.
- The frontend renders server-side and has loading-failure, empty-results, and 404 states.

## Verification

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm db:validate
pnpm test:integration
pnpm build
pnpm test:smoke
```

Integration tests create a random `cctest_*` schema, install the migration and their own
fixtures, and remove only that schema. They never clear development tables. Tests cover
query parameter binding, service errors, controller validation, HTTP contracts, actual
database queries, hidden products, pagination, and database constraints. Production smoke
tests start/stop their own API and web processes and use the demo catalog read-only.
