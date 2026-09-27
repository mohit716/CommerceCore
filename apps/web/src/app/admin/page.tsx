import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { currentUser } from '@/lib/auth-server';
import { catalogRequest, type Category } from '@/lib/catalog';
import { AdminPanel, type AdminProduct } from '@/features/admin/admin-panel';

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await currentUser();
  if (user.role !== 'ADMIN') notFound();
  const params = await searchParams;
  const page = Math.max(1, Math.min(10000, Number.parseInt(params.page ?? '1', 10) || 1));
  const base = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';
  const response = await fetch(`${base}/api/v1/admin/products?page=${page}&limit=24`, {
    headers: { Cookie: (await cookies()).toString() },
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('Unable to load admin catalog.');
  const data = (await response.json()) as {
    items: AdminProduct[];
    total: number;
    totalPages: number;
  };
  const categories = await catalogRequest<Category[]>('categories');
  return (
    <section className="py-12">
      <p className="text-sm text-teal-300">Store operations</p>
      <Link href="/admin/operations" className="mt-3 inline-block text-teal-300 underline">
        Orders and background jobs
      </Link>
      <h1 className="mt-3 mb-8 text-4xl font-semibold">Catalog management</h1>
      <AdminPanel products={data.items} categories={categories} />
      <nav aria-label="Admin pagination" className="mt-8 flex justify-center gap-6">
        {page > 1 && (
          <Link href={`/admin?page=${page - 1}`} className="text-teal-300 underline">
            Previous
          </Link>
        )}
        <span>
          {data.total} products · Page {page}
        </span>
        {page < data.totalPages && (
          <Link href={`/admin?page=${page + 1}`} className="text-teal-300 underline">
            Next
          </Link>
        )}
      </nav>
    </section>
  );
}
