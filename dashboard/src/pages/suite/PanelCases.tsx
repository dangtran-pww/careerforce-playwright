import type { ReactNode } from 'react';
import type { Plan, PlanCase } from '../../api/types';
import { CaseDetails } from '../../components/CaseDetails';
import { RefreshButton, type Refresh } from '../../components/RefreshButton';
import { CaseProjects } from '../../components/CaseProjects';
import { CaseLogins } from '../../components/LoginBadges';
import { LoginsNote } from '../../components/LoginsNote';
import { NoProdBadge } from '../../components/NoProdBadge';
import { PlanRunButton } from '../../components/PlanRunButton';
import { Table, VisuallyHidden, type Column } from '../../components/Table';
import { TestCountNote } from '../../components/TestCountNote';
import { useEnv } from '../../hooks/useEnv';
import { offProdReason } from '../../lib/prod';
import {
  canRun,
  comparedWith,
  defaultPlanChoice,
  isPromptCase,
  planCommand,
  promptCommand,
} from './planChoice';
import { HeadedOption, runBody, useRunOptions } from './runOptions';

interface Props {
  plan: Plan;
  openCase?: string | null; // a case whose row starts opened and highlighted
  refresh?: Refresh; // reloads the plan, from an icon on each opened case
}

// The suite page's plan panel: the plan's test cases, then its prompt cases
// in a table of their own. Each opens to show its steps and expected result,
// and can be run on its own (a test case in the projects the suite runs the
// plan in). When the plan has both kinds of case, a button under each table
// runs just the cases of that table. How they run comes from the panel
// (useRunOptions).
export function PanelCases({ plan, openCase, refresh }: Props) {
  const { testCases, promptCases, testIds, promptIds, bothKinds } =
    caseKinds(plan);
  return (
    <>
      <h3 className="side-panel-title">Cases ({testCases.length})</h3>
      {plan.hasTests && <TestCountNote projects={plan.projects} />}
      <TestCases
        plan={plan}
        cases={testCases}
        openCase={openCase}
        refresh={refresh}
      />
      {bothKinds && (
        <RunKindButton
          plan={plan}
          label="test cases"
          caseIds={testIds}
          specRoles={plan.roles}
          headedOption
        />
      )}
      {promptCases.length > 0 && (
        <>
          <h3 className="side-panel-title">
            Prompt cases ({promptCases.length})
          </h3>
          <p className="note">
            Checked by Claude in a browser, after the tests.
          </p>
          <PromptCases
            plan={plan}
            cases={promptCases}
            openCase={openCase}
            refresh={refresh}
          />
          {bothKinds && (
            <RunKindButton
              plan={plan}
              label="prompt cases"
              caseIds={promptIds}
            />
          )}
        </>
      )}
    </>
  );
}

// The plan's test cases and prompt cases, the ones of each that can run, and
// whether it has runnable cases of both kinds (each table then gets its own
// Run button).
function caseKinds(plan: Plan) {
  const testCases = plan.cases.filter((c) => c.kind !== 'prompt');
  const promptCases = plan.cases.filter((c) => c.kind === 'prompt');
  const testIds = testCases.filter((c) => c.testCount > 0).map((c) => c.id);
  const promptIds = promptCases.filter(isPromptCase).map((c) => c.id);
  const bothKinds = plan.runnable && testIds.length > 0 && promptIds.length > 0;
  return { testCases, promptCases, testIds, promptIds, bothKinds };
}

// The plan has tests to run but no Run test cases button (it has no prompt
// cases), so the Run plan button is where the headed option goes.
export function runsTestsOnly(plan: Plan) {
  const { testIds, bothKinds } = caseKinds(plan);
  return testIds.length > 0 && !bothKinds;
}

type TableProps = Props & { cases: PlanCase[] };

function TestCases({ plan, cases, openCase, refresh }: TableProps) {
  const { currentEnv } = useEnv();
  const { projects, headed } = useRunOptions();
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
        idColumn,
        caseColumn(
          plan,
          hasTests
            ? (c) => <CaseProjects testCase={c} only={projects} />
            : undefined,
        ),
        (hasTests || refresh) && runColumn(plan, hasTests, refresh),
      ]}
    />
  );
}

function PromptCases({ plan, cases, openCase, refresh }: TableProps) {
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
              ? promptCommand(c.id, defaultPlanChoice(plan), currentEnv)
              : undefined
          }
        />
      )}
      expandLabel={(c) => `Details of ${c.id}`}
      columns={[
        idColumn,
        caseColumn(plan, (c) => (
          <div className="case-meta note">
            {canRun(c)
              ? promptMeta(c, comparedWith(c, 'default', currentEnv, envById))
              : 'Broken prompt file'}
          </div>
        )),
        runColumn(plan, true, refresh),
      ]}
    />
  );
}

// "desktop, phone · compares with Stage and Production", from a prompt
// case's viewports and what comparedWith() says ("—" when it compares with
// nothing).
function promptMeta(c: PlanCase, compared: string) {
  const viewports = c.prompt?.viewports.map((v) => v.name).join(', ');
  if (compared === '—') return viewports;
  const sites =
    compared === 'Its last run here' ? 'its last run here' : compared;
  return `${viewports} · compares with ${sites}`;
}

const idColumn: Column<PlanCase> = {
  head: 'ID',
  className: 'mono',
  cell: (c) => c.id,
};

// The case's title and badges, with `meta` (e.g. where it runs) on a line
// underneath: it keeps the table narrow enough for the side panel.
const caseColumn = (
  plan: Plan,
  meta?: (c: PlanCase) => ReactNode,
): Column<PlanCase> => ({
  head: 'Case',
  cell: (c) => (
    <>
      {/* The spaces let the title and its badges wrap between them. */}
      {c.title} {!plan.noProd && <NoProdBadge testCase={c} />}{' '}
      <CaseLogins testCase={c} />
      {meta?.(c)}
    </>
  ),
});

// A case's actions: its Run button (when `runs`), in the projects the suite
// runs the plan in, and the refresh icon before it. CSS shows the icon only
// while the case's row is open.
const runColumn = (
  plan: Plan,
  runs: boolean,
  refresh?: Refresh,
): Column<PlanCase> => ({
  head: <VisuallyHidden>Actions</VisuallyHidden>,
  className: 'cell-action',
  cell: (c) => (
    <div className="case-actions">
      {refresh && (
        <RefreshButton refresh={refresh} what={c.id} className="case-refresh" />
      )}
      {runs && <RunCase plan={plan} testCase={c} />}
    </div>
  ),
});

function RunCase({ plan, testCase: c }: { plan: Plan; testCase: PlanCase }) {
  const { currentEnv } = useEnv();
  const options = useRunOptions();
  if (!canRun(c)) return null;
  const offProd = currentEnv.production && c.noProd;
  return (
    <PlanRunButton
      plan={plan}
      body={runBody(options, [c.id])}
      className="small"
      onError={options.onRunError}
      busyLabel={c.roles?.length ? 'Checking…' : undefined}
      disabled={Boolean(options.activeRun) || Boolean(offProd)}
      title={
        options.activeRun
          ? `Another run is in progress on ${currentEnv.name}`
          : offProd
            ? `${c.id} is no-prod, so it never runs on Production`
            : `Run ${c.id} on ${currentEnv.name}`
      }
    >
      Run
    </PlanRunButton>
  );
}

// Runs one table's cases (`caseIds`) of the plan. On production it leaves
// out the no-prod cases, and is disabled when that leaves none. The server
// checks every login those cases need before it starts and refuses the run
// when one isn't ready (onRunError shows why); the note says which logins.
function RunKindButton({
  plan,
  label,
  caseIds,
  specRoles = [],
  headedOption = false,
}: {
  plan: Plan;
  label: string;
  caseIds: string[];
  headedOption?: boolean; // the "Show the browser" tick goes above it
  // Every login the plan's spec files use; the server checks these too
  // when a run covers every test case.
  specRoles?: string[];
}) {
  const { currentEnv } = useEnv();
  const options = useRunOptions();
  const ids = currentEnv.production
    ? caseIds.filter((id) => !plan.cases.find((c) => c.id === id)?.noProd)
    : caseIds;
  const planBlocked = currentEnv.production ? offProdReason(plan) : null;
  const reason = options.activeRun
    ? `Another run is in progress on ${currentEnv.name}`
    : (planBlocked ??
      (ids.length
        ? null
        : `Every one of the ${label} is no-prod, so none run on ${currentEnv.name}`));
  const roles = [
    ...new Set(
      plan.cases
        .filter((c) => ids.includes(c.id))
        .flatMap((c) => c.roles ?? [])
        .concat(specRoles),
    ),
  ];
  return (
    <>
      <LoginsNote roles={roles} />
      {headedOption && <HeadedOption />}
      <p className="actions">
        <PlanRunButton
          plan={plan}
          body={runBody(options, ids)}
          onError={options.onRunError}
          busyLabel={roles.length ? 'Checking logins…' : undefined}
          disabled={Boolean(reason)}
          title={
            reason ??
            `Run the ${ids.length} ${label} of ${plan.name} on ${currentEnv.name}`
          }
        >
          Run {label} on {currentEnv.name}
        </PlanRunButton>
      </p>
    </>
  );
}
