import type { Dispatch, SetStateAction } from 'react';
import type { Plan, PlanCase } from '../../api/types';
import { CaseDetails } from '../../components/CaseDetails';
import { NoProdBadge } from '../../components/NoProdBadge';
import { Table } from '../../components/Table';
import { useEnv } from '../../hooks/useEnv';
import { runColumn, selectColumn } from './caseColumns';
import { canRun, comparedWith, promptCommand, type PlanChoice } from './choice';

interface Props {
  plan: Plan;
  cases: PlanCase[]; // the plan's prompt cases
  choice: PlanChoice;
  setChoice: Dispatch<SetStateAction<PlanChoice>>;
  activeRun: string | null;
}

// The plan's prompt cases: no test code, Claude checks the site in a
// browser from the case's prompt file (test-plans/README.md, Rule 2). Each
// opens to show its steps, expected result, the prompt and the command that
// runs it on its own. They can be ticked and run like test cases.
export function PromptCasesTable({
  plan,
  cases,
  choice,
  setChoice,
  activeRun,
}: Props) {
  const { currentEnv, envById } = useEnv();

  return (
    <Table
      rows={cases}
      rowKey={(c) => c.id}
      expand={(c) => (
        <CaseDetails
          planSlug={plan.slug}
          testCase={c}
          command={
            canRun(c) ? promptCommand(c.id, choice, currentEnv) : undefined
          }
        />
      )}
      expandLabel={(c) => `Details of ${c.id}`}
      columns={[
        selectColumn(choice, setChoice),
        { head: 'ID', className: 'mono', cell: (c) => c.id },
        {
          head: 'Case',
          cell: (c) => (
            <>
              {c.title}
              {!plan.noProd && <NoProdBadge testCase={c} />}
            </>
          ),
        },
        {
          head: 'Viewports',
          className: 'note',
          cell: (c) => c.prompt?.viewports.map((v) => v.name).join(', '),
        },
        {
          head: `Compares with (${currentEnv.name})`,
          className: 'note',
          cell: (c) =>
            canRun(c)
              ? comparedWith(c, choice.compare, currentEnv, envById)
              : 'Broken prompt file',
        },
        runColumn(plan, choice, currentEnv, activeRun),
      ]}
    />
  );
}
