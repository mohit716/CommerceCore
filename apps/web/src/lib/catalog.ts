export interface Category {
  id: string;
  slug: string;
  name: string;
  description?: string;
}
export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  priceMinor: number;
  currency: string;
  available: boolean;
  category: Category;
  images: { id: string; url: string; alt: string; sortOrder: number }[];
}
export interface ProductPage {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`API returned ${status}`);
    this.status = status;
  }
}
export async function catalogRequest<T>(path: string): Promise<T> {
  const base = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';
  const response = await fetch(`${base}/api/v1/${path}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new ApiError(response.status);
  return response.json() as Promise<T>;
}
export function formatPrice(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount / 100);
}
const catalogKeys = new Set(['search', 'category', 'minPrice', 'maxPrice', 'sort', 'page']);
export function catalogParams(input: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (catalogKeys.has(key) && typeof value === 'string' && value) query.set(key, value);
  }
  query.set('limit', '12');
  return query;
}
