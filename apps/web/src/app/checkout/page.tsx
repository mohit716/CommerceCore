import Link from 'next/link';
import { privateApi } from '@/lib/private-api';
import { CheckoutForm } from '@/features/orders/checkout-form';
import { formatPrice } from '@/lib/catalog';
export default async function CheckoutPage() {
  const cart = await privateApi('cart');
  return (
    <section className="mx-auto max-w-5xl py-12">
      <h1 className="mb-6 text-3xl font-semibold">Checkout</h1>
      {cart.checkoutReady ? (
        <>
          <p className="mb-6 text-xl">Order total: {formatPrice(cart.subtotalMinor)}</p>
          <CheckoutForm cartVersion={cart.version} />
        </>
      ) : (
        <p>
          Review your cart before checking out.{' '}
          <Link href="/cart" className="underline">
            Return to cart
          </Link>
        </p>
      )}
    </section>
  );
}
