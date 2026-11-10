// Calls the dashboard server's JSON API (dashboard/server/index.mjs).
// Throws an ApiError with the server's message when the answer isn't 2xx.

// `data` is the whole error body, e.g. { error, logins } when a suite run
// is refused because a login isn't ready.
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly data: Record<string, unknown>,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: options.body ? { 'content-type': 'application/json' } : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new ApiError(data.error ?? `HTTP ${res.status}`, res.status, data);
  return data as T;
}

// POST a JSON body.
export const post = <T>(path: string, body: unknown = {}) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(body) });
