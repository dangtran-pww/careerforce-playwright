import type { ReactNode } from 'react';
import { useEnv } from '../hooks/useEnv';
import { useRerun } from '../hooks/useRerun';
import { useStartRun } from '../hooks/useStartRun';
import { hostOf } from '../lib/format';
import { offProdReason } from '../lib/prod';
import { AsyncButton } from './AsyncButton';

interface Props {
  planSlug: string | undefined;
  // What to run; cases left out runs all of them.
  body: { projects?: string[]; cases?: string[]; headed?: boolean };
  className?: string;
  // The label; "on <environment>" is added after it.
  children: ReactNode;
}

// Runs a plan, or some of its cases, again on the environment picked in the
// header. Disabled while any run is going, and on production when everything
// it would run is no-prod.
export function RerunButton({ planSlug, body, className, children }: Props) {
  const { currentEnv } = useEnv();
  const rerun = useRerun();
  const start = useStartRun();
  const plan = rerun?.planBySlug(planSlug);
  if (!rerun || !plan?.runnable) return null;

  const blocked = currentEnv.production
    ? offProdReason(plan, body.cases)
    : null;
  const busy = Boolean(rerun.activeRun);
  return (
    <AsyncButton
      className={className}
      disabled={busy || Boolean(blocked)}
      title={
        busy
          ? 'Another run is in progress'
          : (blocked ??
            `Run on ${currentEnv.name} (${hostOf(currentEnv.baseURL)})`)
      }
      onClick={() =>
        start(`/api/plans/${plan.slug}/run`, {
          ...body,
          ...(rerun.suite ? { suite: rerun.suite } : {}),
        })
      }
    >
      {children} on {currentEnv.name}
    </AsyncButton>
  );
}
