import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import type { Environment } from '../../common/config/environment';

@Injectable()
export class StripeGateway {
  private readonly stripe?: Stripe;
  constructor(private readonly config: ConfigService<Environment, true>) {
    const key = config.get('STRIPE_SECRET_KEY', { infer: true });
    if (key) this.stripe = new Stripe(key, { maxNetworkRetries: 2, timeout: 10000 });
  }
  available() {
    if (!this.stripe)
      throw new ServiceUnavailableException('Stripe test payments are not configured.');
    return this.stripe;
  }
  create(params: Stripe.Checkout.SessionCreateParams, attemptId: string) {
    return this.available().checkout.sessions.create(params, {
      idempotencyKey: `checkout-${attemptId}`,
    });
  }
  retrieve(id: string) {
    return this.available().checkout.sessions.retrieve(id);
  }
  expire(id: string) {
    return this.available().checkout.sessions.expire(id, {}, { idempotencyKey: `expire-${id}` });
  }
  verify(raw: Buffer | undefined, signature: string | undefined) {
    const secret = this.config.get('STRIPE_WEBHOOK_SECRET', { infer: true });
    if (!secret) throw new ServiceUnavailableException('Stripe webhook is not configured.');
    if (!raw || !signature) throw new BadRequestException('Missing webhook signature or raw body.');
    try {
      return this.available().webhooks.constructEvent(raw, signature, secret);
    } catch {
      throw new BadRequestException('Invalid webhook signature.');
    }
  }
}
