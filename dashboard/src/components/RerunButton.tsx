import type { ReactNode } from 'react';
import { useEnv } from '../hooks/useEnv';
import { useRerun } from '../hooks/useRerun';
import { useStartRun } from '../hooks/useStartRun';
import { hostOf } from '../lib/format';
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
// header. Disabled while any run is going, and for plans that change data
// on production; those plans ask first elsewhere.
export function RerunButton({ planSlug, body, className, children }: Props) {
  const { currentEnv } = useEnv();
  const rerun = useRerun();
  const start = useStartRun();
  const plan = rerun?.planBySlug(planSlug);
  if (!rerun || !plan?.runnable) return null;

  const blocked = plan.changesData && currentEnv.production;
  const busy = Boolean(rerun.activeRun);
  return (
    <AsyncButton
      className={className}
      disabled={busy || blocked}
      title={
        busy
          ? 'Another run is in progress'
          : blocked
            ? `${plan.name} changes data, so it never runs on Production`
            : `Run on ${currentEnv.name} (${hostOf(currentEnv.baseURL)})`
      }
      confirmMessage={
        plan.changesData
          ? `${plan.name} creates, edits or deletes content on ${currentEnv.name} (${hostOf(currentEnv.baseURL)}). Run it?`
          : undefined
      }
      onClick={() => start(`/api/plans/${plan.slug}/run`, body)}
    >
      {children} on {currentEnv.name}
    </AsyncButton>
  );
}
