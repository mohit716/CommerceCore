# Phase 5: Persistent cart

Each customer has one database-backed cart. Every read calculates prices from the
current catalog; the browser cannot submit prices. Archived products remain visible
in existing carts as unavailable, so customers can remove them.

Cart mutations require a session, CSRF token, and expected version. A transactional
compare-and-increment on the cart row serializes edits. Stale requests return 409;
the UI reloads the latest cart for review. Failed stock/validation checks roll back
the version increment. Requests always scope cart access to the session owner.

Adding an item checks current availability but does not reserve inventory. Only
checkout will reserve stock. Each line is limited to 100 units and a cart to 50
distinct products. PostgreSQL enforces positive quantities and nonnegative versions.

Endpoints: GET `/api/v1/cart`, PUT and DELETE
`/api/v1/cart/items/:productId`. PUT accepts `{ version, quantity }`; DELETE accepts
`{ version }`. The storefront provides product add-to-cart and a responsive `/cart`
page with quantity changes, removal, availability messages, and server totals.

Verification covers server arithmetic, ownership, DTO rejection, changing catalog
prices, conflicting concurrent writes, database constraints, and the production
Next.js proxy/cart page against an isolated PostgreSQL schema. Run the complete
gate with `node scripts/verify.mjs` after generating Prisma and applying migrations.
