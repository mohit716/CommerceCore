import { Injectable } from '@nestjs/common';
import { CartRepository, type CartRecord } from './cart.repository';

export function cartResponse(cart: CartRecord) {
  const items = cart.items.map(({ product, quantity }) => ({
    productId: product.id,
    slug: product.slug,
    name: product.name,
    quantity,
    unitPriceMinor: product.priceMinor,
    lineTotalMinor: product.priceMinor * quantity,
    available:
      product.status === 'ACTIVE' &&
      quantity <= (product.inventory?.onHand ?? 0) - (product.inventory?.reserved ?? 0),
  }));
  return {
    id: cart.id,
    version: cart.version,
    currency: 'USD',
    items,
    subtotalMinor: items.reduce((total, item) => total + item.lineTotalMinor, 0),
    checkoutReady: items.length > 0 && items.every((item) => item.available),
  };
}
@Injectable()
export class CartService {
  constructor(private readonly repository: CartRepository) {}
  async read(userId: string) {
    return cartResponse(await this.repository.read(userId));
  }
  async change(userId: string, productId: string, version: number, quantity?: number) {
    return cartResponse(await this.repository.change(userId, productId, version, quantity));
  }
}
