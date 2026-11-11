import { useCallback, useEffect, useId, useState } from 'react';
import type { Env, Session } from '../api/types';
import { useEnv } from '../hooks/useEnv';
import { SESSION_STATUS } from '../lib/status';
import { Command } from './Command';
import { EnvTag } from './EnvTag';
import { Facts } from './Facts';
import { TimeAgo } from './TimeAgo';

// Re-check when the tab comes back into view, if the last check is older
// than this. Each check is one request to the site.
const RECHECK_AFTER_MS = 5 * 60 * 1000;

const NEEDS_LOGIN = ['expired', 'missing', 'no-access'];

// Whether the saved login session for a role still works on an environment
// (the current one by default), with the command to log in again when it
// doesn't.
// `headingLevel` is lower where the card sits under other headings (the
// header's Login Sessions panel).
export function SessionCard({
  role,
  env,
  headingLevel = 2,
}: {
  role: string;
  env?: Env;
  headingLevel?: 2 | 3 | 4;
}) {
  const { currentEnv } = useEnv();
  const target = env ?? currentEnv;
  const { session, checking, check } = useSessionCheck(role, target);

  const status =
    SESSION_STATUS[checking ? 'checking' : session!.status] ??
    SESSION_STATUS.error;
  // The same role can show twice at once (a page and the Logins menu).
  const headingId = useId();
  const Heading = `h${headingLevel}` as const;

  return (
    <section className="card" aria-labelledby={headingId}>
      <div className="card-head">
        <Heading id={headingId}>
          {roleLabel(role)} session <EnvTag env={target} />
        </Heading>
        <span className={`badge badge-${status.tone}`} role="status">
          {status.label}
        </span>
      </div>
      {session?.message && !checking && (
        <p className="message">{session.message}</p>
      )}
      {session &&
        NEEDS_LOGIN.includes(session.status) &&
        session.loginCommand && (
          <div className="fix">
            <p>Log in again by hand, then check again:</p>
            <Command text={session.loginCommand} />
          </div>
        )}
      {session?.checkedAt && (
        <Facts
          items={[
            session.email && ['Logged in as', session.email],
            ['Checked', <TimeAgo iso={session.checkedAt} />],
            ['Session saved', <TimeAgo iso={session.savedAt} />],
          ]}
        />
      )}
      <div className="actions">
        <button type="button" onClick={check} disabled={checking}>
          {checking ? 'Checking…' : 'Check again'}
        </button>
      </div>
    </section>
  );
}

// "platform-manager" → "Platform manager".
function roleLabel(role: string) {
  const words = role.replace(/-/g, ' ');
  return words[0].toUpperCase() + words.slice(1);
}

// Asks the server on mount, when asked again, and when the tab comes back
// into view after a while. While re-checking, `session` keeps the last
// answer so its details stay on screen.
function useSessionCheck(role: string, env: Env) {
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
