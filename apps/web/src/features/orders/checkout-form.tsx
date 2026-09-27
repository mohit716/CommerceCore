'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, authenticatedMutation } from '@/lib/auth-client';
export function CheckoutForm({ cartVersion }: { cartVersion: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<{ key: string; body: unknown } | null>(null);
  const router = useRouter();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      // Retry the identical payload and key after an ambiguous network failure.
      if (!pending.current)
        pending.current = {
          key: crypto.randomUUID(),
          body: {
            cartVersion,
            shippingAddress: {
              name: form.get('name'),
              line1: form.get('line1'),
              city: form.get('city'),
              region: form.get('region'),
              postalCode: form.get('postalCode'),
              country: 'US',
            },
          },
        };
      const attempt = pending.current;
      const response = await authenticatedMutation('checkout', 'POST', attempt.body, {
        'Idempotency-Key': attempt.key,
      });
      const order = await response.json();
      router.push(`/orders/${order.id}`);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) pending.current = null;
      setError(error instanceof Error ? error.message : 'Checkout failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="max-w-xl space-y-5">
      <p className="text-slate-300">
        Demo checkout: US addresses, USD, no shipping charge or tax calculation. Payment uses Stripe
        test mode.
      </p>
      {(
        [
          ['name', 'Full name', 'name'],
          ['line1', 'Street address', 'address-line1'],
          ['city', 'City', 'address-level2'],
          ['region', 'State', 'address-level1'],
          ['postalCode', 'ZIP code', 'postal-code'],
        ] as const
      ).map(([name, label, autocomplete]) => (
        <label key={name} className="block">
          {label}
          <input
            required
            name={name}
            autoComplete={autocomplete}
            maxLength={name === 'line1' ? 200 : name === 'postalCode' ? 20 : 100}
            className="mt-2 block w-full rounded border border-slate-600 bg-slate-900 p-3"
          />
        </label>
      ))}
      {error && (
        <p role="alert" className="text-red-300">
          {error} Retry sends your original request. Check order history before starting again.
        </p>
      )}
      <button disabled={busy} className="button">
        {busy ? 'Creating order...' : 'Reserve items and create order'}
      </button>
    </form>
  );
}
