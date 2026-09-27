'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authenticatedMutation } from '@/lib/auth-client';
import type { CartData } from './cart-types';
export function AddToCart({ productId, available }: { productId: string; available: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();
  async function add() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/backend/cart', { cache: 'no-store' });
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      if (!response.ok) throw new Error('Unable to load your cart.');
      const cart = (await response.json()) as CartData;
      const quantity = (cart.items.find((item) => item.productId === productId)?.quantity ?? 0) + 1;
      await authenticatedMutation(`cart/items/${productId}`, 'PUT', {
        version: cart.version,
        quantity,
      });
      router.push('/cart');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to add item.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-6">
      <button disabled={busy || !available} onClick={add} className="button w-full">
        {busy ? 'Adding...' : 'Add to cart'}
      </button>
      {message && (
        <p role="alert" className="mt-3 text-red-300">
          {message}
        </p>
      )}
    </div>
  );
}
