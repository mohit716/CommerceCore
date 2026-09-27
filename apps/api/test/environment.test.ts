import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateEnvironment } from '../src/common/config/environment';

const valid = {
  DATABASE_URL: 'postgresql://local:secret@localhost:5432/commercecore',
  REDIS_URL: 'redis://localhost:6379',
};

test('parses ports and applies development defaults', () => {
  const result = validateEnvironment({ ...valid, API_PORT: '4000' });
  assert.equal(result.API_PORT, 4000);
  assert.equal(result.NODE_ENV, 'development');
});

test('rejects missing database configuration', () => {
  assert.throws(() => validateEnvironment({ REDIS_URL: valid.REDIS_URL }), /DATABASE_URL/);
});

test('reports malformed URLs as configuration errors', () => {
  assert.throws(
    () => validateEnvironment({ ...valid, DATABASE_URL: 'not a URL' }),
    /Invalid environment configuration: DATABASE_URL/,
  );
});

test('rejects invalid ports and protocols without exposing secrets', () => {
  assert.throws(
    () => validateEnvironment({ ...valid, API_PORT: '70000', REDIS_URL: 'https://secret.invalid' }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /API_PORT/);
      assert.match(error.message, /REDIS_URL/);
      assert.doesNotMatch(error.message, /secret/);
      return true;
    },
  );
});
