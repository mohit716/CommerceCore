import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { CheckoutDto } from './dto/checkout.dto';
import { invalidateCatalog } from '../../infrastructure/redis/catalog-revision';

export const orderInclude = {
  items: { orderBy: { productId: 'asc' } },
} satisfies Prisma.OrderInclude;
export function checkoutHash(input: CheckoutDto) {
  const a = input.shippingAddress;
  return createHash('sha256')
    .update(
      JSON.stringify([
        input.cartVersion,
        a.name,
        a.line1,
        a.city,
        a.region,
        a.postalCode,
        a.country,
      ]),
    )
    .digest('hex');
}
@Injectable()
export class OrderRepository {
  constructor(private readonly db: PrismaService) {}
  async checkout(userId: string, key: string, input: CheckoutDto) {
    const hash = checkoutHash(input);
    const replay = async () => {
      const order = await this.db.order.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey: key } },
        include: orderInclude,
      });
      if (order && order.requestHash !== hash)
        throw new ConflictException('Idempotency key was already used with a different request.');
      return order;
    };
    const previous = await replay();
    if (previous) return previous;
    try {
      return await this.db.$transaction(
        async (tx) => {
          // Serialize cart edits and checkout. Rollback restores the version on any failure.
          const changed = await tx.cart.updateMany({
            where: { userId, version: input.cartVersion },
            data: { version: { increment: 1 } },
          });
          if (changed.count !== 1)
            throw new ConflictException('Your cart changed. Review it before checkout.');
          const cart = await tx.cart.findUniqueOrThrow({
            where: { userId },
            include: { items: { orderBy: { productId: 'asc' } } },
          });
          if (!cart.items.length) throw new ConflictException('Your cart is empty.');
          // Product share locks keep snapshots consistent with concurrent admin price/archive edits.
          const snapshots = [];
          for (const item of cart.items) {
            await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${item.productId}::uuid FOR SHARE`;
            const product = await tx.product.findUniqueOrThrow({ where: { id: item.productId } });
            if (product.status !== 'ACTIVE')
              throw new ConflictException('A product is no longer available.');
            const count =
              await tx.$executeRaw`UPDATE "Inventory" SET reserved = reserved + ${item.quantity}, "updatedAt" = now() WHERE "productId" = ${item.productId}::uuid AND "onHand" - reserved >= ${item.quantity}`;
            if (count !== 1) throw new ConflictException('Insufficient stock. Review your cart.');
            snapshots.push({
              productId: item.productId,
              sku: product.sku,
              name: product.name,
              quantity: item.quantity,
              unitPriceMinor: product.priceMinor,
              lineTotalMinor: product.priceMinor * item.quantity,
            });
          }
          const totalMinor = snapshots.reduce((sum, item) => sum + item.lineTotalMinor, 0);
          // Stripe USD minimum and maximum, also safely inside PostgreSQL integer limits.
          if (totalMinor < 50 || totalMinor > 99999999)
            throw new ConflictException('Order total must be between $0.50 and $999,999.99.');
          const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
          const order = await tx.order.create({
            data: {
              userId,
              idempotencyKey: key,
              requestHash: hash,
              totalMinor,
              shippingAddress: { ...input.shippingAddress },
              expiresAt,
              items: { create: snapshots },
              reservations: {
                create: cart.items.map((item) => ({
                  productId: item.productId,
                  quantity: item.quantity,
                  expiresAt,
                })),
              },
            },
            include: orderInclude,
          });
          await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
          await invalidateCatalog(tx);
          return order;
        },
        { timeout: 15000 },
      );
    } catch (error) {
      // A concurrent identical request may have committed while this request waited on the cart.
      const existing = await replay();
      if (existing) return existing;
      throw error;
    }
  }
  async detail(userId: string, id: string) {
    const order = await this.db.order.findFirst({ where: { id, userId }, include: orderInclude });
    if (!order) throw new NotFoundException('Order not found.');
    return order;
  }
  async list(userId: string | undefined, page: number, limit: number) {
    return this.db.$transaction(
      async (tx) => ({
        items: await tx.order.findMany({
          where: { userId },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * limit,
          take: limit,
          include: orderInclude,
        }),
        total: await tx.order.count({ where: { userId } }),
        page,
        limit,
      }),
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async fulfill(id: string) {
    const result = await this.db.order.updateMany({
      where: { id, status: 'PAID' },
      data: { status: 'FULFILLED' },
    });
    if (!result.count) throw new ConflictException('Only a paid order can be fulfilled.');
    return { id, status: 'FULFILLED' };
  }
}
