'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export function AuthForm({ signup = false }: { signup?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch(`/api/backend/auth/${signup ? 'signup' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(
          Array.isArray(body.message)
            ? body.message.join(' ')
            : (body.message ?? 'Unable to sign in.'),
        );
      }
      router.push('/account');
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mx-auto max-w-md py-16">
      <h1 className="text-3xl font-semibold">{signup ? 'Create your account' : 'Welcome back'}</h1>
      <p className="mt-3 text-slate-400">Your essentials, all in one place.</p>
      <form onSubmit={submit} className="mt-8 space-y-5">
        {signup && (
          <label className="block text-sm">
            Name
            <input
              name="name"
              autoComplete="name"
              required
              maxLength={100}
              className="field mt-2"
            />
          </label>
        )}
        <label className="block text-sm">
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            className="field mt-2"
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            name="password"
            type="password"
            autoComplete={signup ? 'new-password' : 'current-password'}
            required
            minLength={12}
            maxLength={128}
            aria-describedby="password-help"
            className="field mt-2"
          />
        </label>
        <p id="password-help" className="text-xs text-slate-400">
          Use at least 12 characters.
        </p>
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-200"
          >
            {error}
          </p>
        )}
        <button disabled={busy} className="button w-full">
          {busy ? 'Please wait...' : signup ? 'Create account' : 'Sign in'}
        </button>
      </form>
      <p className="mt-6 text-sm text-slate-400">
        {signup ? 'Already have an account? ' : 'New here? '}
        <Link href={signup ? '/login' : '/signup'} className="text-teal-300 underline">
          {signup ? 'Sign in' : 'Create an account'}
        </Link>
      </p>
    </section>
  );
}
