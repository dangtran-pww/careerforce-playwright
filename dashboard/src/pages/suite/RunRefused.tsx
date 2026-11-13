import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../api/client';
import type { Session } from '../../api/types';
import { Badge } from '../../components/Badge';
import { Command } from '../../components/Command';
import { useLoginsPanel } from '../../hooks/useLogins';
import { SESSION_STATUS } from '../../lib/status';

export interface Refusal {
  message: string;
  logins: Session[]; // the logins that aren't ready; empty for other reasons
}

// For a page with Run buttons: `onError` keeps why the server refused to
// start a run, and when logins stopped it, checks them again and opens the
// header's Login sessions panel on them. `clear` forgets it.
export function useRunRefusal() {
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const { openPanel, recheck } = useLoginsPanel();
  const onError = useCallback(
    (err: Error) => {
      const logins =
        err instanceof ApiError && Array.isArray(err.data.logins)
          ? (err.data.logins as Session[])
          : [];
      setRefusal({ message: err.message, logins });
      if (logins.length) {
        recheck();
        openPanel();
      }
    },
    [openPanel, recheck],
  );
  const clear = useCallback(() => setRefusal(null), []);
  return { refusal, onError, clear };
}

// Why the server didn't start the run. One bad login is already named
// in the message, so that alone is shown. When several stopped it, each one
// is listed with what's wrong and the command to log in again.
export function RunRefused({ refusal }: { refusal: Refusal }) {
  const listLogins = refusal.logins.length > 1;
  // Brought into view, since the Run button pressed can be far above it
  // (a case's Run in the plan panel).
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest' });
  }, [refusal]);
  return (
    <div ref={ref} className="callout callout-bad run-refused" role="alert">
      <p>{refusal.message}</p>
      {listLogins && (
        <ul>
          {refusal.logins.map((s) => (
            <li key={s.role}>
              <strong>{s.role}</strong>{' '}
              <Badge map={SESSION_STATUS} value={s.status} />
              {s.message && <> {s.message}</>}
              {s.loginCommand && s.status !== 'error' && (
                <Command text={s.loginCommand} />
              )}
            </li>
          ))}
        </ul>
      )}
      {listLogins && (
        <p className="small">
          Log in, then press Run again. The run checks every login first.
        </p>
      )}
    </div>
  );
}
