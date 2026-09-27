import type { NextRequest } from 'next/server';

const allowedRoots = new Set([
  'auth',
  'users',
  'admin',
  'cart',
  'checkout',
  'orders',
  'products',
  'categories',
]);
async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (!allowedRoots.has(path[0] ?? '') || path.some((part) => part === '.' || part === '..'))
    return Response.json({ message: 'Not found.' }, { status: 404 });
  const base = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';
  const headers = new Headers();
  for (const name of ['content-type', 'cookie', 'origin', 'x-csrf-token', 'idempotency-key']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text();
    if (body && Buffer.byteLength(body) > 100000)
      return Response.json({ message: 'Request too large.' }, { status: 413 });
    const upstream = await fetch(
      `${base}/api/v1/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`,
      {
        method: request.method,
        headers,
        body,
        redirect: 'manual',
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      },
    );
    const responseHeaders = new Headers({
      'Cache-Control': 'no-store',
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
    });
    for (const cookie of upstream.headers.getSetCookie())
      responseHeaders.append('Set-Cookie', cookie);
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return Response.json(
      { code: 'UNAVAILABLE', message: 'Service temporarily unavailable.' },
      { status: 503 },
    );
  }
}
export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
