'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="py-20">
      <h1 className="text-3xl font-semibold">Something went wrong</h1>
      <p className="mt-4 text-slate-400">Please try again in a moment.</p>
      <button onClick={reset} className="button mt-6">
        Try again
      </button>
    </section>
  );
}
