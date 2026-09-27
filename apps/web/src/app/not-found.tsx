import Link from 'next/link';
export default function NotFoundPage() {
  return (
    <section className="py-20">
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <Link href="/" className="mt-6 inline-block text-teal-300 underline">
        Explore the catalog
      </Link>
    </section>
  );
}
