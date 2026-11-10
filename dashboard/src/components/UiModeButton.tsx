import type { ReactNode } from 'react';
import { post } from '../api/client';
import { useEnv } from '../hooks/useEnv';
import { useRerun } from '../hooks/useRerun';
import { hostOf } from '../lib/format';
import { AsyncButton } from './AsyncButton';

interface Props {
  planSlug: string | undefined;
  // What to show; cases left out shows all of them.
  body: { projects?: string[]; cases?: string[] };
  className?: string;
  children: ReactNode;
}

// Opens a plan, or some of its cases, in Playwright's UI mode on the
// environment picked in the header: a window on this computer where you run
// the test step by step and look through its trace. It isn't a dashboard
// run, so nothing shows up here. Same limits as RerunButton.
export function UiModeButton({ planSlug, body, className, children }: Props) {
  const { currentEnv } = useEnv();
  const rerun = useRerun();
  const plan = rerun?.planBySlug(planSlug);
  if (!rerun || !plan?.runnable) return null;

  const blocked = plan.changesData && currentEnv.production;
  const busy = Boolean(rerun.activeRun);
  return (
    <AsyncButton
      className={className}
      disabled={busy || blocked}
      busyLabel="Opening…"
      title={
        busy
          ? 'Another run is in progress'
          : blocked
            ? `${plan.name} changes data, so it never runs on Production`
            : `Open Playwright UI mode on ${currentEnv.name} (${hostOf(currentEnv.baseURL)}). It opens in its own window.`
      }
      onClick={() =>
        post(`/api/plans/${plan.slug}/ui`, {
          env: currentEnv.id,
          ...body,
        }).catch((err: Error) => alert(`Couldn't open UI mode: ${err.message}`))
      }
    >
      {children}
    </AsyncButton>
  );
}
