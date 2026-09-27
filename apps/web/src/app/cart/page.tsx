import { cookies } from 'next/headers';
import { currentUser } from '@/lib/auth-server';
import { CartView } from '@/features/cart/cart-view';
export default async function CartPage() {
  await currentUser();
  const response = await fetch(
    `${process.env.API_INTERNAL_URL ?? 'http://localhost:3001'}/api/v1/cart`,
    {
      headers: { Cookie: (await cookies()).toString() },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    },
  );
  if (!response.ok) throw new Error('Unable to load cart.');
  return (
    <section className="py-12">
      <h1 className="mb-8 text-4xl font-semibold">Your cart</h1>
      <CartView initial={await response.json()} />
    </section>
  );
}
