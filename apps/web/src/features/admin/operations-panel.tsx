'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authenticatedMutation } from '@/lib/auth-client';
import { formatPrice } from '@/lib/catalog';
type Order = { id: string; status: string; totalMinor: number };
export function OperationsPanel({
  orders,
  jobs,
}: {
  orders: Order[];
  jobs: {
    pending: number;
    failed: { id: string; orderId: string; attempts: number }[];
    paymentReview: { id: string; orderId: string }[];
  };
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function act(path: string) {
    setBusy(true);
    setError('');
    try {
      await authenticatedMutation(path, 'POST');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operation failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-8">
      {error && (
        <p role="alert" className="text-red-300">
          {error}
        </p>
      )}
      <section>
        <h2 className="mb-4 text-xl font-semibold">Recent orders</h2>
        <ul className="space-y-3">
          {orders.map((order) => (
            <li
              key={order.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded border border-slate-700 p-4"
            >
              <span>
                {order.id.slice(0, 8)} · {order.status.replaceAll('_', ' ')} ·{' '}
                {formatPrice(order.totalMinor)}
              </span>
              {order.status === 'PAID' && (
                <button
                  disabled={busy}
                  className="button"
                  onClick={() => void act(`admin/orders/${order.id}/fulfill`)}
                >
                  Mark fulfilled
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-xl font-semibold">Notification delivery</h2>
        <p className="my-4">
          {jobs.pending} pending · {jobs.failed.length} failed
        </p>
        {jobs.failed.map((job) => (
          <div key={job.id} className="mb-3 flex flex-wrap gap-4">
            <span>
              Order {job.orderId.slice(0, 8)}: {job.attempts} attempts
            </span>
            <button
              className="button"
              disabled={busy}
              onClick={() => void act(`admin/jobs/${job.id}/retry`)}
            >
              Retry email
            </button>
          </div>
        ))}
      </section>
      <section>
        <h2 className="text-xl font-semibold">Payments requiring review</h2>
        <p className="my-4">
          {jobs.paymentReview.length} uncertain payment attempts. Inspect Stripe before changing
          inventory or payment state.
        </p>
        {jobs.paymentReview.map((attempt) => (
          <p key={attempt.id}>Order {attempt.orderId}</p>
        ))}
      </section>
    </div>
  );
}
