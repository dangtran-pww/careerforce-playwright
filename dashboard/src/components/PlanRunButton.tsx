import type { ReactNode } from 'react';
import type { PlanSummary } from '../api/types';
import { useEnv } from '../hooks/useEnv';
import { useStartRun } from '../hooks/useStartRun';
import { hostOf } from '../lib/format';
import { AsyncButton } from './AsyncButton';

interface Props {
  plan: PlanSummary;
  // What to run; leave out for the plan's default projects and all cases.
  body?: { projects?: string[]; cases?: string[]; headed?: boolean };
  disabled?: boolean;
  title?: string;
  className?: string;
  children: ReactNode;
}

// Starts a run of a plan on the current environment. Plans that change data
// ask first.
export function PlanRunButton({ plan, body = {}, children, ...props }: Props) {
  const { currentEnv } = useEnv();
  const start = useStartRun();
  return (
    <AsyncButton
      {...props}
      confirmMessage={
        plan.changesData
          ? `${plan.name} creates, edits or deletes content on ${currentEnv.name} (${hostOf(currentEnv.baseURL)}). Run it?`
          : undefined
      }
      onClick={() => start(`/api/plans/${plan.slug}/run`, body)}
    >
      {children}
    </AsyncButton>
  );
}
