import Link from 'next/link';
import { privateApi } from '@/lib/private-api';
import { formatPrice } from '@/lib/catalog';
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const input = await searchParams;
  const page = Math.max(1, Math.min(10000, Number.parseInt(input.page ?? '1') || 1));
  const result = await privateApi(`orders?page=${page}&limit=20`);
  return (
    <section className="mx-auto max-w-5xl py-12">
      <h1 className="mb-8 text-3xl font-semibold">Your orders</h1>
      <ul className="space-y-4">
        {result.items.map(
          (order: { id: string; status: string; totalMinor: number; createdAt: string }) => (
            <li key={order.id} className="rounded-xl border border-slate-800 p-5">
              <Link href={`/orders/${order.id}`} className="text-teal-300 underline">
                Order {order.id.slice(0, 8)}
              </Link>
              <p className="mt-2">
                {order.status.replaceAll('_', ' ')} · {formatPrice(order.totalMinor)} ·{' '}
                {new Date(order.createdAt).toLocaleDateString('en-US')}
              </p>
            </li>
          ),
        )}
      </ul>
      {!result.total && <p>No orders yet.</p>}
      <nav aria-label="Order pages" className="mt-8 flex gap-6">
        {page > 1 && <Link href={`/orders?page=${page - 1}`}>Previous</Link>}
        {page * 20 < result.total && <Link href={`/orders?page=${page + 1}`}>Next</Link>}
      </nav>
    </section>
  );
}
