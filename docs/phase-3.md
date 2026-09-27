# Phase 3: Authentication

Signup, login, logout, current-user and CSRF endpoints live in the auth module. The users
module exposes only `/users/me`; its identity always comes from the server-validated session.
The frontend adds `/signup`, `/login`, and `/account` through a fixed-origin Next.js API proxy.

## Security decisions

- Node's built-in asynchronous scrypt uses N=32768, r=8, p=3, a random salt, and a 64-byte key.
  This is one of the [OWASP-listed configurations](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
- Passwords accept 12–128 characters; nonexistent accounts perform the same password derivation.
- Session tokens contain 256 random bits. Only SHA-256 token hashes are stored in PostgreSQL.
- Sessions expire after seven days, are revocable, and are replaced on login. Roles are read
  from the database with every authenticated request rather than trusted from the browser.
- Production cookies use `__Host-cc_session`, Secure, HttpOnly, Path=/, and SameSite=Lax.
  Local HTTP development uses `cc_session`. No token is stored in browser localStorage.
- Signup/login require the configured `WEB_ORIGIN`. Authenticated mutations also require a
  session-bound token from `GET /auth/csrf` in the `X-CSRF-Token` header.
- Signup rejects role fields and always creates CUSTOMER. There is no public admin promotion API.
- Responses omit password/session hashes. Authentication and proxy responses are never cached.

## Configuration

No external authentication secret is needed. Keep `WEB_ORIGIN` equal to the actual frontend
origin. Production requires HTTPS and `NODE_ENV=production`; the frontend proxy forwards
only the necessary request headers and preserves Set-Cookie responses.

Apply the additive migration with `pnpm --filter @commerce-core/api db:deploy` after generating
the Prisma client. Existing catalog records are preserved. No seeded user passwords are created.

## Verification

The phase gate runs format/lint/types, unit and HTTP tests, Prisma validation/migration,
real PostgreSQL integration tests, both production builds, and `pnpm test:smoke`.
Smoke tests now create their own temporary schema, exercise signup/account/logout through
the production-built Next.js proxy, and clean up only their own schema and processes.

Rate limiting arrives in Phase 8, before public deployment. Password reset, email verification,
and MFA are optional upgrades; none are represented as implemented here.
