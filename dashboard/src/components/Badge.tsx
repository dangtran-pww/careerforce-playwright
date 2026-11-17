import type { StatusMap } from '../lib/status';
import { Spinner } from './Spinner';

interface Props {
  map: StatusMap; // one of lib/status.ts
  value: string;
  role?: string;
  busy?: boolean; // show a spinner in front of the label
  small?: boolean; // the compact size, for a badge in a list row
}

// A coloured tag for a status: <Badge map={RUN_STATUS} value={run.status} />
export function Badge({ map, value, role, busy, small }: Props) {
  const s = map[value] ?? { label: value, tone: 'neutral' };
  return (
    <span
      className={`badge badge-${s.tone}${small ? ' small' : ''}`}
      role={role}
    >
      {busy && <Spinner />}
      {s.label}
    </span>
  );
}
