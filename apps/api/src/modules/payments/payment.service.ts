import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { Environment } from '../../common/config/environment';
import type { Prisma } from '../../generated/prisma/client';
import { StripeGateway } from './stripe.gateway';
import { invalidateCatalog } from '../../infrastructure/redis/catalog-revision';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  constructor(
    private readonly db: PrismaService,
    private readonly gateway: StripeGateway,
    private readonly config: ConfigService<Environment, true>,
  ) {}
  async start(userId: string, orderId: string) {
    this.gateway.available();
    const attempt = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId}::uuid FOR UPDATE`;
      const order = await tx.order.findFirst({
        where: { id: orderId, userId },
        include: { paymentAttempt: true, items: { orderBy: { productId: 'asc' } } },
      });
      if (!order) throw new NotFoundException('Order not found.');
      if (order.status !== 'PENDING_PAYMENT' || order.expiresAt <= new Date())
        throw new ConflictException('This order is no longer open for payment.');
      if (order.paymentAttempt) return order.paymentAttempt;
      const id = randomUUID();
      const origin = this.config.get('WEB_ORIGIN', { infer: true });
      const params: Stripe.Checkout.SessionCreateParams = {
        mode: 'payment',
        payment_method_types: ['card'],
        client_reference_id: order.id,
        metadata: { orderId: order.id, attemptId: id },
        success_url: `${origin}/orders/${order.id}?payment=return`,
        cancel_url: `${origin}/orders/${order.id}`,
        line_items: order.items.map((item) => ({
          quantity: item.quantity,
          price_data: {
            currency: order.currency.toLowerCase(),
            unit_amount: item.unitPriceMinor,
            product_data: { name: item.name },
          },
        })),
      };
      return tx.paymentAttempt.create({
        data: {
          id,
          orderId,
          amountMinor: order.totalMinor,
          currency: order.currency,
          requestParams: params as Prisma.InputJsonObject,
        },
      });
    });
    const session = attempt.stripeSessionId
      ? await this.gateway.retrieve(attempt.stripeSessionId)
      : await this.gateway.create(
          attempt.requestParams as unknown as Stripe.Checkout.SessionCreateParams,
          attempt.id,
        );
    await this.apply(session);
    if (session.status !== 'open' || !session.url)
      throw new ConflictException('Payment session is no longer open. Refresh your order.');
    return { url: session.url };
  }
  async webhook(raw: Buffer | undefined, signature: string | undefined) {
    const event = this.gateway.verify(raw, signature);
    if (event.livemode) throw new BadRequestException('Only Stripe test events are accepted.');
    if (await this.db.webhookEvent.findUnique({ where: { id: event.id } }))
      return { received: true };
    if (
      ![
        'checkout.session.completed',
        'checkout.session.expired',
        'checkout.session.async_payment_succeeded',
        'checkout.session.async_payment_failed',
      ].includes(event.type)
    )
      return { received: true };
    const object = event.data.object as Stripe.Checkout.Session;
    // Read current provider state: event arrival order is not a reliable state machine.
    const session = await this.gateway.retrieve(object.id);
    await this.apply(session, { id: event.id, type: event.type });
    return { received: true };
  }
  async apply(session: Stripe.Checkout.Session, event?: { id: string; type: string }) {
    const orderId = session.metadata?.orderId;
    const attemptId = session.metadata?.attemptId;
    if (!orderId || !attemptId || !/^[a-f0-9-]{36}$/.test(orderId))
      throw new BadRequestException('Invalid payment metadata.');
    return this.db.$transaction(async (tx) => {
      if (event) {
        const inserted = await tx.webhookEvent.createMany({ data: [event], skipDuplicates: true });
        if (!inserted.count) return;
      }
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId}::uuid FOR UPDATE`;
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { paymentAttempt: true, reservations: { orderBy: { productId: 'asc' } } },
      });
      const attempt = order?.paymentAttempt;
      if (
        !order ||
        !attempt ||
        attempt.id !== attemptId ||
        session.livemode ||
        session.mode !== 'payment' ||
        session.client_reference_id !== orderId ||
        session.amount_total !== order.totalMinor ||
        session.currency !== order.currency.toLowerCase() ||
        (attempt.stripeSessionId && attempt.stripeSessionId !== session.id)
      )
        throw new BadRequestException('Payment does not match the order.');
      await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: { stripeSessionId: session.id, checkoutUrl: session.url },
      });
      if (order.status === 'PAID' || order.status === 'FULFILLED') return;
      const paid = session.status === 'complete' && session.payment_status === 'paid';
      const expired = session.status === 'expired' && session.payment_status === 'unpaid';
      if (order.status !== 'PENDING_PAYMENT') {
        if (paid)
          throw new ConflictException(
            'Payment received for a closed order; operator review required.',
          );
        return;
      }
      if (paid || expired) {
        for (const reservation of order.reservations) {
          if (reservation.status !== 'HELD')
            throw new ConflictException('Invalid reservation state.');
          const changed = paid
            ? await tx.$executeRaw`UPDATE "Inventory" SET "onHand" = "onHand" - ${reservation.quantity}, reserved = reserved - ${reservation.quantity}, "updatedAt" = now() WHERE "productId" = ${reservation.productId}::uuid AND reserved >= ${reservation.quantity}`
            : await tx.$executeRaw`UPDATE "Inventory" SET reserved = reserved - ${reservation.quantity}, "updatedAt" = now() WHERE "productId" = ${reservation.productId}::uuid AND reserved >= ${reservation.quantity}`;
          if (changed !== 1) throw new ConflictException('Invalid reserved stock.');
        }
        await tx.inventoryReservation.updateMany({
          where: { orderId, status: 'HELD' },
          data: { status: paid ? 'CONSUMED' : 'RELEASED' },
        });
        await tx.order.update({
          where: { id: orderId },
          data: { status: paid ? 'PAID' : 'EXPIRED' },
        });
        await tx.paymentAttempt.update({
          where: { id: attempt.id },
          data: { status: paid ? 'PAID' : 'EXPIRED' },
        });
        if (paid) await tx.outboxEvent.create({ data: { orderId } });
        await invalidateCatalog(tx);
      } else if (attempt.status === 'CREATING') {
        await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: 'OPEN' } });
      }
    });
  }
  async reconcile(limit = 100) {
    const orders = await this.db.order.findMany({
      where: { status: 'PENDING_PAYMENT', expiresAt: { lte: new Date() } },
      orderBy: { expiresAt: 'asc' },
      take: limit,
      include: { paymentAttempt: true },
    });
    for (const order of orders) {
      try {
        const attempt = order.paymentAttempt;
        if (!attempt) {
          await this.releaseUnstarted(order.id);
          continue;
        }
        if (
          !attempt.stripeSessionId &&
          Date.now() - attempt.createdAt.getTime() > 23 * 60 * 60 * 1000
        ) {
          // Stripe may prune idempotency keys after 24h. Never recreate an uncertain charge then.
          await this.db.paymentAttempt.update({
            where: { id: attempt.id },
            data: { status: 'REVIEW_REQUIRED' },
          });
          this.logger.error({ code: 'PAYMENT_REVIEW_REQUIRED', orderId: order.id });
          continue;
        }
        let session = attempt.stripeSessionId
          ? await this.gateway.retrieve(attempt.stripeSessionId)
          : await this.gateway.create(
              attempt.requestParams as unknown as Stripe.Checkout.SessionCreateParams,
              attempt.id,
            );
        if (session.status === 'open') {
          try {
            session = await this.gateway.expire(session.id);
          } catch {
            session = await this.gateway.retrieve(session.id);
          }
        }
        await this.apply(session);
      } catch {
        this.logger.warn({ code: 'PAYMENT_RECONCILIATION_RETRY', orderId: order.id });
      }
    }
  }
  private async releaseUnstarted(orderId: string) {
    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId}::uuid FOR UPDATE`;
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { paymentAttempt: true, reservations: { orderBy: { productId: 'asc' } } },
      });
      if (
        order.paymentAttempt ||
        order.status !== 'PENDING_PAYMENT' ||
        order.expiresAt > new Date()
      )
        return;
      for (const r of order.reservations) {
        if (r.status !== 'HELD') throw new ConflictException('Invalid reservation state.');
        const count =
          await tx.$executeRaw`UPDATE "Inventory" SET reserved = reserved - ${r.quantity}, "updatedAt" = now() WHERE "productId" = ${r.productId}::uuid AND reserved >= ${r.quantity}`;
        if (count !== 1) throw new ConflictException('Invalid reserved stock.');
      }
      await tx.inventoryReservation.updateMany({
        where: { orderId },
        data: { status: 'RELEASED' },
      });
      await tx.order.update({ where: { id: orderId }, data: { status: 'EXPIRED' } });
      await invalidateCatalog(tx);
    });
  }
}
