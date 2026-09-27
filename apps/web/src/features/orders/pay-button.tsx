'use client';
import { useState } from 'react';
import { authenticatedMutation } from '@/lib/auth-client';
export function PayButton({ orderId }: { orderId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function pay() {
    setBusy(true);
    setError('');
    try {
      const response = await authenticatedMutation(`orders/${orderId}/payment`, 'POST');
      const { url } = await response.json();
      const target = new URL(url);
      if (target.protocol !== 'https:' || target.hostname !== 'checkout.stripe.com')
        throw new Error('Invalid payment URL.');
      window.location.assign(target.toString());
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to start payment.');
      setBusy(false);
    }
  }
  return (
    <div className="mt-6">
      <button disabled={busy} onClick={pay} className="button">
        {busy ? 'Opening Stripe...' : 'Pay with Stripe (test mode)'}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
