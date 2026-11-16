import { useId, useState } from 'react';
import { useEnv } from '../hooks/useEnv';
import { useSessionCheck } from '../hooks/useSessionCheck';
import { SESSION_STATUS } from '../lib/status';
import { Command } from './Command';
import { Facts } from './Facts';
import { TimeAgo } from './TimeAgo';

const NEEDS_LOGIN = ['expired', 'missing', 'no-access'];

// One role's saved login session on the current environment, as a compact
// row in the header's Login Sessions panel (LoginsMenu.tsx):
//
//   ▸  [Valid]      Job Seeker   jobseeker@example.com          ↻
//   ▸  [Not saved]  Partner      npm run login:manual -- partner ⧉  ↻
//
// The row shows the account's email when the session works, or the command
// to log in when it doesn't. ▸ opens the rest: the site's message, profile
// type, roles, and when it was checked and saved. Its cells sit in the
// panel's grid (subgrid), so the columns line up from row to row.
export function SessionRow({ role }: { role: string }) {
  const { currentEnv } = useEnv();
  const { session, checking, check } = useSessionCheck(role, currentEnv);
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const label = roleLabel(role);

  const status =
    SESSION_STATUS[checking ? 'checking' : session!.status] ??
    SESSION_STATUS.error;
  const needsLogin =
    session && NEEDS_LOGIN.includes(session.status) && session.loginCommand;

  return (
    <div className="session-row">
      <button
        type="button"
        className="row-toggle"
        aria-expanded={open}
        aria-controls={detailsId}
        aria-label={`${label} details`}
        title={open ? 'Hide details' : 'Show details'}
        onClick={() => setOpen((o) => !o)}
        disabled={!session}
      >
        <span aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>
      {/* Announced when a check ends; names the role, which comes after. */}
      <span
        className={`badge badge-${status.tone} session-badge`}
        role="status"
      >
        <span className="visually-hidden">{label}: </span>
        {status.label}
      </span>
      <span className="session-role">{label}</span>
      <span className="session-main">
        {needsLogin ? (
          <Command text={session.loginCommand!} />
        ) : (
          <span className="note" title={session?.message}>
            {session?.email ?? session?.message}
          </span>
        )}
      </span>
      <button
        type="button"
        className="icon-button"
        onClick={check}
        disabled={checking}
        aria-label={`Check ${label} again`}
        title={checking ? 'Checking…' : 'Check again'}
      >
        <RefreshIcon />
      </button>
      {open && session && (
        <div id={detailsId} className="session-details">
          {session.message && <p>{session.message}</p>}
          {session.detailsNote && (
            <p className="note small">{session.detailsNote}</p>
          )}
          <Facts
            items={[
              session.email && ['Logged in as', session.email],
              session.profileType !== undefined && [
                'Profile type',
                session.profileType || 'None',
              ],
              session.roles && [
                'Roles',
                session.roles.length
                  ? session.roles.join(', ')
                  : 'Authenticated user',
              ],
              ['Checked', <TimeAgo iso={session.checkedAt} />],
              ['Session saved', <TimeAgo iso={session.savedAt} />],
            ]}
          />
        </div>
      )}
    </div>
  );
}

// Roles whose id doesn't read well as a name.
const ROLE_LABELS: Record<string, string> = { jobseeker: 'Job Seeker' };

// "platform-manager" → "Platform manager", "jobseeker" → "Job Seeker".
function roleLabel(role: string) {
  if (ROLE_LABELS[role]) return ROLE_LABELS[role];
  const words = role.replace(/-/g, ' ');
  return words[0].toUpperCase() + words.slice(1);
}

// A circular arrow, in the text colour.
export function RefreshIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}
