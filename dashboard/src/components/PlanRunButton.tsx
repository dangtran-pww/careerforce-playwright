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
  children: ReactNode;
}

// Starts a run of a plan on the current environment. On production the
// server leaves out the plan's no-prod cases.
export function PlanRunButton({ plan, body = {}, children, ...props }: Props) {
  const start = useStartRun();
  return (
    <AsyncButton
      {...props}
      onClick={() => start(`/api/plans/${plan.slug}/run`, body)}
    >
      {children}
    </AsyncButton>
  );
}
