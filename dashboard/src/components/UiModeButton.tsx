import type { ReactNode } from 'react';
import { post } from '../api/client';
import { useEnv } from '../hooks/useEnv';
import { useRunGate } from '../hooks/useRerun';
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
// run, so nothing shows up here. Same limits as RerunButton (useRunGate).
export function UiModeButton({ planSlug, body, className, children }: Props) {
  const { currentEnv } = useEnv();
  const gate = useRunGate(planSlug, body.cases);
  if (!gate) return null;

  return (
    <AsyncButton
      className={className}
      disabled={Boolean(gate.blocked)}
      busyLabel="Opening…"
      title={
        gate.blocked ??
        `Open Playwright UI mode on ${gate.where}. It opens in its own window.`
      }
      onClick={() =>
        post(`/api/plans/${gate.plan.slug}/ui`, {
          env: currentEnv.id,
          ...body,
        }).catch((err: Error) => {
          throw new Error(`Couldn't open UI mode: ${err.message}`);
        })
      }
    >
      {children}
    </AsyncButton>
  );
}
