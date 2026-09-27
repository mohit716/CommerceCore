import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getApiHealth } from '../src/lib/api-health.ts';

test('proxies a fixed readiness path without caching', async () => {
  const fetcher: typeof fetch = async (url, options) => {
    assert.equal(String(url), 'http://localhost:3001/api/v1/health/ready');
    assert.equal(options?.cache, 'no-store');
    assert.ok(options?.signal);
    return Response.json({ status: 'ok' });
  };
  assert.equal((await getApiHealth('http://localhost:3001', fetcher)).status, 200);
});

test('reports upstream readiness failures without leaking their body', async () => {
  const response = await getApiHealth('http://localhost:3001', async () =>
    Response.json({ internal: 'private connection details' }, { status: 503 }),
  );
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: 'unavailable' });
});

test('reports connection failures as unavailable', async () => {
  const response = await getApiHealth('http://localhost:3001', async () => {
    throw new Error('ECONNREFUSED');
  });
  assert.equal(response.status, 503);
});
