import type { StatusMap } from '../lib/status';

interface Props {
  map: StatusMap; // one of lib/status.ts
  value: string;
  role?: string;
}

// A coloured tag for a status: <Badge map={RUN_STATUS} value={run.status} />
export function Badge({ map, value, role }: Props) {
  const s = map[value] ?? { label: value, tone: 'neutral' };
  return (
    <span className={`badge badge-${s.tone}`} role={role}>
      {s.label}
    </span>
  );
}
