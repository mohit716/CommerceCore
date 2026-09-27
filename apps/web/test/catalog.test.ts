import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catalogParams, formatPrice } from '../src/lib/catalog.ts';

test('catalog query forwards only supported scalar filters with bounded page size', () => {
  const params = catalogParams({
    search: 'lamp',
    category: ['desk', 'home'],
    limit: '999',
    unsafe: 'value',
    minPrice: '100',
  });
  assert.equal(params.toString(), 'search=lamp&minPrice=100&limit=12');
});
test('prices render from integer minor units', () => {
  assert.equal(formatPrice(1999), '$19.99');
  assert.equal(formatPrice(0), '$0.00');
});
