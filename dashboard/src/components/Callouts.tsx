import type { ReactNode } from 'react';
import { Link } from 'react-router';

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

// Shown on pages with Run buttons while another run is going.
export function ActiveRunBanner({ runId }: { runId: string | null }) {
  if (!runId) return null;
  return (
    <p className="callout">
      A test run is in progress. Only one runs at a time.{' '}
      <Link to={`/runs/${runId}`}>Watch it</Link>
    </p>
  );
}
