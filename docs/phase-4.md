# Phase 4: Admin and inventory

Admin product/category management, product archival, inventory adjustments, audit history,
and image-upload UI/API are implemented. Cloudinary is the only external integration in
this phase. Local tests use fake credentials and mocked provider responses.

**Phase 4 is locally verified.** The user explicitly deferred live Cloudinary
verification and authorized Phases 5–9 to continue using the mocked integration.
Real Cloudinary credentials and live uploads remain outside the authorized scope.

## Admin access

Sign up through `/signup`. Public signup always creates a CUSTOMER. To explicitly promote
your chosen local account, run this yourself after reviewing the email:

```sh
pnpm admin:promote your-email@example.com --confirm
```

This changes only the specified existing user's role. No default admin password or public
promotion endpoint exists. The implementation agent has not promoted any development user.
Visit `/admin` after promotion. Roles are checked by NestJS on every admin request.

## Inventory and catalog behavior

- Creating a product creates zero inventory. Stock changes go through an adjustment with
  a reason, actor, and operation ID; retries with the same ID cannot apply the delta twice.
- Adjustments lock the inventory row and commit stock + audit changes atomically.
- Deductions cannot consume reserved stock or make inventory negative.
- Archive hides a product from the public catalog while preserving its references/history.
- Deleting categories referenced by products returns a conflict.
- Image detachment removes the database association; it deliberately retains the Cloudinary
  asset. External asset cleanup is a separate explicit maintenance operation.

## Cloudinary configuration

Set these only in the ignored root `.env` or backend deployment secret settings:

```dotenv
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_UPLOAD_PRESET=
```

Configure a **signed** upload preset with JPG/PNG/WebP formats and a maximum file size of
5 MB. Do not enable unsigned uploads for this preset. The server also signs format and
overwrite restrictions and uses a unique product-scoped public ID. It never returns the
API secret to the browser. Cloudinary accepts signed uploads within its signature validity
window; avoid sharing signed upload responses.

The browser uploads directly to Cloudinary. Before creating ProductImage, the backend calls
Cloudinary's Admin API to verify the asset ID, product namespace, resource type, format,
byte size, pixel dimensions, and HTTPS delivery URL. Images are limited to 40 megapixels.
Unconfigured uploads return a clear 503. Other local features work without credentials.

Provider references: [signed uploads](https://cloudinary.com/documentation/upload_images#generating_authentication_signatures),
[resource verification](https://cloudinary.com/documentation/admin_api#get_details_of_a_single_resource).

## Verification

The standard gate includes unit/provider-mock tests, real PostgreSQL tests, both production
builds, and the isolated-schema production smoke test. Integration tests cover unauthorized
access, customer/admin roles, validated CRUD, FK restrictions, concurrent stock deductions,
idempotent adjustments, reservation protection, audit actors, image attachment, and archival.

To finish live verification after approval, build the API and run:

```sh
pnpm test:cloudinary --confirm-upload
```

This creates one tiny PNG using the same signed upload parameters as the UI, then verifies
it through the server-side adapter. It retains that test asset and prints its public URL.
It does not create database records or promote a user. No live upload has been performed yet.
