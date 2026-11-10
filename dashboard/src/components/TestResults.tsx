import type { TestResult, TestStats } from '../api/types';
import { duration } from '../lib/format';
import { TEST_OUTCOME, type Tone } from '../lib/status';
import { Badge } from './Badge';
import { ErrorBox } from './Callouts';
import { Table } from './Table';
import { Tags } from './Tags';

const ORDER = { unexpected: 0, flaky: 1, expected: 2, skipped: 3 };

// Playwright results: count tiles and a table of tests, failures first.
// Used for a plan run and for each plan step of a suite run.
export function TestResults({
  stats,
  results = [],
  errors,
}: {
  stats: TestStats;
  results?: TestResult[];
  errors?: string[];
}) {
  const { expected, unexpected, flaky, skipped } = stats;
  const rows = [...results].sort((a, b) => ORDER[a.outcome] - ORDER[b.outcome]);
  return (
    <>
      <div className="tiles">
        <Tile label="Passed" value={expected} tone="good" />
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
                <div className="note small mono">
                  {r.file}:{r.line}
                </div>
                {r.error && r.outcome !== 'expected' && (
                  <details>
                    <summary>Error</summary>
                    <pre className="error">{r.error}</pre>
                  </details>
                )}
              </>
            ),
          },
          { head: 'Project', cell: (r) => r.project },
          { head: 'Took', cell: (r) => duration(r.duration) },
        ]}
      />
    </>
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
