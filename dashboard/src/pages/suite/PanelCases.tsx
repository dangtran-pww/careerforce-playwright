import type { Plan, PlanCase } from '../../api/types';
import { CaseDetails } from '../../components/CaseDetails';
import { CaseProjects } from '../../components/CaseProjects';
import { NoProdBadge } from '../../components/NoProdBadge';
import { PlanRunButton } from '../../components/PlanRunButton';
import { Table, VisuallyHidden } from '../../components/Table';
import { TestCountNote } from '../../components/TestCountNote';
import { useEnv } from '../../hooks/useEnv';
import {
  canRun,
  comparedWith,
  defaultChoice,
  planCommand,
  promptCommand,
} from './planChoice';

interface Props {
  plan: Plan;
  suite: string; // the suite page it's on; runs started here link back
  projects: string[]; // the suite's projects for this plan
  headed: boolean;
  activeRun: string | null;
  openCase?: string | null; // a case whose row starts opened and highlighted
}

// The suite page's plan panel: the plan's test cases, then its prompt cases
// in a table of their own. Each opens to show its steps and expected result,
// and can be run on its own (a test case in the projects the suite runs the
// plan in).
export function PanelCases(props: Props) {
  const { plan } = props;
  const testCases = plan.cases.filter((c) => c.kind !== 'prompt');
  const promptCases = plan.cases.filter((c) => c.kind === 'prompt');
  return (
    <>
      <h3 className="side-panel-title">Cases ({testCases.length})</h3>
      {plan.hasTests && (
        <TestCountNote caseCount={testCases.length} projects={plan.projects} />
      )}
      <TestCases {...props} cases={testCases} />
      {promptCases.length > 0 && (
        <>
          <h3 className="side-panel-title">
            Prompt cases ({promptCases.length})
          </h3>
          <p className="note">
            Checked by Claude in a browser, after the tests.
          </p>
          <PromptCases {...props} cases={promptCases} />
        </>
      )}
    </>
  );
}

function TestCases({
  plan,
  suite,
  cases,
  projects,
  headed,
  activeRun,
  openCase,
}: Props & { cases: PlanCase[] }) {
  const { currentEnv } = useEnv();
  const hasTests = plan.hasTests ?? plan.runnable;
  const runProjects = new Set(
    projects.length
      ? projects
      : plan.projects.filter((p) => p.selected).map((p) => p.name),
  );
  return (
    <Table
      rows={cases}
      rowKey={(c) => c.id}
      initialOpen={openCase ? [openCase] : undefined}
      highlight={openCase ?? undefined}
      expand={(c) => (
        <CaseDetails
          planSlug={plan.slug}
          testCase={c}
          command={
            hasTests && c.testCount > 0
              ? planCommand(
                  plan,
                  {
                    projects: runProjects,
                    cases: new Set([c.id]),
                    headed,
                    compare: 'default',
                  },
                  currentEnv,
                )
              : undefined
          }
        />
      )}
      expandLabel={(c) => `Details of ${c.id}`}
      columns={[
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
        hasTests && {
          head: 'Projects',
          cell: (c) => <CaseProjects testCase={c} only={projects} />,
        },
        hasTests && {
          head: 'Tests',
          className: (c) => (c.testCount ? undefined : 'note'),
          cell: (c) => c.testCount || 'none',
        },
        hasTests && runColumn(plan, { suite, projects, headed, activeRun }),
      ]}
    />
  );
}

function PromptCases({
  plan,
  suite,
  cases,
  projects,
  headed,
  activeRun,
  openCase,
}: Props & { cases: PlanCase[] }) {
  const { currentEnv, envById } = useEnv();
  return (
    <Table
      rows={cases}
      rowKey={(c) => c.id}
      initialOpen={openCase ? [openCase] : undefined}
      highlight={openCase ?? undefined}
      expand={(c) => (
        <CaseDetails
          planSlug={plan.slug}
          testCase={c}
          command={
            canRun(c)
              ? promptCommand(c.id, defaultChoice(plan), currentEnv)
              : undefined
          }
        />
      )}
      expandLabel={(c) => `Details of ${c.id}`}
      columns={[
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
          head: 'Compares with',
          className: 'note',
          cell: (c) =>
            canRun(c)
              ? comparedWith(c, 'default', currentEnv, envById)
              : 'Broken prompt file',
        },
        runColumn(plan, { suite, projects, headed, activeRun }),
      ]}
    />
  );
}

// The Run button of one case, in the projects the suite runs the plan in.
function runColumn(
  plan: Plan,
  {
    suite,
    projects,
    headed,
    activeRun,
  }: {
    suite: string;
    projects: string[];
    headed: boolean;
    activeRun: string | null;
  },
) {
  return {
    head: <VisuallyHidden>Actions</VisuallyHidden>,
    className: 'cell-action',
    cell: (c: PlanCase) => (
      <RunCase
        plan={plan}
        testCase={c}
        {...{ suite, projects, headed, activeRun }}
      />
    ),
  };
}

function RunCase({
  plan,
  testCase: c,
  suite,
  projects,
  headed,
  activeRun,
}: {
  plan: Plan;
  testCase: PlanCase;
  suite: string;
  projects: string[];
  headed: boolean;
  activeRun: string | null;
}) {
  const { currentEnv } = useEnv();
  if (!canRun(c)) return null;
  const offProd = currentEnv.production && c.noProd;
  return (
    <PlanRunButton
      plan={plan}
      body={{
        projects: projects.length ? projects : undefined,
        cases: [c.id],
        headed,
        suite,
      }}
      className="small"
      disabled={Boolean(activeRun) || Boolean(offProd)}
      title={
        activeRun
          ? 'Another run is in progress'
          : offProd
            ? `${c.id} is no-prod, so it never runs on Production`
            : `Run ${c.id} on ${currentEnv.name}`
      }
    >
      Run
    </PlanRunButton>
  );
}
