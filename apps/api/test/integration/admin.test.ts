import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import request from 'supertest';
import { withTestApp } from './test-app';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { csrfToken, hashToken, newToken } from '../../src/modules/auth/session';
import { CloudinaryService } from '../../src/infrastructure/storage/cloudinary.service';

test('admin authorization, catalog changes, archival, atomic inventory and idempotent adjustments', async (t) =>
  withTestApp(async (app) => {
    const server = app.getHttpServer();
    const db = app.get(PrismaService);
    const token = newToken();
    const cookie = `cc_session=${token}`;
    const admin = await db.user.create({
      data: {
        email: 'admin-test@example.test',
        name: 'Test admin',
        passwordHash: 'unused-test-only-hash',
        role: 'ADMIN',
        sessions: {
          create: { tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60000) },
        },
      },
    });
    const customerToken = newToken();
    await db.user.create({
      data: {
        email: 'customer-test@example.test',
        name: 'Customer',
        passwordHash: 'unused-test-only-hash',
        sessions: {
          create: { tokenHash: hashToken(customerToken), expiresAt: new Date(Date.now() + 60000) },
        },
      },
    });
    const headers = {
      Cookie: cookie,
      Origin: 'http://localhost:3000',
      'X-CSRF-Token': csrfToken(token),
    };
    await request(server).get('/api/v1/admin/products').expect(401);
    await request(server)
      .get('/api/v1/admin/products')
      .set('Cookie', `cc_session=${customerToken}`)
      .expect(403);
    const category = await request(server)
      .post('/api/v1/admin/categories')
      .set(headers)
      .send({ name: 'Admin category', slug: 'admin-category' })
      .expect(201);
    const created = await request(server)
      .post('/api/v1/admin/products')
      .set(headers)
      .send({
        name: 'Admin lamp',
        sku: 'ADMIN-LAMP',
        slug: 'admin-lamp',
        description: 'A lamp.',
        priceMinor: 1000,
        categoryId: category.body.id,
        status: 'ACTIVE',
      })
      .expect(201);
    const id = created.body.id;
    await request(server)
      .patch(`/api/v1/admin/products/${id}`)
      .set(headers)
      .send({ priceMinor: null })
      .expect(400);
    await request(server)
      .patch(`/api/v1/admin/products/${id}`)
      .set(headers)
      .send({ priceMinor: 1500 })
      .expect(200);
    await request(server)
      .delete(`/api/v1/admin/categories/${category.body.id}`)
      .set(headers)
      .expect(409);
    const adjustment = { delta: 5, reason: 'Received shipment', operationId: randomUUID() };
    await request(server)
      .post(`/api/v1/admin/inventory/${id}/adjustments`)
      .set(headers)
      .send(adjustment)
      .expect(201);
    await request(server)
      .post(`/api/v1/admin/inventory/${id}/adjustments`)
      .set(headers)
      .send(adjustment)
      .expect(201);
    assert.equal((await db.inventory.findUniqueOrThrow({ where: { productId: id } })).onHand, 5);
    assert.equal(await db.inventoryMovement.count({ where: { productId: id } }), 1);
    await request(server)
      .post(`/api/v1/admin/inventory/${id}/adjustments`)
      .set(headers)
      .send({ ...adjustment, delta: 10 })
      .expect(409);
    const results = await Promise.all(
      [1, 2].map(() =>
        request(server)
          .post(`/api/v1/admin/inventory/${id}/adjustments`)
          .set(headers)
          .send({ delta: -5, reason: 'Correction', operationId: randomUUID() }),
      ),
    );
    assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
    const movements = await request(server)
      .get(`/api/v1/admin/inventory/${id}/movements`)
      .set('Cookie', cookie)
      .expect(200);
    assert.equal(movements.body.length, 2);
    assert.equal(movements.body[0].actorId, admin.id);
    await db.inventory.update({ where: { productId: id }, data: { onHand: 3, reserved: 2 } });
    await request(server)
      .post(`/api/v1/admin/inventory/${id}/adjustments`)
      .set(headers)
      .send({ delta: -2, reason: 'Unsafe adjustment', operationId: randomUUID() })
      .expect(409);
    const storageKey = `commercecore/products/${id}/${randomUUID()}`;
    t.mock.method(app.get(CloudinaryService), 'verify', async () => ({
      storageKey,
      url: 'https://res.cloudinary.com/test-cloud/image/upload/fixture.png',
    }));
    const image = await request(server)
      .post(`/api/v1/admin/products/${id}/images`)
      .set(headers)
      .send({ storageKey, alt: 'Lamp on a desk' })
      .expect(201);
    assert.equal(image.body.storageKey, storageKey);
    await request(server)
      .delete(`/api/v1/admin/products/${id}/images/${image.body.id}`)
      .set(headers)
      .expect(200);
    await request(server).delete(`/api/v1/admin/products/${id}`).set(headers).expect(200);
    await request(server).get('/api/v1/products/admin-lamp').expect(404);
    assert.equal((await db.product.findUniqueOrThrow({ where: { id } })).status, 'ARCHIVED');
  }));
