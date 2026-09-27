import Link from 'next/link';
import { ProductCard } from '@/components/product-card';
import {
  ApiError,
  catalogParams,
  catalogRequest,
  type Category,
  type ProductPage,
} from '@/lib/catalog';

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = catalogParams(await searchParams);
  let catalog: ProductPage;
  let categories: Category[];
  try {
    [catalog, categories] = await Promise.all([
      catalogRequest<ProductPage>(`products?${params}`),
      catalogRequest<Category[]>('categories'),
    ]);
  } catch (error) {
    return (
      <section className="py-20">
        <h1 className="text-3xl font-semibold">
          {error instanceof ApiError && error.status === 400
            ? 'Check your filters'
            : 'The catalog is temporarily unavailable'}
        </h1>
        <p className="mt-4 text-slate-400">Please clear the filters or try again shortly.</p>
        <Link href="/" className="mt-6 inline-block text-teal-300 underline">
          Return to the catalog
        </Link>
      </section>
    );
  }
  const pageLink = (page: number) => {
    const next = new URLSearchParams(params);
    next.set('page', String(page));
    return `/?${next}`;
  };
  return (
    <>
      <section className="border-b border-slate-800 py-14 sm:py-20">
        <p className="text-sm font-medium tracking-widest text-teal-300 uppercase">
          Considered essentials
        </p>
        <h1 className="mt-5 max-w-3xl text-5xl font-semibold tracking-tight sm:text-7xl">
          Make room for
          <br />
          better everyday.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-slate-400">
          Thoughtful tools for your desk, your space, and everything in between.
        </p>
      </section>
      <section aria-label="Product catalog" className="py-10">
        <form
          action="/"
          className="grid gap-4 rounded-xl border border-slate-800 bg-slate-900/40 p-5 sm:grid-cols-2 lg:grid-cols-6"
        >
          <label className="text-sm lg:col-span-2">
            Search
            <input
              name="search"
              defaultValue={params.get('search') ?? ''}
              maxLength={120}
              placeholder="Find your next essential"
              className="field mt-2"
            />
          </label>
          <label className="text-sm">
            Category
            <select
              name="category"
              defaultValue={params.get('category') ?? ''}
              className="field mt-2"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Min price (cents)
            <input
              type="number"
              min="0"
              step="1"
              name="minPrice"
              defaultValue={params.get('minPrice') ?? ''}
              className="field mt-2"
            />
          </label>
          <label className="text-sm">
            Max price (cents)
            <input
              type="number"
              min="0"
              step="1"
              name="maxPrice"
              defaultValue={params.get('maxPrice') ?? ''}
              className="field mt-2"
            />
          </label>
          <label className="text-sm">
            Sort
            <select
              name="sort"
              defaultValue={params.get('sort') ?? 'newest'}
              className="field mt-2"
            >
              <option value="newest">Newest</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="name_asc">Name</option>
            </select>
          </label>
          <div className="flex items-center gap-5 sm:col-span-2 lg:col-span-6">
            <button className="button" type="submit">
              Apply filters
            </button>
            <Link href="/" className="text-sm text-slate-300 underline">
              Clear filters
            </Link>
          </div>
        </form>
        <p className="my-7 text-sm text-slate-400">
          {catalog.total} {catalog.total === 1 ? 'product' : 'products'}
        </p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
        {catalog.items.length === 0 && (
          <p className="rounded-xl border border-slate-800 p-12 text-center text-slate-400">
            No products match these filters. Try a broader search.
          </p>
        )}
        <nav
          aria-label="Catalog pagination"
          className="mt-10 flex items-center justify-center gap-6"
        >
          {catalog.page > 1 && (
            <Link href={pageLink(catalog.page - 1)} className="text-teal-300 underline">
              Previous
            </Link>
          )}
          <span className="text-sm text-slate-400">
            Page {catalog.page} of {Math.max(1, catalog.totalPages)}
          </span>
          {catalog.page < catalog.totalPages && (
            <Link href={pageLink(catalog.page + 1)} className="text-teal-300 underline">
              Next
            </Link>
          )}
        </nav>
      </section>
    </>
  );
}
