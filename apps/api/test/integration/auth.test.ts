import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { withTestApp } from './test-app';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { hashToken } from '../../src/modules/auth/session';

test('real signup/login, identity ownership, roles, CSRF, session expiry and revocation', async () =>
  withTestApp(async (app) => {
    const server = app.getHttpServer();
    const db = app.get(PrismaService);
    const origin = 'http://localhost:3000';
    const signup = {
      email: 'Customer@Example.test',
      name: 'Customer',
      password: 'Example-password-1234',
    };
    await request(server).post('/api/v1/auth/signup').send(signup).expect(403);
    await request(server)
      .post('/api/v1/auth/signup')
      .set('Origin', origin)
      .send({ ...signup, role: 'ADMIN' })
      .expect(400);
    const created = await request(server)
      .post('/api/v1/auth/signup')
      .set('Origin', origin)
      .send(signup)
      .expect(201);
    assert.equal(created.body.role, 'CUSTOMER');
    assert.equal(created.body.email, 'customer@example.test');
    assert.equal('passwordHash' in created.body, false);
    const setCookie = created.headers['set-cookie']![0]!;
    assert.match(setCookie, /HttpOnly/);
    const cookie = setCookie.split(';')[0]!;
    const token = cookie.split('=')[1]!;
    const session = await db.session.findUniqueOrThrow({ where: { tokenHash: hashToken(token) } });
    assert.notEqual(session.tokenHash, token);
    await request(server)
      .post('/api/v1/auth/signup')
      .set('Origin', origin)
      .send(signup)
      .expect(409);
    const other = await request(server)
      .post('/api/v1/auth/signup')
      .set('Origin', origin)
      .send({ ...signup, email: 'other@example.test' })
      .expect(201);
    const own = await request(server)
      .get(`/api/v1/users/me?userId=${other.body.id}`)
      .set('Cookie', cookie)
      .expect(200);
    assert.equal(own.body.id, created.body.id);
    await request(server).get('/api/v1/auth/me').expect(401);
    await request(server).get('/api/v1/auth/me').set('Cookie', cookie).expect(200);
    await request(server)
      .post('/api/v1/auth/login')
      .set('Origin', origin)
      .send({ email: signup.email, password: 'wrong-password-1234' })
      .expect(401);
    await request(server)
      .post('/api/v1/auth/logout')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .expect(403);
    const csrf = await request(server).get('/api/v1/auth/csrf').set('Cookie', cookie).expect(200);
    await request(server)
      .post('/api/v1/auth/logout')
      .set('Origin', 'https://untrusted.example')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrf.body.csrfToken)
      .expect(403);
    await request(server)
      .post('/api/v1/auth/logout')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', csrf.body.csrfToken)
      .expect(204);
    await request(server).get('/api/v1/auth/me').set('Cookie', cookie).expect(401);
    const login = await request(server)
      .post('/api/v1/auth/login')
      .set('Origin', origin)
      .send({ email: signup.email, password: signup.password })
      .expect(200);
    const nextCookie = login.headers['set-cookie']![0]!.split(';')[0]!;
    assert.notEqual(nextCookie, cookie);
    const nextToken = nextCookie.split('=')[1]!;
    await db.session.update({
      where: { tokenHash: hashToken(nextToken) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await request(server).get('/api/v1/auth/me').set('Cookie', nextCookie).expect(401);
  }));
