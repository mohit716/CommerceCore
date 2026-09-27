import { currentUser } from '@/lib/auth-server';
import { LogoutButton } from '@/features/auth/logout-button';
import Link from 'next/link';
export default async function AccountPage() {
  const user = await currentUser();
  return (
    <section className="mx-auto max-w-2xl py-16">
      <p className="text-sm text-teal-300">Your account</p>
      <h1 className="mt-3 text-4xl font-semibold">Welcome, {user.name}</h1>
      <p className="mt-4 text-slate-400">{user.email}</p>
      {user.role === 'ADMIN' && (
        <Link href="/admin" className="mt-5 inline-block text-teal-300 underline">
          Manage store
        </Link>
      )}
      <div className="mt-8">
        <LogoutButton />
      </div>
    </section>
  );
}
