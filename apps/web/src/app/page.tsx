export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-20">
      <p className="mb-6 text-sm font-semibold tracking-widest text-teal-300 uppercase">
        CommerceCore / Phase 01
      </p>
      <h1 className="text-5xl font-semibold tracking-tight sm:text-7xl">
        Built on a solid foundation.
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-400">
        A modular ecommerce application, starting with a typed web experience, an independent API,
        and a reproducible local environment.
      </p>
      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        {[
          ['Web', 'Next.js · React · Tailwind'],
          ['API', 'NestJS · TypeScript'],
          ['Infrastructure', 'PostgreSQL · Redis · Mailpit'],
        ].map(([label, detail]) => (
          <div key={label} className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
            <h2 className="font-medium">{label}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
          </div>
        ))}
      </div>
      <a
        href="/api/health"
        className="mt-10 w-fit rounded-lg bg-teal-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-teal-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-300"
      >
        Check API readiness <span aria-hidden="true">↗</span>
      </a>
      <p className="mt-4 text-sm text-slate-500">
        Readiness checks the API, PostgreSQL, and Redis.
      </p>
    </main>
  );
}
