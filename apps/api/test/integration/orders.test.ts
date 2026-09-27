import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import request from 'supertest';
import { withTestApp } from './test-app';
import { actor, product } from './fixtures';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

test('transactional checkout prevents overselling, rolls back reservations, and replays only matching requests', async () =>
  withTestApp(async (app) => {
    const db = app.get(PrismaService);
    const server = app.getHttpServer();
    const a = await actor(db);
    const b = await actor(db);
    const last = await product(db, 1);
    for (const customer of [a, b])
      await request(server)
        .put(`/api/v1/cart/items/${last.id}`)
        .set(customer.headers)
        .send({ version: 0, quantity: 1 })
        .expect(200);
    const body = {
      cartVersion: 1,
      shippingAddress: {
        name: 'Ada',
        line1: '1 Main St',
        city: 'Boston',
        region: 'MA',
        postalCode: '02110',
        country: 'US',
      },
    };
    const keys = [randomUUID(), randomUUID()];
    const results = await Promise.all(
      [a, b].map((customer, i) =>
        request(server)
          .post('/api/v1/checkout')
          .set(customer.headers)
          .set('Idempotency-Key', keys[i]!)
          .send(body),
      ),
    );
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
    assert.equal(await db.order.count(), 1);
    assert.equal(
      (await db.inventory.findUniqueOrThrow({ where: { productId: last.id } })).reserved,
      1,
    );
    const winnerIndex = results.findIndex((r) => r.status === 201);
    const winner = [a, b][winnerIndex]!;
    const loser = [a, b][1 - winnerIndex]!;
    const id = results[winnerIndex]!.body.id;
    const replay = await request(server)
      .post('/api/v1/checkout')
      .set(winner.headers)
      .set('Idempotency-Key', keys[winnerIndex]!)
      .send(body)
      .expect(201);
    assert.equal(replay.body.id, id);
    await request(server)
      .post('/api/v1/checkout')
      .set(winner.headers)
      .set('Idempotency-Key', keys[winnerIndex]!)
      .send({ ...body, cartVersion: 2 })
      .expect(409);
    await request(server).get(`/api/v1/orders/${id}`).set(loser.headers).expect(404);
    await request(server)
      .post(`/api/v1/admin/orders/${id}/fulfill`)
      .set(winner.headers)
      .expect(403);
    const admin = await actor(db, 'ADMIN');
    await request(server).get('/api/v1/admin/orders').set(winner.headers).expect(403);
    const adminOrders = await request(server)
      .get('/api/v1/admin/orders')
      .set(admin.headers)
      .expect(200);
    assert.equal(adminOrders.body.total, 1);
    await request(server).post(`/api/v1/admin/orders/${id}/fulfill`).set(admin.headers).expect(409);
    await db.product.update({
      where: { id: last.id },
      data: { priceMinor: 2000, name: 'Changed name' },
    });
    const snapshot = await request(server)
      .get(`/api/v1/orders/${id}`)
      .set(winner.headers)
      .expect(200);
    assert.equal(snapshot.body.items[0].name, 'Test product');
    assert.equal(snapshot.body.totalMinor, 1000);
    const c = await actor(db);
    const products = [await product(db, 2), await product(db, 2)].sort((x, y) =>
      x.id.localeCompare(y.id),
    );
    for (const [i, p] of products.entries())
      await request(server)
        .put(`/api/v1/cart/items/${p.id}`)
        .set(c.headers)
        .send({ version: i, quantity: 1 })
        .expect(200);
    await db.inventory.update({ where: { productId: products[1]!.id }, data: { onHand: 0 } });
    const rollbackKey = randomUUID();
    await request(server)
      .post('/api/v1/checkout')
      .set(c.headers)
      .set('Idempotency-Key', rollbackKey)
      .send({ ...body, cartVersion: 2 })
      .expect(409);
    assert.equal(
      (await db.inventory.findUniqueOrThrow({ where: { productId: products[0]!.id } })).reserved,
      0,
    );
    assert.equal((await db.cart.findUniqueOrThrow({ where: { userId: c.user.id } })).version, 2);
    assert.equal(await db.order.count(), 1);
    await db.inventory.update({ where: { productId: products[1]!.id }, data: { onHand: 2 } });
    const retries = await Promise.all(
      [1, 2].map(() =>
        request(server)
          .post('/api/v1/checkout')
          .set(c.headers)
          .set('Idempotency-Key', rollbackKey)
          .send({ ...body, cartVersion: 2 }),
      ),
    );
    assert.deepEqual(
      retries.map((r) => r.status),
      [201, 201],
    );
    assert.equal(retries[0]!.body.id, retries[1]!.body.id);
    assert.equal(await db.order.count(), 2);
    assert.equal(await db.cartItem.count({ where: { cart: { userId: c.user.id } } }), 0);
    await request(server).post('/api/v1/checkout').set(c.headers).send(body).expect(400);
    await request(server)
      .post('/api/v1/checkout')
      .set(c.headers)
      .set('Idempotency-Key', randomUUID())
      .send({ ...body, shippingAddress: {} })
      .expect(400);
  }));
