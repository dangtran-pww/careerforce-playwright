import type { Dispatch, SetStateAction } from 'react';
import type { Plan } from '../../api/types';
import { CaseDetails } from '../../components/CaseDetails';
import { CaseProjects } from '../../components/CaseProjects';
import { NoProdBadge, otherTags } from '../../components/NoProdBadge';
import { PlanRunButton } from '../../components/PlanRunButton';
import { Table, VisuallyHidden } from '../../components/Table';
import { Tags } from '../../components/Tags';
import { useEnv } from '../../hooks/useEnv';
import { toggled } from '../../lib/sets';
import { planCommand, runBody, type PlanChoice } from './choice';

interface Props {
  plan: Plan;
  choice: PlanChoice;
  setChoice: Dispatch<SetStateAction<PlanChoice>>;
  activeRun: string | null;
}

// The plan's cases; each opens to show its steps, expected result and the
// command that runs it on its own (with the projects and headed choice from
// the run panel). When the plan has tests, each case can be ticked (to run
// only the ticked ones) or run on its own.
export function CasesTable({ plan, choice, setChoice, activeRun }: Props) {
  const { currentEnv } = useEnv();
  const runnable = plan.runnable;

  return (
    <Table
      rows={plan.cases}
      rowKey={(c) => c.id}
      expand={(c) => (
        <CaseDetails
          planSlug={plan.slug}
          testCase={c}
          command={
            runnable && c.testCount > 0
              ? planCommand(
                  plan,
                  { ...choice, cases: new Set([c.id]) },
                  currentEnv,
                )
              : undefined
          }
        />
      )}
      expandLabel={(c) => `Details of ${c.id}`}
      columns={[
        runnable && {
          head: <VisuallyHidden>Select</VisuallyHidden>,
          cell: (c) => (
            <input
              type="checkbox"
              name="case"
              aria-label={`Select ${c.id}`}
              disabled={!c.testCount}
              checked={choice.cases.has(c.id)}
              onChange={(e) =>
                setChoice((ch) => ({
                  ...ch,
                  cases: toggled(ch.cases, c.id, e.target.checked),
                }))
              }
            />
          ),
        },
        { head: 'ID', className: 'mono', cell: (c) => c.id },
        {
          head: 'Case',
          cell: (c) => (
            <>
              {c.title}
              {!plan.noProd && <NoProdBadge testCase={c} />}
              <Tags tags={otherTags(c)} />
            </>
          ),
        },
        runnable && {
          head: 'Projects',
          cell: (c) => <CaseProjects testCase={c} />,
        },
        runnable && {
          head: 'Tests',
          className: (c) => (c.testCount ? undefined : 'note'),
          cell: (c) => c.testCount || 'none',
        },
        runnable && {
          head: <VisuallyHidden>Actions</VisuallyHidden>,
          className: 'cell-action',
          cell: (c) =>
            c.testCount > 0 && (
              <PlanRunButton
                plan={plan}
                body={runBody(choice, [c.id])}
                className="ghost"
                disabled={
                  Boolean(activeRun) || (currentEnv.production && c.noProd)
                }
                title={
                  currentEnv.production && c.noProd
                    ? `${c.id} is no-prod, so it never runs on Production`
                    : undefined
                }
              >
                Run
              </PlanRunButton>
            ),
        },
      ]}
    />
  );
}
