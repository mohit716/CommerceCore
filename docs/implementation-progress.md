# Implementation progress

Each phase must pass formatting, lint, type checking, tests, schema/migrations, production
builds, and relevant integration/smoke checks before the next phase begins.

| Phase                               | Status                              | Verification                                                                                                                                                     |
| ----------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Foundation                        | Complete (user verified and pushed) | Existing baseline preserved                                                                                                                                      |
| 2 Data and catalog                  | Complete                            | All checks passed; 16 unit/HTTP tests, 2 integration tests, migrations/seed, builds, smoke                                                                       |
| 3 Authentication                    | Complete                            | Full gate passed: format, lint, types, 20 unit/HTTP tests, 3 integration tests, Prisma/migration, builds, authenticated proxy smoke                              |
| 4 Admin and inventory               | Complete locally                    | Full local gate passed. User explicitly deferred live Cloudinary verification; do not use real credentials.                                                      |
| 5 Cart                              | Complete                            | Full gate passed: format, lint, types, unit/HTTP tests, 5 integration tests, additive migration, production builds, cart smoke                                   |
| 6 Order engine                      | Complete                            | Full gate passed: 26 unit/HTTP tests, 6 integration tests, additive migration, builds, checkout smoke                                                            |
| 7 Payments                          | Complete locally                    | Full gate passed: 27 unit/HTTP tests, 7 integration tests, migrations, builds, checkout/order UI smoke; Stripe mocked                                            |
| 8 Background processing and caching | Complete                            | Full gate passed: 27 unit/HTTP tests, 8 integration tests, real Redis/BullMQ/Mailpit, migrations, builds, smoke                                                  |
| 9 Deployment and portfolio polish   | Complete locally                    | Full gate passed: 29 unit/HTTP tests, 8 integration tests, 7 migrations current, builds, HTTP smoke, both Docker image builds and API/web/worker container smoke |

## Phase 2 decisions

- Prisma runtime packages match the existing CLI version.
- Product prices use integer USD cents. Inventory enforces reserved stock <= on-hand stock.
- Catalog search uses PostgreSQL full-text search, with a matching GIN index.
- Pagination uses deterministic ID tie-breakers and a repeatable-read snapshot for count/items.
- Public responses expose availability, not internal stock counters or storage identifiers.
- Seed inserts missing demo records without overwriting user changes.
- Docker Desktop was found in the per-user installation; existing healthy services were used.
