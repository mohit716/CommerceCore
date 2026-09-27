import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashPassword, verifyPassword } from '../src/modules/auth/password';
import {
  csrfToken,
  hashToken,
  newToken,
  readSession,
  sessionCookie,
  validCsrf,
} from '../src/modules/auth/session';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from '../src/modules/auth/auth.guards';

test('password hashing uses independent salts and verifies without plaintext storage', async () => {
  const password = 'Example-password-1234';
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.ok(!first.includes(password));
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword('wrong-password', first), false);
  assert.equal(await verifyPassword(password), false);
});
test('opaque sessions and CSRF tokens are bound together', () => {
  const token = newToken();
  assert.equal(token.length, 64);
  assert.notEqual(hashToken(token), token);
  assert.equal(validCsrf(csrfToken(token), token), true);
  assert.equal(validCsrf(csrfToken(newToken()), token), false);
  assert.equal(validCsrf(['invalid'], token), false);
  assert.equal(readSession(`cc_session=${token}`, false), token);
  assert.equal(readSession(`cc_session=${token}; cc_session=${token}`, false), undefined);
});
test('production cookies are host-bound, HttpOnly, Secure and clear with matching scope', () => {
  const cookie = sessionCookie(newToken(), true);
  assert.match(cookie, /^__Host-cc_session=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /; Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.doesNotMatch(cookie, /Domain=/);
  assert.match(sessionCookie('', true, true), /Max-Age=0; Secure/);
});
test('role guard denies customers even when a route requires admin', () => {
  const guard = new RolesGuard({ getAllAndOverride: () => ['ADMIN'] } as unknown as Reflector);
  const context = (role: string) =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ auth: { role } }) }),
    }) as unknown as ExecutionContext;
  assert.throws(() => guard.canActivate(context('CUSTOMER')), /Insufficient/);
  assert.equal(guard.canActivate(context('ADMIN')), true);
});
