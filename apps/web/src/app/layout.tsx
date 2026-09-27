import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CommerceCore | Foundation',
  description: 'The foundation of a modular ecommerce application.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
