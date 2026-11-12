import type { TestProgress } from '../api/types';
import { plural } from '../lib/format';

// How far a running plan has got: "3 of 12 tests ended", a progress bar and
// the percentage. Before Playwright has said how many tests there are, it
// says it is starting.
export function TestProgressBar({ tests }: { tests?: TestProgress }) {
  if (!tests)
    return (
      <div className="test-progress">
        <p className="test-progress-head">
          <strong>Starting Playwright…</strong>
        </p>
        <progress aria-label="Tests ended" />
        <p className="note small">See the Output panel.</p>
      </div>
    );
  const { total, done, workers } = tests;
  const percent = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="test-progress">
      <p className="test-progress-head">
        <strong>
          {done} of {plural(total, 'test')} ended
        </strong>
        <span>{percent}%</span>
      </p>
      <progress aria-label="Tests ended" value={done} max={total || 1} />
      <p className="note small">
        On {plural(workers, 'worker')}. See the Output panel.
      </p>
    </div>
  );
}
