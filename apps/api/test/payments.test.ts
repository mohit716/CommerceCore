import assert from 'node:assert/strict';
import { test } from 'node:test';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { StripeGateway } from '../src/modules/payments/stripe.gateway';
import { validateEnvironment } from '../src/common/config/environment';

test('Stripe validates raw webhook signatures locally and rejects live configuration', () => {
  const settings = {
    DATABASE_URL: 'postgresql://localhost/test',
    REDIS_URL: 'redis://localhost',
    STRIPE_SECRET_KEY: 'sk_test_fixture',
    STRIPE_WEBHOOK_SECRET: 'whsec_fixture',
  };
  const gateway = new StripeGateway(new ConfigService(validateEnvironment(settings)));
  const stripe = new Stripe('sk_test_fixture');
  const payload = JSON.stringify({
    id: 'evt_fixture',
    type: 'checkout.session.completed',
    livemode: false,
    data: { object: {} },
  });
  const header = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: settings.STRIPE_WEBHOOK_SECRET,
  });
  assert.equal(gateway.verify(Buffer.from(payload), header).id, 'evt_fixture');
  assert.throws(() => gateway.verify(Buffer.from(payload + ' '), header));
  assert.throws(() => gateway.verify(undefined, header));
  assert.throws(() => validateEnvironment({ ...settings, STRIPE_SECRET_KEY: 'sk_live_rejected' }));
  assert.throws(() =>
    new StripeGateway(
      new ConfigService(
        validateEnvironment({ DATABASE_URL: settings.DATABASE_URL, REDIS_URL: settings.REDIS_URL }),
      ),
    ).available(),
  );
});
