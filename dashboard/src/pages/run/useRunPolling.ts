import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { Run, RunWithLog } from '../../api/types';

// How often to ask for new output while the run is going.
const POLL_MS = 1500;

// Loads a run, then keeps asking for its new output every POLL_MS while it
// runs. `log` is all the output so far. `error` is set only when the first
// request fails; later failures are retried more slowly.
export function useRunPolling(id: string) {
  const [run, setRun] = useState<Run | null>(null);
  const [log, setLog] = useState('');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let gone = false; // the page was left
    let logLength = 0; // characters of output received so far
    let loaded = false;
    let lastRun = ''; // the last run, as JSON, to skip unchanged answers

    async function poll() {
      try {
        const {
          log: chunk,
          logLength: length,
          ...next
        } = await api<RunWithLog>(`/api/runs/${id}?logFrom=${logLength}`);
        if (gone) return;
        loaded = true;
        logLength = length;
        if (chunk) setLog((l) => l + chunk);
        // Most polls change only the output. Keeping the same object then
        // lets the memoized results skip re-rendering.
        const json = JSON.stringify(next);
        if (json !== lastRun) {
          lastRun = json;
          setRun(next);
        }
        if (next.status === 'running') timer = setTimeout(poll, POLL_MS);
      } catch (err) {
        if (gone) return;
        if (!loaded) setError(err as Error);
        else timer = setTimeout(poll, POLL_MS * 2);
      }
    }

    poll();
    return () => {
      gone = true;
      clearTimeout(timer);
    };
  }, [id]);

  return { run, log, error };
}
