import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkoutHash } from '../src/modules/orders/order.repository';

test('checkout hash is independent of object key order and binds address and cart version', () => {
  const address = {
    name: 'Ada',
    line1: '1 Main St',
    city: 'Boston',
    region: 'MA',
    postalCode: '02110',
    country: 'US',
  };
  const input = { cartVersion: 1, shippingAddress: address };
  assert.equal(
    checkoutHash(input),
    checkoutHash({
      shippingAddress: {
        country: 'US',
        postalCode: '02110',
        region: 'MA',
        city: 'Boston',
        line1: '1 Main St',
        name: 'Ada',
      },
      cartVersion: 1,
    }),
  );
  assert.notEqual(checkoutHash(input), checkoutHash({ ...input, cartVersion: 2 }));
  assert.notEqual(
    checkoutHash(input),
    checkoutHash({ ...input, shippingAddress: { ...address, city: 'Cambridge' } }),
  );
});
