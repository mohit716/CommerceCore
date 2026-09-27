import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
require('dotenv').config({ path: '.env', quiet: true });
const { Client } = require('pg');
const database = new Client({ connectionString: process.env.DATABASE_URL });
const schema = `ccsmoke_${randomUUID().replaceAll('-', '')}`;
await database.connect();
await database.query(`CREATE SCHEMA "${schema}"`);
const databaseUrl = new URL(process.env.DATABASE_URL);
databaseUrl.searchParams.set('schema', schema);

async function availablePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

const apiPort = await availablePort();
const webPort = await availablePort();
const processes = [];
function launch(cwd, args, env) {
  const child = spawn(process.execPath, args, {
    cwd,
    env: { ...process.env, ...env },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.on('error', () => undefined);
  processes.push(child);
  return child;
}
async function waitFor(url, child) {
  for (let i = 0; i < 80; i++) {
    if (child.exitCode !== null)
      throw new Error(`Server exited before readiness (${child.exitCode})`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {
      /* Retry bounded startup failures. */
    }
    await delay(250);
  }
  throw new Error(`Server did not become ready: ${url}`);
}

try {
  await database.query(`SET search_path TO "${schema}"`);
  for (const entry of readdirSync('apps/api/prisma/migrations', { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    await database.query(
      readFileSync(`apps/api/prisma/migrations/${entry.name}/migration.sql`, 'utf8'),
    );
  }
  const categoryId = randomUUID();
  const productId = randomUUID();
  await database.query(
    'INSERT INTO "Category" (id,slug,name,"updatedAt") VALUES ($1,$2,$3,now())',
    [categoryId, 'smoke-workspace', 'Workspace'],
  );
  await database.query(
    'INSERT INTO "Product" (id,sku,slug,name,description,"priceMinor",status,"categoryId","updatedAt") VALUES ($1,$2,$3,$4,$5,12900,\'ACTIVE\',$6,now())',
    [
      productId,
      'SMOKE-KEYBOARD',
      'smoke-keyboard',
      'Smoke Keyboard',
      'A test keyboard.',
      categoryId,
    ],
  );
  await database.query(
    'INSERT INTO "Inventory" ("productId","onHand","updatedAt") VALUES ($1,5,now())',
    [productId],
  );
  const api = launch('apps/api', ['dist/main.js'], {
    API_PORT: String(apiPort),
    DATABASE_URL: databaseUrl.toString(),
    WEB_ORIGIN: `http://127.0.0.1:${webPort}`,
    NODE_ENV: 'test',
  });
  const web = launch(
    'apps/web',
    ['node_modules/next/dist/bin/next', 'start', '--port', String(webPort)],
    { API_INTERNAL_URL: `http://127.0.0.1:${apiPort}` },
  );
  const apiBase = `http://127.0.0.1:${apiPort}`;
  const webBase = `http://127.0.0.1:${webPort}`;
  await Promise.all([
    waitFor(`${apiBase}/api/v1/health/ready`, api),
    waitFor(`${webBase}/api/health`, web),
  ]);
  const catalogResponse = await fetch(`${apiBase}/api/v1/products?search=keyboard`);
  assert.equal(catalogResponse.status, 200);
  assert.match(catalogResponse.headers.get('x-request-id'), /^[a-f0-9-]{36}$/);
  const catalog = await catalogResponse.json();
  assert.ok(catalog.items.length > 0);
  const product = catalog.items[0];
  const home = await fetch(`${webBase}/?search=keyboard`);
  assert.equal(home.status, 200);
  assert.ok((await home.text()).includes(product.name));
  const detail = await fetch(`${webBase}/products/${product.slug}`);
  assert.equal(detail.status, 200);
  assert.ok((await detail.text()).includes(product.name));
  assert.equal((await fetch(`${apiBase}/api/v1/products?limit=1000`)).status, 400);
  const docs = await (await fetch(`${apiBase}/openapi.json`)).json();
  assert.ok(docs.paths['/api/v1/products']);
  const created = await fetch(`${webBase}/api/backend/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: webBase },
    body: JSON.stringify({
      email: 'smoke@example.test',
      name: 'Smoke Customer',
      password: 'Smoke-password-12345',
    }),
  });
  assert.equal(created.status, 201);
  const cookie = created.headers.getSetCookie()[0].split(';')[0];
  const account = await fetch(`${webBase}/account`, { headers: { Cookie: cookie } });
  assert.equal(account.status, 200);
  assert.ok((await account.text()).includes('Smoke Customer'));
  const csrf = await (
    await fetch(`${webBase}/api/backend/auth/csrf`, { headers: { Cookie: cookie } })
  ).json();
  const cartUpdate = await fetch(`${webBase}/api/backend/cart/items/${productId}`, {
    method: 'PUT',
    headers: {
      Cookie: cookie,
      Origin: webBase,
      'X-CSRF-Token': csrf.csrfToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ version: 0, quantity: 1 }),
  });
  assert.equal(cartUpdate.status, 200);
  assert.equal((await cartUpdate.json()).subtotalMinor, 12900);
  const cartPage = await fetch(`${webBase}/cart`, { headers: { Cookie: cookie } });
  assert.equal(cartPage.status, 200);
  assert.ok((await cartPage.text()).includes('Smoke Keyboard'));
  const checkoutPage = await fetch(`${webBase}/checkout`, { headers: { Cookie: cookie } });
  assert.equal(checkoutPage.status, 200);
  assert.ok((await checkoutPage.text()).includes('Street address'));
  const checkout = await fetch(`${webBase}/api/backend/checkout`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      Origin: webBase,
      'X-CSRF-Token': csrf.csrfToken,
      'Content-Type': 'application/json',
      'Idempotency-Key': randomUUID(),
    },
    body: JSON.stringify({
      cartVersion: 1,
      shippingAddress: {
        name: 'Smoke Customer',
        line1: '1 Main St',
        city: 'Boston',
        region: 'MA',
        postalCode: '02110',
        country: 'US',
      },
    }),
  });
  assert.equal(checkout.status, 201);
  const order = await checkout.json();
  assert.equal(order.status, 'PENDING_PAYMENT');
  assert.equal(order.totalMinor, 12900);
  const orderDetail = await fetch(`${webBase}/api/backend/orders/${order.id}`, {
    headers: { Cookie: cookie },
  });
  assert.equal(orderDetail.status, 200);
  const orderPage = await fetch(`${webBase}/orders/${order.id}`, { headers: { Cookie: cookie } });
  assert.equal(orderPage.status, 200);
  assert.ok((await orderPage.text()).includes('Payment has not been confirmed'));
  assert.equal((await fetch(`${webBase}/orders`, { headers: { Cookie: cookie } })).status, 200);
  // Promotion is confined to this script's temporary schema and its own fixture account.
  await database.query('UPDATE "User" SET role=\'ADMIN\' WHERE email=$1', ['smoke@example.test']);
  const adminPage = await fetch(`${webBase}/admin`, { headers: { Cookie: cookie } });
  assert.equal(adminPage.status, 200);
  assert.ok((await adminPage.text()).includes('Catalog management'));
  const operations = await fetch(`${webBase}/admin/operations`, { headers: { Cookie: cookie } });
  assert.equal(operations.status, 200);
  assert.ok((await operations.text()).includes('Notification delivery'));
  const logout = await fetch(`${webBase}/api/backend/auth/logout`, {
    method: 'POST',
    headers: { Cookie: cookie, Origin: webBase, 'X-CSRF-Token': csrf.csrfToken },
  });
  assert.equal(logout.status, 204);
  assert.equal(
    (await fetch(`${webBase}/api/backend/auth/me`, { headers: { Cookie: cookie } })).status,
    401,
  );
  console.log(
    'Smoke passed: readiness, catalog, storefront, detail, OpenAPI, proxy signup, account, admin page and CSRF-protected logout.',
  );
} finally {
  await Promise.all(
    processes.map(
      (child) =>
        new Promise((resolve) => {
          if (child.exitCode !== null) return resolve();
          child.once('exit', resolve);
          child.kill();
        }),
    ),
  );
  assert.match(schema, /^ccsmoke_[a-f0-9]{32}$/);
  await database.query(`DROP SCHEMA "${schema}" CASCADE`);
  await database.end();
}
