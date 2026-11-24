import { useEffect, useState } from 'react';

// Reloads a case's plan: its row in the plan file and where its tests are,
// for watching a case change while it's being worked on.
export interface CaseRefresh {
  onRefresh: () => void;
  refreshing: boolean; // a reload is in flight
}

// A quiet icon button for a case's row, beside its Run button. The arrow
// turns while it reloads, then a tick shows for a moment, so a reload that
// found nothing new still says it happened.
export function CaseRefreshButton({
  refresh,
  caseId,
}: {
  refresh: CaseRefresh;
  caseId: string;
}) {
  // This button was pressed (not another case's): it shows the tick.
  const [pressed, setPressed] = useState(false);
  const done = pressed && !refresh.refreshing;
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setPressed(false), 1500);
    return () => clearTimeout(t);
  }, [done]);

  const label = refresh.refreshing
    ? `Refreshing ${caseId}…`
    : done
      ? `${caseId} is up to date`
      : `Refresh ${caseId}: read the plan file and its tests again`;
  return (
    <>
      <button
        type="button"
        className="ghost icon-button case-refresh"
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
        {done ? `${caseId} refreshed` : ''}
      </span>
    </>
  );
}
