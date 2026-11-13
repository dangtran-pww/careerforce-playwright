import type { RunIssue, RunIssueTest } from '../api/types';
import { showTestRow, testRowId } from '../lib/runs';
import { FAILURE_CAUSE } from '../lib/status';
import { Badge } from './Badge';

// One issue in a run's summary (RunSummary): what goes wrong, its likely
// cause, the tests it hits and what to do. Each test links to its row in
// the run's results.
export function RunIssueItem({ issue }: { issue: RunIssue }) {
  const n = issue.tests.length;
  return (
    <li className="run-issue">
      <p className="run-issue-head">
        <strong>{issue.title}</strong>
        <Badge map={FAILURE_CAUSE} value={issue.cause} />
        <span className="note small">
          {n} {n === 1 ? 'test' : 'tests'}
        </span>
      </p>
      <p>{issue.detail}</p>
      {issue.nextStep && (
        <p>
          <strong>What to do:</strong> {issue.nextStep}
        </p>
      )}
      {n > 0 && (
        <ul className="run-issue-tests">
          {issue.tests.map((t, i) => (
            <li key={i}>
              {typeof t === 'string' ? t : <IssueTest test={t} />}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

// A test's name, linking to its row in the results.
function IssueTest({ test }: { test: RunIssueTest }) {
  return (
    <button
      type="button"
      className="link"
      title="Show this test in the results"
      onClick={() => showTestRow(testRowId(test.step, test))}
    >
      {test.name}
    </button>
  );
}
