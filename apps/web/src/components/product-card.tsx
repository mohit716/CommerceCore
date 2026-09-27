import Image from 'next/image';
import Link from 'next/link';
import { formatPrice, type Product } from '@/lib/catalog';

export function ProductCard({ product }: { product: Product }) {
  const image = product.images[0];
  return (
    <article className="group overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
      <Link
        href={`/products/${product.slug}`}
        className="block focus-visible:outline-2 focus-visible:outline-teal-300"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-slate-800">
          <Image
            src={image?.url ?? '/images/product-placeholder.svg'}
            alt={image?.alt ?? product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition duration-300 group-hover:scale-105"
          />
        </div>
        <div className="p-5">
          <p className="text-xs font-medium tracking-widest text-teal-300 uppercase">
            {product.category.name}
          </p>
          <h2 className="mt-2 text-lg font-semibold">{product.name}</h2>
          <div className="mt-5 flex items-center justify-between gap-3">
            <span className="font-medium">{formatPrice(product.priceMinor, product.currency)}</span>
            <span className="text-xs text-slate-400">
              {product.available ? 'In stock' : 'Out of stock'}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
