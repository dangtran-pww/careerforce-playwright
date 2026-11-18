import { Link } from 'react-router';
import type { SuiteSummary } from '../api/types';
import { RUN_STATUS } from '../lib/status';
import { suiteResults } from '../lib/suiteResults';
import { Badge } from './Badge';
import { TimeAgo } from './TimeAgo';

// A suite's latest results on the Suites page: the worst status of its
// plans' latest full runs, their test counts added up, and how many of its
// plans those runs cover. "Never run" until one of its plans has had a full
// run here.
export function SuiteResults({ suite }: { suite: SuiteSummary }) {
  const results = suiteResults(suite);
  const running = suite.runningRun && (
    <span className="suite-running">
      <Badge map={RUN_STATUS} value="running" small />{' '}
      <Link to={`/runs/${suite.runningRun}`}>Watch</Link>
    </span>
  );
  if (!results)
    return (
      <div className="suite-results">
        {running || (
          <span className="note">
            {suite.plans.some((p) => p.runnable)
              ? 'Never run'
              : 'Nothing to run yet'}
          </span>
        )}
      </div>
    );
  const { status, passed, failed, flaky, skipped } = results;
  const counts: [number, string, string?][] = [
    [passed, 'passed'],
    [failed, 'failed', 'count-bad'],
    [flaky, 'flaky', 'count-warn'],
    [skipped, 'skipped'],
  ];
  return (
    <div className="suite-results">
      <div className="suite-results-head">
        <Badge map={RUN_STATUS} value={status} small />
        <span className="suite-counts">
          {counts
            .filter(([n], i) => n > 0 || i === 0)
            .map(([n, label, cls]) => (
              <span key={label} className={cls}>
                {n} {label}
              </span>
            ))}
        </span>
        {running}
      </div>
      <div className="note small">
        {results.plansRun === results.plansTotal
          ? 'All plans'
          : `${results.plansRun} of ${results.plansTotal} plans`}{' '}
        · <TimeAgo iso={results.latestAt} />
      </div>
    </div>
  );
}
