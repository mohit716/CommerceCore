'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authenticatedMutation } from '@/lib/auth-client';
import { formatPrice, type Category, type Product } from '@/lib/catalog';

export type AdminProduct = Omit<Product, 'available'> & {
  sku: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  updatedAt: string;
  inventory: { onHand: number; reserved: number } | null;
};
export function AdminPanel({
  products,
  categories,
}: {
  products: AdminProduct[];
  categories: Category[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [movements, setMovements] = useState<
    { id: string; delta: number; reason: string; createdAt: string }[]
  >([]);
  const selected = products.find((product) => product.id === selectedId);
  async function action(work: () => Promise<unknown>) {
    setBusy(true);
    setMessage('');
    try {
      await work();
      setMessage('Saved.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save.');
    } finally {
      setBusy(false);
    }
  }
  function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    void action(async () => {
      await authenticatedMutation(
        selected ? `admin/products/${selected.id}` : 'admin/products',
        selected ? 'PATCH' : 'POST',
        { ...data, priceMinor: Number(data.priceMinor) },
      );
    });
  }
  function adjust(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const data = new FormData(event.currentTarget);
    void action(() =>
      authenticatedMutation(`admin/inventory/${selected.id}/adjustments`, 'POST', {
        delta: Number(data.get('delta')),
        reason: data.get('reason'),
        operationId: crypto.randomUUID(),
      }),
    );
  }
  function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const file = form.get('file');
    void action(async () => {
      if (
        !(file instanceof File) ||
        file.size === 0 ||
        file.size > 5 * 1024 * 1024 ||
        !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
      )
        throw new Error('Choose a JPG, PNG or WebP image under 5 MB.');
      const signed = await (
        await authenticatedMutation('admin/uploads/sign', 'POST', { productId: selected.id })
      ).json();
      const body = new FormData();
      for (const [key, value] of Object.entries(signed.fields)) body.set(key, String(value));
      body.set('file', file);
      const uploaded = await fetch(signed.uploadUrl, { method: 'POST', body });
      if (!uploaded.ok) throw new Error('Upload failed. Check the signed upload preset and retry.');
      await authenticatedMutation(`admin/products/${selected.id}/images`, 'POST', {
        storageKey: signed.fields.public_id,
        alt: form.get('alt'),
      });
    });
  }
  async function loadMovements() {
    if (!selected) return;
    await action(async () => {
      const response = await fetch(
        `/api/backend/admin/inventory/${selected.id}/movements?limit=50`,
        { cache: 'no-store' },
      );
      if (!response.ok) throw new Error('Unable to load stock history.');
      setMovements(await response.json());
    });
  }
  return (
    <div className="space-y-8">
      {message && (
        <p role="status" className="rounded-lg border border-slate-700 p-4 text-sm">
          {message}
        </p>
      )}
      <section className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Manage catalog products</caption>
          <thead className="bg-slate-900 text-slate-300">
            <tr>
              {['Product', 'Status', 'Price', 'Stock / reserved', 'Action'].map((title) => (
                <th key={title} scope="col" className="p-4">
                  {title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-t border-slate-800">
                <td className="p-4">{product.name}</td>
                <td className="p-4">{product.status}</td>
                <td className="p-4">{formatPrice(product.priceMinor)}</td>
                <td className="p-4">
                  {product.inventory?.onHand ?? 0} / {product.inventory?.reserved ?? 0}
                </td>
                <td className="p-4">
                  <button
                    onClick={() => {
                      setSelectedId(product.id);
                      setMovements([]);
                    }}
                    className="text-teal-300 underline"
                    aria-label={`Edit ${product.name}`}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-800 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {selected ? 'Edit product' : 'Create product'}
            </h2>
            {selected && (
              <button
                className="text-sm text-teal-300 underline"
                onClick={() => {
                  setSelectedId('');
                  setMovements([]);
                }}
              >
                New product
              </button>
            )}
          </div>
          <form
            key={`${selected?.id}-${selected?.updatedAt}`}
            onSubmit={saveProduct}
            className="mt-6 space-y-4"
          >
            {(
              [
                ['name', 'Name'],
                ['slug', 'Slug'],
                ['sku', 'SKU'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-sm">
                {label}
                <input
                  name={key}
                  required
                  maxLength={key === 'sku' ? 80 : 160}
                  defaultValue={selected?.[key] ?? ''}
                  className="field mt-2"
                />
              </label>
            ))}
            <label className="block text-sm">
              Description
              <textarea
                name="description"
                required
                maxLength={10000}
                defaultValue={selected?.description ?? ''}
                className="field mt-2"
                rows={4}
              />
            </label>
            <label className="block text-sm">
              Price (USD cents)
              <input
                name="priceMinor"
                type="number"
                min="0"
                max="2147483647"
                step="1"
                required
                defaultValue={selected?.priceMinor ?? 0}
                className="field mt-2"
              />
            </label>
            <label className="block text-sm">
              Category
              <select
                name="categoryId"
                required
                defaultValue={selected?.category.id ?? categories[0]?.id ?? ''}
                className="field mt-2"
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Status
              <select
                name="status"
                defaultValue={selected?.status ?? 'DRAFT'}
                className="field mt-2"
              >
                {['DRAFT', 'ACTIVE', 'ARCHIVED'].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <button disabled={busy || categories.length === 0} className="button">
              Save product
            </button>
            {selected && (
              <button
                type="button"
                disabled={busy}
                className="ml-4 text-sm text-amber-300 underline"
                onClick={() =>
                  void action(() =>
                    authenticatedMutation(`admin/products/${selected.id}`, 'DELETE'),
                  )
                }
              >
                Archive product
              </button>
            )}
          </form>
        </section>
        <div className="space-y-8">
          {selected && (
            <section className="rounded-xl border border-slate-800 p-6">
              <h2 className="text-xl font-semibold">Inventory</h2>
              <p className="mt-3 text-sm text-slate-400">
                {selected.inventory?.onHand ?? 0} on hand, {selected.inventory?.reserved ?? 0}{' '}
                reserved
              </p>
              <form onSubmit={adjust} className="mt-5 space-y-4">
                <label className="block text-sm">
                  Adjustment (+ received / − removed)
                  <input
                    type="number"
                    name="delta"
                    required
                    min="-1000000"
                    max="1000000"
                    step="1"
                    className="field mt-2"
                  />
                </label>
                <label className="block text-sm">
                  Reason
                  <input name="reason" required maxLength={240} className="field mt-2" />
                </label>
                <button disabled={busy} className="button">
                  Record adjustment
                </button>
              </form>
              <button
                onClick={() => void loadMovements()}
                disabled={busy}
                className="mt-5 text-sm text-teal-300 underline"
              >
                Load latest stock history
              </button>
              <ul className="mt-4 space-y-2 text-sm text-slate-300">
                {movements.map((movement) => (
                  <li key={movement.id}>
                    {movement.delta > 0 ? '+' : ''}
                    {movement.delta} · {movement.reason} ·{' '}
                    {new Date(movement.createdAt).toLocaleString()}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {selected && (
            <section className="rounded-xl border border-slate-800 p-6">
              <h2 className="text-xl font-semibold">Product images</h2>
              <form onSubmit={upload} className="mt-5 space-y-4">
                <label className="block text-sm">
                  Image (JPG, PNG, WebP, up to 5 MB)
                  <input
                    type="file"
                    name="file"
                    required
                    accept="image/jpeg,image/png,image/webp"
                    className="field mt-2"
                  />
                </label>
                <label className="block text-sm">
                  Image description
                  <input name="alt" required maxLength={240} className="field mt-2" />
                </label>
                <button disabled={busy} className="button">
                  Upload image
                </button>
              </form>
              <ul className="mt-5 space-y-3 text-sm">
                {selected.images.map((image) => (
                  <li key={image.id} className="flex justify-between gap-4">
                    <span>{image.alt}</span>
                    <button
                      disabled={busy}
                      className="text-amber-300 underline"
                      onClick={() =>
                        void action(() =>
                          authenticatedMutation(
                            `admin/products/${selected.id}/images/${image.id}`,
                            'DELETE',
                          ),
                        )
                      }
                    >
                      Detach
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
      <section className="rounded-xl border border-slate-800 p-6">
        <h2 className="text-xl font-semibold">Categories</h2>
        <div className="mt-5 space-y-4">
          {[...categories, { id: '', name: '', slug: '', description: '' }].map((category) => (
            <form
              key={category.id}
              className="grid items-end gap-3 sm:grid-cols-4"
              onSubmit={(event) => {
                event.preventDefault();
                const data = Object.fromEntries(new FormData(event.currentTarget));
                void action(() =>
                  authenticatedMutation(
                    `admin/categories${category.id ? `/${category.id}` : ''}`,
                    category.id ? 'PATCH' : 'POST',
                    data,
                  ),
                );
              }}
            >
              <label className="text-sm">
                {category.id ? 'Name' : 'New category'}
                <input
                  name="name"
                  required
                  maxLength={120}
                  defaultValue={category.name}
                  className="field mt-2"
                />
              </label>
              <label className="text-sm">
                Slug
                <input
                  name="slug"
                  required
                  maxLength={120}
                  defaultValue={category.slug}
                  className="field mt-2"
                />
              </label>
              <label className="text-sm">
                Description
                <input
                  name="description"
                  maxLength={2000}
                  defaultValue={category.description}
                  className="field mt-2"
                />
              </label>
              <div className="flex gap-4">
                <button disabled={busy} className="button">
                  Save
                </button>
                {category.id && (
                  <button
                    type="button"
                    disabled={busy}
                    className="text-sm text-amber-300 underline"
                    onClick={() =>
                      void action(() =>
                        authenticatedMutation(`admin/categories/${category.id}`, 'DELETE'),
                      )
                    }
                  >
                    Delete
                  </button>
                )}
              </div>
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}
