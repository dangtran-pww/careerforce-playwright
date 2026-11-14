import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';

interface Result<T> {
  key: string; // which request this answers
  data?: T;
  error?: Error;
}

// GET `path` from the dashboard API.
//
//   const { data, error, loading, reload } = useApi<PlansResponse>('/api/plans');
//
// `data` keeps the last answer while a reload is in flight, so the page
// doesn't flash empty. Pages are remounted when the route or environment
// changes (see App.tsx), so `path` rarely changes within one mount.
export function useApi<T>(path: string) {
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<Result<T>>({ key: '' });
  const key = `${path}#${nonce}`;
  // Stable, so callers can list it in an effect's dependencies.
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    api<T>(path).then(
      (data) => !cancelled && setResult({ key, data }),
      (error: Error) =>
        !cancelled && setResult((prev) => ({ ...prev, key, error })),
    );
    return () => {
      cancelled = true;
    };
  }, [path, key]);

  return {
    data: result.data,
    error: result.key === key ? result.error : undefined,
    loading: result.key !== key,
    reload,
  };
}
