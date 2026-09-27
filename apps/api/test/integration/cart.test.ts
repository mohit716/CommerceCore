import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { withTestApp } from './test-app';
import { actor, product } from './fixtures';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

test('persistent carts enforce ownership, versions, validation, fresh prices and concurrent writes', async () =>
  withTestApp(async (app) => {
    const db = app.get(PrismaService);
    const server = app.getHttpServer();
    const a = await actor(db);
    const b = await actor(db);
    const item = await product(db);
    await request(server).get('/api/v1/cart').expect(401);
    const initial = await request(server).get('/api/v1/cart').set(a.headers).expect(200);
    const url = `/api/v1/cart/items/${item.id}`;
    await request(server).put(url).set(a.headers).send({ version: 0, quantity: 0 }).expect(400);
    await request(server)
      .put(url)
      .set(a.headers)
      .send({ version: 0, quantity: 1, priceMinor: 1 })
      .expect(400);
    const added = await request(server)
      .put(url)
      .set(a.headers)
      .send({ version: initial.body.version, quantity: 2 })
      .expect(200);
    assert.equal(added.body.subtotalMinor, 2000);
    await request(server).put(url).set(a.headers).send({ version: 0, quantity: 3 }).expect(409);
    const other = await request(server).get('/api/v1/cart').set(b.headers).expect(200);
    assert.equal(other.body.items.length, 0);
    await db.product.update({ where: { id: item.id }, data: { priceMinor: 1500 } });
    const read = await request(server).get('/api/v1/cart').set(a.headers).expect(200);
    assert.equal(read.body.subtotalMinor, 3000);
    const concurrent = await Promise.all(
      [3, 4].map((quantity) =>
        request(server).put(url).set(a.headers).send({ version: 1, quantity }),
      ),
    );
    assert.deepEqual(concurrent.map((result) => result.status).sort(), [200, 409]);
    assert.equal(
      (await db.inventory.findUniqueOrThrow({ where: { productId: item.id } })).reserved,
      0,
    );
    await assert.rejects(
      db.cartItem.updateMany({ where: { productId: item.id }, data: { quantity: 0 } }),
    );
    const removed = await request(server)
      .delete(url)
      .set(a.headers)
      .send({ version: 2 })
      .expect(200);
    assert.equal(removed.body.items.length, 0);
    assert.equal(removed.body.version, 3);
  }));
