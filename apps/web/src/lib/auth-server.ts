import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: 'CUSTOMER' | 'ADMIN';
}
export async function currentUser(): Promise<CurrentUser> {
  const base = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';
  const response = await fetch(`${base}/api/v1/auth/me`, {
    headers: { Cookie: (await cookies()).toString() },
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });
  if (response.status === 401) redirect('/login');
  if (!response.ok) throw new Error('Unable to load your account.');
  return response.json() as Promise<CurrentUser>;
}
