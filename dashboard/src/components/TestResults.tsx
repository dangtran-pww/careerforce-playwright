import type {
  FailureExplanation,
  FailureExplanationsResponse,
  TestRef,
  TestResult,
  TestStats,
} from '../api/types';
import { useApi } from '../hooks/useApi';
import { CASE_PANEL_ID, sameCase, useCasePanel } from '../hooks/useCasePanel';
import { caseOfTest, useRerun } from '../hooks/useRerun';
import { duration } from '../lib/format';
import { TEST_OUTCOME, type Tone } from '../lib/status';
import { Badge } from './Badge';
import { ErrorBox } from './Callouts';
import { useFailureExplain } from './FailureExplain';
import { RerunButton } from './RerunButton';
import { Table, VisuallyHidden } from './Table';
import { Tags } from './Tags';
import { UiModeButton } from './UiModeButton';

const ORDER = { unexpected: 0, flaky: 1, expected: 2, skipped: 3 };

// Playwright results: count tiles and a table of tests, failures first.
// Used for a plan run and for each plan step of a suite run (`step` is its
// number). A failed or flaky test can ask Claude why it failed, and a test
// whose title starts with a case ID can run that case again, or open it in
// the run page's side panel to see what the plan expects and what the code
// does (CasePanel).
export function TestResults({
  runId,
  step = null,
  planSlug,
  stats,
  results = [],
  errors,
}: {
  runId: string;
  step?: number | null;
  planSlug?: string; // the plan the tests belong to
  stats: TestStats;
  results?: TestResult[];
  errors?: string[];
}) {
  const { expected, unexpected, flaky, skipped } = stats;
  const plan = useRerun()?.planBySlug(planSlug);
  const rows = [...results].sort((a, b) => ORDER[a.outcome] - ORDER[b.outcome]);
  const saved = useApi<FailureExplanationsResponse>(
    `/api/runs/${runId}/explanations`,
  ).data?.explanations;
  const refOf = (r: TestResult): TestRef => ({
    step,
    project: r.project,
    file: r.file,
    line: r.line,
    title: r.title,
  });
  const savedFor = (ref: TestRef) =>
    saved?.find(
      (e) =>
        e.step === ref.step &&
        e.project === ref.project &&
        e.file === ref.file &&
        e.line === ref.line &&
        e.title === ref.title,
    );
  return (
    <>
      <div className="tiles">
        <Tile
          label="Passed"
          value={expected}
          tone={expected ? 'good' : 'neutral'}
        />
        <Tile
          label="Failed"
          value={unexpected}
          tone={unexpected ? 'bad' : 'neutral'}
        />
        <Tile label="Flaky" value={flaky} tone={flaky ? 'warn' : 'neutral'} />
        <Tile label="Skipped" value={skipped} tone="neutral" />
      </div>
      {errors?.map((e, i) => (
        <ErrorBox key={i}>{e}</ErrorBox>
      ))}
      <Table
        rows={rows}
        rowKey={(r) => `${r.project}:${r.file}:${r.line}:${r.title}`}
        columns={[
          {
            head: 'Result',
            cell: (r) => (
              <>
                <Badge map={TEST_OUTCOME} value={r.outcome} />
                {r.expectedToFail && (
                  <div className="note small">known bug</div>
                )}
              </>
            ),
          },
          {
            head: 'Test',
            // The rest of the test (file, rerun buttons, error) is in the
            // row below, where it has the width of four columns.
            cell: (r) => (
              <>
                {r.title}
                <Tags tags={r.tags} />
              </>
            ),
          },
          { head: 'Project', wideOnly: true, cell: (r) => r.project },
          {
            head: 'Took',
            wideOnly: true,
            cell: (r) => duration(r.duration),
          },
          {
            head: <VisuallyHidden>Actions</VisuallyHidden>,
            className: 'cell-action',
            cell: (r) => {
              const caseId = caseOfTest(plan, r.title);
              return (
                planSlug &&
                caseId && <ExplainCase planSlug={planSlug} caseId={caseId} />
              );
            },
          },
        ]}
        // The test's details and "Why did it fail?" span Test, Project, Took
        // and Actions, so they have room to read.
        belowFrom={1}
        below={(r) => (
          <TestDetails
            test={r}
            planSlug={planSlug}
            caseId={caseOfTest(plan, r.title)}
            runId={runId}
            testRef={refOf(r)}
            saved={savedFor(refOf(r))}
          />
        )}
      />
    </>
  );
}

// Under a test's title: its file, the Project and Took values on phones
// (those columns are hidden there), its error, its buttons (run its case
// again, open it in UI mode and, for a failure, "Why did it fail?") and
// Claude's answer.
function TestDetails({
  test: r,
  planSlug,
  caseId,
  runId,
  testRef,
  saved,
}: {
  test: TestResult;
  planSlug?: string;
  caseId?: string;
  runId: string;
  testRef: TestRef;
  saved?: FailureExplanation;
}) {
  const failed =
    Boolean(r.error) && (r.outcome === 'unexpected' || r.outcome === 'flaky');
  const explain = useFailureExplain({ runId, test: testRef, saved });
  const explainButton = failed && explain.button;
  return (
    <>
      <div className="note small mono test-file">
        {r.file}:{r.line}
      </div>
      <div className="note small narrow-only">
        {r.project} · {duration(r.duration)}
      </div>
      {r.error && r.outcome !== 'expected' && (
        <details>
          <summary>Error</summary>
          <pre className="error">{r.error}</pre>
        </details>
      )}
      {(caseId || explainButton) && (
        <div className="rerun-case">
          {caseId && (
            <>
              <RerunButton
                planSlug={planSlug}
                className="ghost small"
                body={{ cases: [caseId], projects: [r.project] }}
              >
                Run {caseId} ({r.project}) again
              </RerunButton>
              <UiModeButton
                planSlug={planSlug}
                className="ghost small"
                body={{ cases: [caseId], projects: [r.project] }}
              >
                Open {caseId} in UI mode
              </UiModeButton>
            </>
          )}
          {explainButton}
        </div>
      )}
      {failed && explain.panel}
    </>
  );
}

// Shows the case in the run page's right column; pressed again, closes it. The
// label stays the same so the column never changes width.
function ExplainCase({
  planSlug,
  caseId,
}: {
  planSlug: string;
  caseId: string;
}) {
  const panel = useCasePanel();
  if (!panel) return null;
  const me = { planSlug, caseId };
  const open = sameCase(panel.shown, me);
  return (
    <button
      type="button"
      className={open ? 'small' : 'ghost small'}
      aria-expanded={open}
      aria-controls={CASE_PANEL_ID}
      onClick={() => panel.show(open ? null : me)}
    >
      Explain {caseId}
    </button>
  );
}

// A big number with a label under it.
function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: Tone;
}) {
  return (
    <div className={`tile tile-${tone}`}>
      <div className="tile-value">{value}</div>
      <div className="tile-label">{label}</div>
    </div>
  );
}
