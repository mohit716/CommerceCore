import 'server-only';
import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
export async function privateApi(path: string) {
  const response = await fetch(
    `${process.env.API_INTERNAL_URL ?? 'http://localhost:3001'}/api/v1/${path}`,
    {
      headers: { Cookie: (await cookies()).toString() },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    },
  );
  if (response.status === 401) redirect('/login');
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error('Unable to load account data.');
  return response.json();
}
