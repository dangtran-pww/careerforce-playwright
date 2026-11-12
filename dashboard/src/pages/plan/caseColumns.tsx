import type { Dispatch, SetStateAction } from 'react';
import type { Env, Plan, PlanCase } from '../../api/types';
import { PlanRunButton } from '../../components/PlanRunButton';
import { VisuallyHidden } from '../../components/Table';
import { toggled } from '../../lib/sets';
import { canRun, runBody, type PlanChoice } from './choice';

// Columns the test cases table and the prompt cases table share.

/** The tick box that picks a case for the run panel's Run button. */
export const selectColumn = (
  choice: PlanChoice,
  setChoice: Dispatch<SetStateAction<PlanChoice>>,
) => ({
  head: <VisuallyHidden>Select</VisuallyHidden>,
  cell: (c: PlanCase) => (
    <input
      type="checkbox"
      name="case"
      aria-label={`Select ${c.id}`}
      disabled={!canRun(c)}
      checked={choice.cases.has(c.id)}
      onChange={(e) =>
        setChoice((ch) => ({
          ...ch,
          cases: toggled(ch.cases, c.id, e.target.checked),
        }))
      }
    />
  ),
});

/** The button that runs one case on its own. */
export const runColumn = (
  plan: Plan,
  choice: PlanChoice,
  env: Env,
  activeRun: string | null,
) => ({
  head: <VisuallyHidden>Actions</VisuallyHidden>,
  className: 'cell-action',
  cell: (c: PlanCase) =>
    canRun(c) && (
      <PlanRunButton
        plan={plan}
        body={runBody(choice, [c.id])}
        className="ghost"
        disabled={Boolean(activeRun) || (env.production && c.noProd)}
        title={
          env.production && c.noProd
            ? `${c.id} is no-prod, so it never runs on Production`
            : undefined
        }
      >
        Run
      </PlanRunButton>
    ),
});
