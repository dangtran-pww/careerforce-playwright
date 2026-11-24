import { useEffect, useState } from 'react';

// Reloads a plan: its plan file and where its tests are, for watching a plan
// or one of its cases change while it's being worked on.
export interface Refresh {
  onRefresh: () => void;
  refreshing: boolean; // a reload is in flight
  failed?: boolean; // the last reload failed (no tick then)
}

// A quiet icon button that reloads `what` (a case's ID, a plan's name). The
// arrow turns while it reloads, then a tick shows for a moment, so a reload
// that found nothing new still says it happened. `className` places it: a
// case row's (case-refresh) or the plan panel's header.
export function RefreshButton({
  refresh,
  what,
  className,
}: {
  refresh: Refresh;
  what: string;
  className?: string;
}) {
  // This button was pressed (not another one on the page): it shows the tick.
  const [pressed, setPressed] = useState(false);
  const done = pressed && !refresh.refreshing && !refresh.failed;
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setPressed(false), 1500);
    return () => clearTimeout(t);
  }, [done]);

  const label = refresh.refreshing
    ? `Refreshing ${what}…`
    : done
      ? `${what} is up to date`
      : `Refresh ${what}: read the plan file and its tests again`;
  return (
    <>
      <button
        type="button"
        className={['ghost refresh-button', className]
          .filter(Boolean)
          .join(' ')}
        aria-label={label}
        title={label}
        aria-busy={refresh.refreshing}
        disabled={refresh.refreshing}
        onClick={() => {
          setPressed(true);
          refresh.onRefresh();
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {done ? (
            <path d="M20 6 9 17l-5-5" />
          ) : (
            <>
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </>
          )}
        </svg>
      </button>
      <span className="visually-hidden" role="status">
        {done ? `${what} refreshed` : ''}
      </span>
    </>
  );
}
