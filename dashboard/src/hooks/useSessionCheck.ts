import { useCallback, useEffect, useState } from 'react';
import type { Env, Session } from '../api/types';

// Re-check when the tab comes back into view, if the last check is older
// than this. Each check is one request to the site.
const RECHECK_AFTER_MS = 5 * 60 * 1000;

// Whether the saved login session for a role still works on an environment.
// Asks the server on mount, when asked again, and when the tab comes back
// into view after a while. While re-checking, `session` keeps the last
// answer so its details stay on screen.
export function useSessionCheck(role: string, env: Env) {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [round, setRound] = useState(0); // bumped to check again

  useEffect(() => {
    let cancelled = false;
    fetchSession(role, env.id).then((next) => {
      if (cancelled) return;
      console.info(`[session] ${role} on ${env.id}:`, next);
      setSession(next);
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [role, env.id, round]);

  const check = useCallback(() => {
    setChecking(true);
    setRound((r) => r + 1);
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !session) return;
      if (Date.now() - new Date(session.checkedAt).getTime() > RECHECK_AFTER_MS)
        check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [session, check]);

  return { session, checking, check };
}

// Never throws: a failed request becomes an "error" session with the reason.
async function fetchSession(role: string, envId: string): Promise<Session> {
  try {
    const res = await fetch(`/api/sessions/${role}?env=${envId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return {
      role,
      status: 'error',
      checkedAt: new Date().toISOString(),
      message: `The dashboard server didn't answer (${(err as Error).message}). Is npm run dashboard still running?`,
    };
  }
}
