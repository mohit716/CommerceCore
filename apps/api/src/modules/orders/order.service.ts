import { Injectable } from '@nestjs/common';
import { OrderRepository } from './order.repository';
import { CheckoutDto } from './dto/checkout.dto';
import type { Prisma } from '../../generated/prisma/client';
import { orderInclude } from './order.repository';
export function publicOrder(order: Prisma.OrderGetPayload<{ include: typeof orderInclude }>) {
  return {
    id: order.id,
    status: order.status,
    totalMinor: order.totalMinor,
    currency: order.currency,
    shippingAddress: order.shippingAddress,
    createdAt: order.createdAt,
    expiresAt: order.expiresAt,
    items: order.items.map((item) => ({
      productId: item.productId,
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      unitPriceMinor: item.unitPriceMinor,
      lineTotalMinor: item.lineTotalMinor,
    })),
  };
}
@Injectable()
export class OrderService {
  constructor(private readonly repository: OrderRepository) {}
  async adminList(page: number, limit: number) {
    const result = await this.repository.list(undefined, page, limit);
    return { ...result, items: result.items.map(publicOrder) };
  }
  async checkout(userId: string, key: string, input: CheckoutDto) {
    return publicOrder(await this.repository.checkout(userId, key, input));
  }
  async detail(userId: string, id: string) {
    return publicOrder(await this.repository.detail(userId, id));
  }
  async list(userId: string, page: number, limit: number) {
    const result = await this.repository.list(userId, page, limit);
    return { ...result, items: result.items.map(publicOrder) };
  }
  fulfill(id: string) {
    return this.repository.fulfill(id);
  }
}
