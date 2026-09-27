import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test, mock } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import request from 'supertest';
import { withTestApp } from './test-app';
import { actor, product } from './fixtures';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { CacheService } from '../../src/infrastructure/redis/cache.service';
import { JobsService } from '../../src/modules/notifications/jobs.service';
import { EmailService } from '../../src/modules/notifications/email.service';

test('real Redis cache invalidation, outage recovery, rate limits, durable BullMQ jobs and Mailpit email', async () =>
  withTestApp(async (app) => {
    const db = app.get(PrismaService);
    const cache = app.get(CacheService);
    const jobs = app.get(JobsService);
    const email = app.get(EmailService);
    const server = app.getHttpServer();
    const admin = await actor(db, 'ADMIN');
    const customer = await actor(db);
    const item = await product(db);
    const path = `/api/v1/products/${item.slug}`;
    await request(server).get(path).expect(200);
    assert.ok((await cache.client.keys(`${cache.prefix}:catalog:*`)).length > 0);
    await request(server)
      .patch(`/api/v1/admin/products/${item.id}`)
      .set(admin.headers)
      .send({ priceMinor: 1500 })
      .expect(200);
    assert.equal((await request(server).get(path).expect(200)).body.priceMinor, 1500);
    // Disconnect only this test application's Redis client, never the shared Redis server.
    cache.client.disconnect();
    assert.equal((await request(server).get(path).expect(200)).body.priceMinor, 1500);
    await request(server)
      .put(`/api/v1/cart/items/${item.id}`)
      .set(customer.headers)
      .send({ version: 0, quantity: 1 })
      .expect(503);
    await cache.client.connect();
    await request(server)
      .put(`/api/v1/cart/items/${item.id}`)
      .set(customer.headers)
      .send({ version: 0, quantity: 1 })
      .expect(200);
    const attempts = await Promise.all(
      Array.from({ length: 11 }, () => request(server).post('/api/v1/auth/login').send({})),
    );
    assert.ok(attempts.some((response) => response.status === 429));
    const order = await db.order.create({
      data: {
        userId: customer.user.id,
        status: 'PAID',
        idempotencyKey: randomUUID(),
        requestHash: '0'.repeat(64),
        totalMinor: 1500,
        currency: 'USD',
        shippingAddress: {},
        expiresAt: new Date(),
        items: {
          create: {
            productId: item.id,
            sku: item.sku,
            name: item.name,
            quantity: 1,
            unitPriceMinor: 1500,
            lineTotalMinor: 1500,
          },
        },
        outboxEvents: { create: {} },
      },
      include: { outboxEvents: true },
    });
    const event = order.outboxEvents[0]!;
    // Initialize a real queue, then inject a temporary enqueue failure.
    await jobs.dispatch();
    await db.outboxEvent.update({ where: { id: event.id }, data: { nextAttemptAt: new Date(0) } });
    const add = mock.method(jobs.queue!, 'add', async () => {
      throw new Error('Redis unavailable');
    });
    await assert.rejects(jobs.dispatch());
    assert.equal(
      (await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } })).deliveredAt,
      null,
    );
    add.mock.restore();
    const send = mock.method(email, 'confirmation', async () => {
      throw new Error('SMTP unavailable');
    });
    await assert.rejects(jobs.deliver(event.id));
    assert.equal(
      (await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } })).lastError,
      'EMAIL_DELIVERY_FAILED',
    );
    send.mock.restore();
    jobs.start();
    for (let i = 0; i < 80; i++) {
      if ((await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } })).deliveredAt) break;
      await delay(100);
    }
    assert.ok((await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } })).deliveredAt);
    await jobs.deliver(event.id); // delivered records cannot send again.
    const response = await fetch(
      `http://localhost:8025/api/v1/search?query=${encodeURIComponent(`to:${customer.user.email}`)}`,
    );
    assert.equal(response.status, 200);
    const messages = (await response.json()) as { messages: { Subject: string }[] };
    assert.equal(
      messages.messages.filter((message) => message.Subject.includes(order.id.slice(0, 8))).length,
      1,
    );
    await request(server).get('/api/v1/admin/jobs').set(customer.headers).expect(403);
    await request(server).get('/api/v1/admin/jobs').set(admin.headers).expect(200);
    // Delete only the queue created for this test's unique PostgreSQL schema.
    assert.ok(new URL(process.env.DATABASE_URL!).searchParams.get('schema')?.startsWith('cctest_'));
    await jobs.queue!.obliterate({ force: true });
  }));
