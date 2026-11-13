import type { ReactNode } from 'react';
import type { PlanSummary } from '../api/types';
import { useStartRun } from '../hooks/useStartRun';
import { AsyncButton } from './AsyncButton';

interface Props {
  plan: PlanSummary;
  // What to run; leave out for the plan's default projects and all cases.
  body?: {
    projects?: string[];
    cases?: string[];
    headed?: boolean;
    suite?: string; // the suite page it's started from
  };
  disabled?: boolean;
  title?: string;
  className?: string;
  busyLabel?: string; // shown while the server checks logins and starts it
  // A refused start, e.g. a 409 when a login isn't ready. Without it the
  // reason shows in an alert.
  onError?: (err: Error) => void;
  children: ReactNode;
}

// Starts a run of a plan on the current environment. On production the
// server leaves out the plan's no-prod cases. The server checks every login
// the run needs first and refuses to start when one isn't ready.
export function PlanRunButton({
  plan,
  body = {},
  onError,
  children,
  ...props
}: Props) {
  const start = useStartRun(onError);
  return (
    <AsyncButton
      {...props}
      onClick={() => start(`/api/plans/${plan.slug}/run`, body)}
    >
      {children}
    </AsyncButton>
  );
}
