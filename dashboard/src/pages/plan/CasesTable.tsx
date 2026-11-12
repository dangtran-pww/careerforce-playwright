import type { Dispatch, SetStateAction } from 'react';
import type { Plan, PlanCase } from '../../api/types';
import { CaseDetails } from '../../components/CaseDetails';
import { CaseProjects } from '../../components/CaseProjects';
import { NoProdBadge, otherTags } from '../../components/NoProdBadge';
import { Table } from '../../components/Table';
import { Tags } from '../../components/Tags';
import { useEnv } from '../../hooks/useEnv';
import { runColumn, selectColumn } from './caseColumns';
import { planCommand, type PlanChoice } from './choice';

interface Props {
  plan: Plan;
  cases: PlanCase[]; // the plan's test cases (not its prompt cases)
  choice: PlanChoice;
  setChoice: Dispatch<SetStateAction<PlanChoice>>;
  activeRun: string | null;
}

// The plan's test cases; each opens to show its steps, expected result and
// the command that runs it on its own (with the projects and headed choice
// from the run panel). When the plan has tests, each case can be ticked (to
// run only the ticked ones) or run on its own. Prompt cases have their own
// table (PromptCasesTable).
export function CasesTable({
  plan,
  cases,
  choice,
  setChoice,
  activeRun,
}: Props) {
  const { currentEnv } = useEnv();
  const hasTests = plan.hasTests ?? plan.runnable;

  return (
    <Table
      rows={cases}
      rowKey={(c) => c.id}
      expand={(c) => (
        <CaseDetails
          planSlug={plan.slug}
          testCase={c}
          command={
            hasTests && c.testCount > 0
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
        hasTests && selectColumn(choice, setChoice),
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
        hasTests && {
          head: 'Projects',
          cell: (c) => <CaseProjects testCase={c} />,
        },
        hasTests && {
          head: 'Tests',
          className: (c) => (c.testCount ? undefined : 'note'),
          cell: (c) => c.testCount || 'none',
        },
        hasTests && runColumn(plan, choice, currentEnv, activeRun),
      ]}
    />
  );
}
