import { Link } from 'react-router';
import type { Run } from '../api/types';
import { RUN_STATUS } from '../lib/status';
import { Badge } from './Badge';
import { TimeAgo } from './TimeAgo';

// The last run of a plan or suite as a status badge and time, or "—".
export function LastRunLink({ run }: { run?: Run | null }) {
  if (!run) return <span className="note">—</span>;
  return (
    <Link to={`/runs/${run.id}`} className="run-link">
      <Badge map={RUN_STATUS} value={run.status} />{' '}
      <TimeAgo iso={run.startedAt} />
    </Link>
  );
}
