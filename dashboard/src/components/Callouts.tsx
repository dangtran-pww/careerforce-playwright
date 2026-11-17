import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useEnv } from '../hooks/useEnv';

export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <p className="callout callout-bad" role="alert">
      {children}
    </p>
  );
}

export function Loading({ children = 'Loading…' }: { children?: ReactNode }) {
  return <p className="note">{children}</p>;
}

// Shown on pages with Run buttons while a run is going on the environment
// picked in the header. Runs on other environments don't block these buttons.
export function ActiveRunBanner({ runId }: { runId: string | null }) {
  const { currentEnv } = useEnv();
  if (!runId) return null;
  return (
    <p className="callout">
      A test run is in progress on {currentEnv.name}. Only one runs at a time on
      each environment. <Link to={`/runs/${runId}`}>Watch it</Link>
    </p>
  );
}
