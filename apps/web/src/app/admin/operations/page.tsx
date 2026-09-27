import Link from 'next/link';
import { notFound } from 'next/navigation';
import { currentUser } from '@/lib/auth-server';
import { privateApi } from '@/lib/private-api';
import { OperationsPanel } from '@/features/admin/operations-panel';
export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  if ((await currentUser()).role !== 'ADMIN') notFound();
  const input = await searchParams;
  const page = Math.max(1, Math.min(10000, Number.parseInt(input.page ?? '1') || 1));
  const [orders, jobs] = await Promise.all([
    privateApi(`admin/orders?page=${page}&limit=20`),
    privateApi('admin/jobs'),
  ]);
  return (
    <section className="py-12">
      <h1 className="mb-8 text-3xl font-semibold">Order operations</h1>
      <OperationsPanel orders={orders.items} jobs={jobs} />
      <nav aria-label="Admin order pages" className="mt-8 flex gap-6">
        {page > 1 && <Link href={`/admin/operations?page=${page - 1}`}>Previous</Link>}
        {page * 20 < orders.total && <Link href={`/admin/operations?page=${page + 1}`}>Next</Link>}
      </nav>
    </section>
  );
}
