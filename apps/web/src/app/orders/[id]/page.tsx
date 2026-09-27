import Link from 'next/link';
import { privateApi } from '@/lib/private-api';
import { formatPrice } from '@/lib/catalog';
import { PayButton } from '@/features/orders/pay-button';
import { notFound } from 'next/navigation';
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) notFound();
  const order = await privateApi(`orders/${id}`);
  return (
    <section className="mx-auto max-w-4xl py-12">
      <Link href="/orders" className="text-teal-300 underline">
        All orders
      </Link>
      <h1 className="mt-6 text-3xl font-semibold">Order {order.id.slice(0, 8)}</h1>
      <p className="mt-4 text-xl">{order.status.replaceAll('_', ' ')}</p>
      {order.status === 'PENDING_PAYMENT' ? (
        <>
          <p className="mt-4 text-slate-300">
            Payment has not been confirmed. After returning from Stripe, refresh this page to check
            its status. Your order is confirmed only after server verification.
          </p>
          <PayButton orderId={id} />
        </>
      ) : (
        <p className="mt-4">
          {['PAID', 'FULFILLED'].includes(order.status)
            ? 'Thank you. Your test payment is confirmed.'
            : 'This order is closed. You can create a new order from your cart.'}
        </p>
      )}
      <ul className="mt-8 divide-y divide-slate-800">
        {order.items.map(
          (item: { productId: string; name: string; quantity: number; lineTotalMinor: number }) => (
            <li key={item.productId} className="flex justify-between gap-4 py-4">
              <span>
                {item.name} × {item.quantity}
              </span>
              <span>{formatPrice(item.lineTotalMinor)}</span>
            </li>
          ),
        )}
      </ul>
      <p className="mt-6 text-xl font-semibold">Total: {formatPrice(order.totalMinor)}</p>
    </section>
  );
}
