import type { ReactNode } from 'react';
import { useEnv } from '../hooks/useEnv';
import { useRunGate } from '../hooks/useRerun';
import { useStartRun } from '../hooks/useStartRun';
import { AsyncButton } from './AsyncButton';

interface Props {
  planSlug: string | undefined;
  // What to run; cases left out runs all of them.
  body: {
    projects?: string[];
    cases?: string[];
    headed?: boolean;
    a11y?: boolean;
  };
  className?: string;
  // The label; "on <environment>" is added after it.
  children: ReactNode;
}

// Runs a plan, or some of its cases, again on the environment picked in the
// header. Disabled while any run is going, and on production when everything
// it would run is no-prod (useRunGate).
export function RerunButton({ planSlug, body, className, children }: Props) {
  const { currentEnv } = useEnv();
  const gate = useRunGate(planSlug, body.cases);
  const start = useStartRun();
  if (!gate) return null;

  return (
    <AsyncButton
      className={className}
      disabled={Boolean(gate.blocked)}
      title={gate.blocked ?? `Run on ${gate.where}`}
      onClick={() =>
        start(`/api/plans/${gate.plan.slug}/run`, {
          ...body,
          ...(gate.suite ? { suite: gate.suite } : {}),
        })
      }
    >
      {children} on {currentEnv.name}
    </AsyncButton>
  );
}
