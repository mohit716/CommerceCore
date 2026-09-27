import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { requestLogging } from '../src/common/monitoring/request-logging';
import { validateEnvironment } from '../src/common/config/environment';
test('request IDs are server-generated and cookie responses are private', () => {
  const req = {
    headers: { cookie: 'private-token', 'x-request-id': 'untrusted' },
    url: '/api/v1/cart',
    method: 'GET',
  } as unknown as IncomingMessage & { requestId?: string };
  const headers = new Map<string, unknown>();
  const res = new EventEmitter() as ServerResponse;
  res.setHeader = (name: string, value: unknown) => {
    headers.set(name, value);
    return res;
  };
  let called = false;
  requestLogging(req, res, () => {
    called = true;
  });
  assert.equal(called, true);
  assert.match(req.requestId!, /^[a-f0-9-]{36}$/);
  assert.equal(headers.get('X-Request-ID'), req.requestId);
  assert.equal(headers.get('Cache-Control'), 'no-store');
});
test('production rejects insecure origins and partial SMTP credentials', () => {
  const base = { DATABASE_URL: 'postgresql://localhost/test', REDIS_URL: 'redis://localhost' };
  assert.throws(() => validateEnvironment({ ...base, NODE_ENV: 'production' }), /WEB_ORIGIN/);
  assert.throws(() => validateEnvironment({ ...base, SMTP_USER: 'someone' }), /SMTP_USER/);
  assert.equal(
    validateEnvironment({ ...base, NODE_ENV: 'production', WEB_ORIGIN: 'https://example.test' })
      .NODE_ENV,
    'production',
  );
});
