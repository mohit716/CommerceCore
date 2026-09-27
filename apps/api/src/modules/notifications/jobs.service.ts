import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import type { Environment } from '../../common/config/environment';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { redisNamespace } from '../../infrastructure/redis/cache.service';
import { PaymentService } from '../payments/payment.service';
import { EmailService } from './email.service';

@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private producer?: Redis;
  private consumer?: Redis;
  queue?: Queue;
  private worker?: Worker;
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;
  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService<Environment, true>,
    private readonly email: EmailService,
    private readonly payments: PaymentService,
  ) {}
  private initialize() {
    if (this.queue) return;
    this.producer = new Redis(this.config.get('REDIS_URL', { infer: true }), {
      maxRetriesPerRequest: 1,
      connectTimeout: 1500,
      commandTimeout: 2000,
    });
    this.producer.on('error', () => undefined);
    this.queue = new Queue('notifications', {
      connection: this.producer,
      prefix: redisNamespace(this.config.get('DATABASE_URL', { infer: true })),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 1000 },
      },
    });
    this.queue.on('error', () => this.logger.warn({ code: 'QUEUE_UNAVAILABLE' }));
  }
  onModuleInit() {
    if (this.config.get('PROCESS_ROLE', { infer: true }) === 'worker') this.start();
  }
  start() {
    if (this.worker) return;
    this.initialize();
    this.consumer = new Redis(this.config.get('REDIS_URL', { infer: true }), {
      maxRetriesPerRequest: null,
      connectTimeout: 1500,
    });
    this.consumer.on('error', () => undefined);
    this.worker = new Worker(
      'notifications',
      async (job) => this.deliver(job.data.eventId as string),
      {
        connection: this.consumer,
        prefix: redisNamespace(this.config.get('DATABASE_URL', { infer: true })),
        concurrency: 2,
      },
    );
    this.worker.on('error', () => this.logger.warn({ code: 'WORKER_CONNECTION_RETRY' }));
    this.worker.on('failed', (job) =>
      this.logger.warn({ code: 'NOTIFICATION_RETRY', jobId: job?.id }),
    );
    const tick = () => {
      if (!this.running)
        this.running = this.tick()
          .catch(() => this.logger.warn({ code: 'WORKER_TICK_RETRY' }))
          .finally(() => {
            this.running = undefined;
          });
    };
    this.timer = setInterval(tick, 10000);
    this.timer.unref();
    tick();
  }
  async tick() {
    await this.dispatch();
    await this.payments.reconcile();
  }
  async dispatch() {
    this.initialize();
    const events = await this.db.outboxEvent.findMany({
      where: { deliveredAt: null, attempts: { lt: 10 }, nextAttemptAt: { lte: new Date() } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    for (const event of events) {
      // Job ID includes the durable attempt count, so a lost/failed Redis job can be recovered.
      await this.queue!.add(
        'order-confirmed',
        { eventId: event.id },
        { jobId: `${event.id}-${event.attempts}-${event.nextAttemptAt.getTime()}` },
      );
      await this.db.outboxEvent.updateMany({
        where: { id: event.id, deliveredAt: null },
        data: { nextAttemptAt: new Date(Date.now() + 60000) },
      });
    }
  }
  async deliver(eventId: string) {
    const token = randomUUID();
    const now = new Date();
    const claimed = await this.db.outboxEvent.updateMany({
      where: {
        id: eventId,
        deliveredAt: null,
        attempts: { lt: 10 },
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
      },
      data: {
        leaseToken: token,
        leaseUntil: new Date(Date.now() + 60000),
        attempts: { increment: 1 },
      },
    });
    if (!claimed.count) return;
    try {
      const event = await this.db.outboxEvent.findUniqueOrThrow({
        where: { id: eventId },
        include: { order: { include: { user: true, items: true } } },
      });
      if (!['PAID', 'FULFILLED'].includes(event.order.status)) throw new Error('Order is not paid');
      await this.email.confirmation(event.id, event.order);
      await this.db.outboxEvent.updateMany({
        where: { id: eventId, leaseToken: token },
        data: { deliveredAt: new Date(), leaseUntil: null, leaseToken: null, lastError: null },
      });
    } catch {
      await this.db.outboxEvent.updateMany({
        where: { id: eventId, leaseToken: token },
        data: {
          leaseUntil: null,
          leaseToken: null,
          lastError: 'EMAIL_DELIVERY_FAILED',
          nextAttemptAt: new Date(Date.now() + 60000),
        },
      });
      throw new Error('EMAIL_DELIVERY_FAILED');
    }
  }
  async status() {
    return {
      pending: await this.db.outboxEvent.count({
        where: { deliveredAt: null, attempts: { lt: 10 } },
      }),
      failed: await this.db.outboxEvent.findMany({
        where: { deliveredAt: null, attempts: { gte: 10 } },
        select: { id: true, orderId: true, attempts: true, lastError: true, createdAt: true },
        take: 100,
        orderBy: { createdAt: 'asc' },
      }),
      paymentReview: await this.db.paymentAttempt.findMany({
        where: { status: 'REVIEW_REQUIRED' },
        select: { id: true, orderId: true, createdAt: true },
        take: 100,
      }),
    };
  }
  async retry(id: string) {
    return this.db.outboxEvent.updateMany({
      where: { id, deliveredAt: null, attempts: { gte: 10 } },
      data: { attempts: 0, nextAttemptAt: new Date(), lastError: null },
    });
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.running;
    await this.worker?.close();
    await this.queue?.close();
    this.producer?.disconnect();
    this.consumer?.disconnect();
  }
}
