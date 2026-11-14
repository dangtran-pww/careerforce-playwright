import { useLoginsPanel } from '../hooks/useLogins';

// The note beside a Run button saying which roles the run logs in as, with
// a link that opens the header's Login Sessions panel to check them. The
// server checks them again before it starts the run.
export function LoginsNote({
  roles,
  none = 'Needs no login.',
}: {
  roles: string[];
  none?: string; // said when the run needs no login
}) {
  const { openPanel } = useLoginsPanel();
  if (!roles.length) return <p className="note small">{none}</p>;
  return (
    <p className="note small">
      Logs in as {roles.join(', ')}. The logins are checked before the run
      starts.{' '}
      <button type="button" className="link" onClick={openPanel}>
        Check the login sessions
      </button>
    </p>
  );
}
