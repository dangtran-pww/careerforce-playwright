import { Link } from 'react-router';
import type { Run } from '../api/types';
import { duration } from '../lib/format';
import { runCounts, runDuration, runOwnerPath, whatRan } from '../lib/runs';
import { RUN_STATUS } from '../lib/status';
import { Badge } from './Badge';
import { EnvTag } from './EnvTag';
import { Table } from './Table';
import { TimeAgo } from './TimeAgo';

// A table of runs. `showPlan={false}` hides the "Plan or suite" column, for
// pages that are already about one plan or suite.
export function RunsTable({
  runs,
  showPlan = true,
}: {
  runs: Run[];
  showPlan?: boolean;
}) {
  if (!runs.length) return <p className="note">No runs yet.</p>;
  return (
    <Table
      rows={runs}
      rowKey={(run) => run.id}
      columns={[
        {
          head: 'Started',
          cell: (run) => (
            <Link to={`/runs/${run.id}`}>
              <TimeAgo iso={run.startedAt} />
            </Link>
          ),
        },
        {
          head: 'Env',
          cell: (run) => <EnvTag env={run.env} site={run.site} />,
        },
        showPlan && {
          head: 'Plan or suite',
          cell: (run) => <Link to={runOwnerPath(run)}>{run.planName}</Link>,
        },
        { head: 'What ran', cell: whatRan },
        {
          head: 'Result',
          cell: (run) => <Badge map={RUN_STATUS} value={run.status} />,
        },
        {
          head: 'Tests',
          className: 'note',
          cell: (run) => runCounts(run) ?? '—',
        },
        { head: 'Took', cell: (run) => duration(runDuration(run)) },
      ]}
    />
  );
}
