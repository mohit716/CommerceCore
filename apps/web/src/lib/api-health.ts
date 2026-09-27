export async function getApiHealth(
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  try {
    const response = await fetcher(new URL('/api/v1/health/ready', baseUrl), {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return Response.json({ status: 'unavailable' }, { status: 503 });
    }
    return Response.json({ status: 'ok' });
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503 });
  }
}
