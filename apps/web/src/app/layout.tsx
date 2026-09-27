import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'CommerceCore | Considered essentials',
  description: 'Thoughtful tools for your desk, your space, and everything in between.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-teal-300 focus:p-3 focus:text-slate-950"
        >
          Skip to content
        </a>
        <header className="border-b border-slate-800">
          <nav
            aria-label="Main navigation"
            className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-6"
          >
            <Link href="/" className="text-xl font-semibold tracking-tight">
              Commerce<span className="text-teal-300">Core</span>
            </Link>
            <Link href="/" className="text-sm text-slate-300">
              Shop essentials
            </Link>
            <Link href="/account" className="text-sm text-teal-300">
              Account
            </Link>
            <Link href="/cart" className="text-sm text-teal-300">
              Cart
            </Link>
            <Link href="/orders" className="text-sm text-teal-300">
              Orders
            </Link>
          </nav>
        </header>
        <main id="main" className="mx-auto max-w-7xl px-6">
          {children}
        </main>
        <footer className="border-t border-slate-800 px-6 py-8 text-center text-sm text-slate-400">
          CommerceCore · A portfolio demonstration store
        </footer>
      </body>
    </html>
  );
}
