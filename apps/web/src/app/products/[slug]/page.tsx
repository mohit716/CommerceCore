import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AddToCart } from '@/features/cart/add-to-cart';
import { ApiError, catalogRequest, formatPrice, type Product } from '@/lib/catalog';

export const dynamic = 'force-dynamic';
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let product: Product;
  try {
    product = await catalogRequest<Product>(`products/${encodeURIComponent(slug)}`);
  } catch (error) {
    if (error instanceof ApiError && [400, 404].includes(error.status)) notFound();
    throw error;
  }
  const image = product.images[0];
  return (
    <section className="py-10">
      <Link href="/" className="text-sm text-teal-300 underline">
        Back to catalog
      </Link>
      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-slate-800">
          <Image
            src={image?.url ?? '/images/product-placeholder.svg'}
            alt={image?.alt ?? product.name}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
            className="object-cover"
          />
        </div>
        <div className="py-6">
          <Link href={`/?category=${product.category.slug}`} className="text-sm text-teal-300">
            {product.category.name}
          </Link>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">{product.name}</h1>
          <p className="mt-6 text-2xl">{formatPrice(product.priceMinor, product.currency)}</p>
          <p className="mt-6 whitespace-pre-line leading-8 text-slate-300">{product.description}</p>
          <p className="mt-8 rounded-lg border border-slate-700 p-4 text-sm">
            {product.available ? 'Available' : 'Currently out of stock'}
          </p>
          <AddToCart productId={product.id} available={product.available} />
        </div>
      </div>
    </section>
  );
}
