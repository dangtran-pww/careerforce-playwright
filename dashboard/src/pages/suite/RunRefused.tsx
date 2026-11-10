import type { Session } from '../../api/types';
import { Badge } from '../../components/Badge';
import { Command } from '../../components/Command';
import { SESSION_STATUS } from '../../lib/status';

export interface Refusal {
  message: string;
  logins: Session[]; // the logins that aren't ready; empty for other reasons
}

// Why the server didn't start the suite run. One bad login is already named
// in the message, so that alone is shown. When several stopped it, each one
// is listed with what's wrong and the command to log in again.
export function RunRefused({ refusal }: { refusal: Refusal }) {
  const listLogins = refusal.logins.length > 1;
  return (
    <div className="callout callout-bad run-refused" role="alert">
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
