'use client';
import { useState } from 'react';
import Link from 'next/link';
import { authenticatedMutation } from '@/lib/auth-client';
import { formatPrice } from '@/lib/catalog';
import type { CartData } from './cart-types';
export function CartView({ initial }: { initial: CartData }) {
  const [cart, setCart] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function change(id: string, quantity?: number) {
    setBusy(true);
    setError('');
    try {
      const response = await authenticatedMutation(
        `cart/items/${id}`,
        quantity === undefined ? 'DELETE' : 'PUT',
        { version: cart.version, ...(quantity === undefined ? {} : { quantity }) },
      );
      setCart(await response.json());
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to update cart.');
      const latest = await fetch('/api/backend/cart', { cache: 'no-store' }).catch(() => null);
      if (latest?.ok) setCart(await latest.json());
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
      <div>
        {error && (
          <p role="alert" className="mb-5 text-red-300">
            {error}
          </p>
        )}
        {cart.items.length === 0 && (
          <p className="rounded-xl border border-slate-800 p-8">
            Your cart is empty.{' '}
            <Link href="/" className="text-teal-300 underline">
              Explore the catalog
            </Link>
          </p>
        )}
        <ul className="space-y-4">
          {cart.items.map((item) => (
            <li
              key={item.productId}
              className="flex flex-wrap items-center justify-between gap-5 rounded-xl border border-slate-800 p-5"
            >
              <div>
                <Link href={`/products/${item.slug}`} className="font-semibold">
                  {item.name}
                </Link>
                <p className="mt-2 text-sm text-slate-400">
                  {formatPrice(item.unitPriceMinor)} each
                </p>
                {!item.available && (
                  <p className="text-sm text-amber-300">This quantity is no longer available.</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  disabled={busy || item.quantity <= 1}
                  onClick={() => void change(item.productId, item.quantity - 1)}
                  aria-label={`Decrease ${item.name} quantity`}
                  className="rounded border border-slate-700 px-3 py-2"
                >
                  −
                </button>
                <span aria-label="Quantity">{item.quantity}</span>
                <button
                  disabled={busy || item.quantity >= 100}
                  onClick={() => void change(item.productId, item.quantity + 1)}
                  aria-label={`Increase ${item.name} quantity`}
                  className="rounded border border-slate-700 px-3 py-2"
                >
                  +
                </button>
              </div>
              <span>{formatPrice(item.lineTotalMinor)}</span>
              <button
                disabled={busy}
                onClick={() => void change(item.productId)}
                className="text-sm text-amber-300 underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </div>
      <aside className="h-fit rounded-xl border border-slate-800 p-6">
        <h2 className="text-xl font-semibold">Order summary</h2>
        {cart.checkoutReady && (
          <Link href="/checkout" className="button mt-5 inline-block">
            Continue to checkout
          </Link>
        )}
        <div className="mt-6 flex justify-between">
          <span>Subtotal</span>
          <strong>{formatPrice(cart.subtotalMinor)}</strong>
        </div>
        <p className="mt-5 text-sm leading-6 text-slate-400">
          Prices and availability are checked again at checkout. Items in your cart are not
          reserved.
        </p>
      </aside>
    </div>
  );
}
