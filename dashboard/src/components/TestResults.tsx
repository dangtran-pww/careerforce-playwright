import type {
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
import { FailureExplain } from './FailureExplain';
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
            cell: (r) => (
              <>
                {r.title}
                <Tags tags={r.tags} />
                <div className="note small mono test-file">
                  {r.file}:{r.line}
                </div>
                {/* The Project and Took columns are hidden on phones. */}
                <div className="note small narrow-only">
                  {r.project} · {duration(r.duration)}
                </div>
                <RerunCase
                  plan={planSlug}
                  test={r}
                  caseId={caseOfTest(plan, r.title)}
                />
                {r.error && r.outcome !== 'expected' && (
                  <details>
                    <summary>Error</summary>
                    <pre className="error">{r.error}</pre>
                  </details>
                )}
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
        // "Why did it fail?" spans Test, Project and Took, so Claude's
        // answer has room to read.
        belowFrom={1}
        below={(r) =>
          r.error &&
          (r.outcome === 'unexpected' || r.outcome === 'flaky') && (
            <FailureExplain
              runId={runId}
              test={refOf(r)}
              saved={savedFor(refOf(r))}
            />
          )
        }
      />
    </>
  );
}

// Runs the test's case again, on the test's project only, or opens it in
// Playwright UI mode to run it interactively.
function RerunCase({
  plan,
  test,
  caseId,
}: {
  plan?: string;
  test: TestResult;
  caseId?: string;
}) {
  if (!caseId) return null;
  return (
    <div className="rerun-case">
      <RerunButton
        planSlug={plan}
        className="ghost small"
        body={{ cases: [caseId], projects: [test.project] }}
      >
        Run {caseId} ({test.project}) again
      </RerunButton>
      <UiModeButton
        planSlug={plan}
        className="ghost small"
        body={{ cases: [caseId], projects: [test.project] }}
      >
        Open {caseId} in UI mode
      </UiModeButton>
    </div>
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
