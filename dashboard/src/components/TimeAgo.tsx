import { dateFormat, relative } from '../lib/format';

// "5 minutes ago", with the full date on hover.
export function TimeAgo({ iso }: { iso?: string }) {
  if (!iso) return <>—</>;
  return (
    <time dateTime={iso} title={dateFormat.format(new Date(iso))}>
      {relative(iso)}
    </time>
  );
}
