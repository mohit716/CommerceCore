import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { config } from 'dotenv';
import { Client } from 'pg';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { configureApp } from '../../src/configure-app';

test('real catalog repository, HTTP filters, visibility, pagination, and database constraints', async () => {
  config({ path: ['.env', '../../.env'], quiet: true });
  const originalUrl = process.env.DATABASE_URL;
  assert.ok(originalUrl);
  const schema = `cctest_${randomUUID().replaceAll('-', '')}`;
  const client = new Client({ connectionString: originalUrl });
  await client.connect();
  await client.query(`CREATE SCHEMA "${schema}"`);
  let app: import('@nestjs/common').INestApplication | undefined;
  try {
    await client.query(`SET search_path TO "${schema}"`);
    for (const entry of readdirSync('prisma/migrations', { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name)))
      await client.query(readFileSync(`prisma/migrations/${entry.name}/migration.sql`, 'utf8'));
    const testUrl = new URL(originalUrl);
    testUrl.searchParams.set('schema', schema);
    process.env.DATABASE_URL = testUrl.toString();
    const { AppModule } = await import('../../src/app.module');
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    const db = app.get(PrismaService);
    const category = await db.category.create({
      data: { name: 'Test workspace', slug: 'test-workspace' },
    });
    for (let i = 0; i < 4; i++)
      await db.product.create({
        data: {
          sku: `TEST-${i}`,
          slug: `test-lamp-${i}`,
          name: `Test Lamp ${i}`,
          description: 'Adjustable reading light',
          priceMinor: (i + 1) * 100,
          categoryId: category.id,
          status: i === 3 ? 'ARCHIVED' : 'ACTIVE',
          inventory: { create: { onHand: i } },
        },
      });
    const server = app.getHttpServer();
    const page = await request(server)
      .get(
        '/api/v1/products?search=lamp&category=test-workspace&minPrice=100&maxPrice=300&sort=price_desc&limit=2',
      )
      .expect(200);
    assert.equal(page.body.total, 3);
    assert.equal(page.body.totalPages, 2);
    assert.deepEqual(
      page.body.items.map((item: { priceMinor: number }) => item.priceMinor),
      [300, 200],
    );
    assert.equal('inventory' in page.body.items[0], false);
    const second = await request(server)
      .get('/api/v1/products?sort=price_desc&limit=2&page=2')
      .expect(200);
    assert.equal(second.body.items[0].priceMinor, 100);
    assert.equal(second.body.items[0].available, false);
    await request(server).get('/api/v1/products/test-lamp-3').expect(404);
    await request(server).get('/api/v1/products/test-lamp-2').expect(200);
    const empty = await request(server).get('/api/v1/products?search=nonexistent').expect(200);
    assert.equal(empty.body.total, 0);
    const categories = await request(server).get('/api/v1/categories').expect(200);
    assert.equal(categories.body[0].slug, 'test-workspace');
    await assert.rejects(
      db.product.update({ where: { slug: 'test-lamp-0' }, data: { priceMinor: -1 } }),
    );
    await assert.rejects(
      db.inventory.update({ where: { productId: second.body.items[0].id }, data: { reserved: 1 } }),
    );
    await assert.rejects(db.category.delete({ where: { id: category.id } }));
  } finally {
    await app?.close();
    process.env.DATABASE_URL = originalUrl;
    // This schema was created above with a random test-only identifier; never use public here.
    assert.match(schema, /^cctest_[a-f0-9]{32}$/, 'Unsafe cleanup target');
    await client.query(`DROP SCHEMA "${schema}" CASCADE`);
    await client.end();
  }
});
