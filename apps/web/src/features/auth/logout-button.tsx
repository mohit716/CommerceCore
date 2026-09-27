'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authenticatedMutation } from '@/lib/auth-client';

export function LogoutButton() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    setError('');
    try {
      await authenticatedMutation('auth/logout', 'POST');
      router.push('/login');
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button onClick={logout} disabled={busy} className="button">
        {busy ? 'Signing out...' : 'Sign out'}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
