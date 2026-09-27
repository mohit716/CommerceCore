import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test, mock } from 'node:test';
import request from 'supertest';
import Stripe from 'stripe';
import { withTestApp } from './test-app';
import { actor, product } from './fixtures';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { StripeGateway } from '../../src/modules/payments/stripe.gateway';
import { PaymentService } from '../../src/modules/payments/payment.service';

test('Stripe retries, signed duplicate/out-of-order webhooks, amount checks, and abandoned checkout reconciliation', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_fixture';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fixture';
  await withTestApp(async (app) => {
    const db = app.get(PrismaService);
    const gateway = app.get(StripeGateway);
    const service = app.get(PaymentService);
    const server = app.getHttpServer();
    const sessions = new Map<string, Stripe.Checkout.Session>();
    let failAfterCreate = false;
    let unavailable = false;
    mock.method(
      gateway,
      'create',
      async (params: Stripe.Checkout.SessionCreateParams, id: string) => {
        if (unavailable) throw new Error('Provider unavailable');
        let session = sessions.get(id);
        if (!session) {
          session = {
            id: `cs_test_${id}`,
            object: 'checkout.session',
            livemode: false,
            mode: 'payment',
            status: 'open',
            payment_status: 'unpaid',
            amount_total: 1000,
            currency: 'usd',
            metadata: params.metadata,
            client_reference_id: params.client_reference_id,
            url: `https://checkout.stripe.com/c/pay/${id}`,
          } as Stripe.Checkout.Session;
          sessions.set(id, session);
        }
        if (failAfterCreate) {
          failAfterCreate = false;
          throw new Error('Ambiguous timeout after provider commit');
        }
        return session;
      },
    );
    mock.method(gateway, 'retrieve', async (id: string) => {
      if (unavailable) throw new Error('Provider unavailable');
      const session = [...sessions.values()].find((s) => s.id === id);
      assert.ok(session);
      return session;
    });
    mock.method(gateway, 'expire', async (id: string) => {
      if (unavailable) throw new Error('Provider unavailable');
      const session = [...sessions.values()].find((s) => s.id === id);
      assert.ok(session);
      session.status = 'expired';
      return session;
    });
    const customer = await actor(db);
    const stranger = await actor(db);
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
    async function order() {
      const item = await product(db, 1);
      const cart = await request(server).get('/api/v1/cart').set(customer.headers).expect(200);
      const added = await request(server)
        .put(`/api/v1/cart/items/${item.id}`)
        .set(customer.headers)
        .send({ version: cart.body.version, quantity: 1 })
        .expect(200);
      const result = await request(server)
        .post('/api/v1/checkout')
        .set(customer.headers)
        .set('Idempotency-Key', randomUUID())
        .send({ ...body, cartVersion: added.body.version })
        .expect(201);
      return { id: result.body.id as string, item };
    }
    const first = await order();
    await request(server)
      .post(`/api/v1/orders/${first.id}/payment`)
      .set(stranger.headers)
      .expect(404);
    failAfterCreate = true;
    await request(server)
      .post(`/api/v1/orders/${first.id}/payment`)
      .set(customer.headers)
      .expect(500);
    await request(server)
      .post(`/api/v1/orders/${first.id}/payment`)
      .set(customer.headers)
      .expect(201);
    assert.equal(sessions.size, 1);
    assert.equal(await db.paymentAttempt.count(), 1);
    const session = [...sessions.values()][0]!;
    const stripe = new Stripe('sk_test_fixture');
    async function webhook(id: string, type = 'checkout.session.completed', status = 200) {
      const payload = JSON.stringify({
        id,
        type,
        livemode: false,
        data: { object: { id: session.id } },
      });
      const signature = stripe.webhooks.generateTestHeaderString({
        payload,
        secret: 'whsec_fixture',
      });
      return request(server)
        .post('/api/v1/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('Stripe-Signature', signature)
        .send(payload)
        .expect(status);
    }
    await request(server).post('/api/v1/payments/webhook').send({}).expect(400);
    session.status = 'complete';
    session.payment_status = 'paid';
    session.amount_total = 1;
    await webhook('evt_bad', undefined, 400);
    assert.equal(await db.webhookEvent.count(), 0);
    assert.equal(
      (await db.order.findUniqueOrThrow({ where: { id: first.id } })).status,
      'PENDING_PAYMENT',
    );
    session.amount_total = 1000;
    session.currency = 'eur';
    await webhook('evt_currency', undefined, 400);
    session.currency = 'usd';
    await Promise.all([webhook('evt_paid'), webhook('evt_paid')]);
    await webhook('evt_old_expired', 'checkout.session.expired');
    const stock = await db.inventory.findUniqueOrThrow({ where: { productId: first.item.id } });
    assert.equal(stock.onHand, 0);
    assert.equal(stock.reserved, 0);
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: first.id } })).status, 'PAID');
    assert.equal(await db.webhookEvent.count(), 2);
    assert.equal(await db.outboxEvent.count({ where: { orderId: first.id } }), 1);
    const admin = await actor(db, 'ADMIN');
    await request(server)
      .post(`/api/v1/admin/orders/${first.id}/fulfill`)
      .set(admin.headers)
      .expect(201);
    await webhook('evt_after_fulfilled');
    assert.equal(
      (await db.order.findUniqueOrThrow({ where: { id: first.id } })).status,
      'FULFILLED',
    );
    const abandoned = await order();
    await request(server)
      .post(`/api/v1/orders/${abandoned.id}/payment`)
      .set(customer.headers)
      .expect(201);
    const unstarted = await order();
    await db.order.updateMany({
      where: { id: { in: [abandoned.id, unstarted.id] } },
      data: { expiresAt: new Date(0) },
    });
    unavailable = true;
    await service.reconcile();
    assert.equal(
      (await db.order.findUniqueOrThrow({ where: { id: abandoned.id } })).status,
      'PENDING_PAYMENT',
    );
    assert.equal(
      (await db.order.findUniqueOrThrow({ where: { id: unstarted.id } })).status,
      'EXPIRED',
    );
    unavailable = false;
    await service.reconcile();
    await service.reconcile();
    assert.equal(
      (await db.order.findUniqueOrThrow({ where: { id: abandoned.id } })).status,
      'EXPIRED',
    );
    assert.equal(
      (await db.inventory.findUniqueOrThrow({ where: { productId: abandoned.item.id } })).reserved,
      0,
    );
    const uncertain = await order();
    failAfterCreate = true;
    await request(server)
      .post(`/api/v1/orders/${uncertain.id}/payment`)
      .set(customer.headers)
      .expect(500);
    await db.order.update({ where: { id: uncertain.id }, data: { expiresAt: new Date(0) } });
    await service.reconcile();
    assert.equal(
      (await db.order.findUniqueOrThrow({ where: { id: uncertain.id } })).status,
      'EXPIRED',
    );
  });
  mock.restoreAll();
});
