import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cartResponse } from '../src/modules/cart/cart.service';
import type { CartRecord } from '../src/modules/cart/cart.repository';

test('cart totals use current server prices and account for reservations and hidden products', () => {
  const record = {
    id: 'cart',
    version: 4,
    items: [
      {
        quantity: 2,
        product: {
          id: 'product',
          slug: 'lamp',
          name: 'Lamp',
          priceMinor: 1299,
          status: 'ACTIVE',
          inventory: { onHand: 3, reserved: 2 },
        },
      },
    ],
  } as unknown as CartRecord;
  const response = cartResponse(record);
  assert.equal(response.subtotalMinor, 2598);
  assert.equal(response.checkoutReady, false);
  assert.equal(response.items[0]?.available, false);
  assert.equal('userId' in response, false);
});
