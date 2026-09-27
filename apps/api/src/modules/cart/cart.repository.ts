import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export const cartInclude = {
  items: { orderBy: { productId: 'asc' }, include: { product: { include: { inventory: true } } } },
} satisfies Prisma.CartInclude;
export type CartRecord = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

@Injectable()
export class CartRepository {
  constructor(private readonly prisma: PrismaService) {}
  async ensure(userId: string) {
    return this.prisma.cart.upsert({ where: { userId }, create: { userId }, update: {} });
  }
  async read(userId: string) {
    await this.ensure(userId);
    return this.prisma.$transaction(
      (tx) => tx.cart.findUniqueOrThrow({ where: { userId }, include: cartInclude }),
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async change(userId: string, productId: string, version: number, quantity?: number) {
    await this.ensure(userId);
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.cart.updateMany({
        where: { userId, version },
        data: { version: { increment: 1 } },
      });
      if (changed.count !== 1)
        throw new ConflictException({
          code: 'CART_VERSION_CONFLICT',
          message: 'Your cart changed. Review the latest cart and try again.',
        });
      const cart = await tx.cart.findUniqueOrThrow({ where: { userId } });
      if (quantity === undefined) {
        await tx.cartItem.deleteMany({ where: { cartId: cart.id, productId } });
      } else {
        const product = await tx.product.findUnique({
          where: { id: productId },
          include: { inventory: true },
        });
        if (!product || product.status !== 'ACTIVE')
          throw new NotFoundException('Product is no longer available.');
        if (quantity > (product.inventory?.onHand ?? 0) - (product.inventory?.reserved ?? 0))
          throw new ConflictException('Requested quantity is not currently available.');
        const existing = await tx.cartItem.findUnique({
          where: { cartId_productId: { cartId: cart.id, productId } },
        });
        if (!existing && (await tx.cartItem.count({ where: { cartId: cart.id } })) >= 50)
          throw new ConflictException('A cart can contain at most 50 different products.');
        await tx.cartItem.upsert({
          where: { cartId_productId: { cartId: cart.id, productId } },
          create: { cartId: cart.id, productId, quantity },
          update: { quantity },
        });
      }
      return tx.cart.findUniqueOrThrow({ where: { id: cart.id }, include: cartInclude });
    });
  }
}
