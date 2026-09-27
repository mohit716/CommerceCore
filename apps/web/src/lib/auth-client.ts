export async function authenticatedMutation(
  path: string,
  method: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
) {
  const csrfResponse = await fetch('/api/backend/auth/csrf', { cache: 'no-store' });
  if (!csrfResponse.ok) throw new Error('Please sign in again.');
  const { csrfToken } = await csrfResponse.json();
  const response = await fetch(`/api/backend/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken, ...extraHeaders },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      Array.isArray(error.message) ? error.message.join(' ') : (error.message ?? 'Request failed.'),
    );
  }
  return response;
}
