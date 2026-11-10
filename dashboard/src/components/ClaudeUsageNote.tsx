import type { ClaudeUsage } from '../api/types';
import { modelName } from '../lib/format';
import { TimeAgo } from './TimeAgo';

// Who wrote a Claude answer, when, and what it took: model, tokens in and
// out, cost. `verb` is e.g. "Explained" or "Reviewed". Older saved answers
// have only the time and cost.
export function ClaudeUsageNote({
  usage: u,
  verb,
}: {
  usage: ClaudeUsage;
  verb: string;
}) {
  const n = (x: number) => x.toLocaleString();
  return (
    <p className="note claude-usage">
      <span>
        {verb} by{' '}
        {u.model ? <span title={u.model}>{modelName(u.model)}</span> : 'Claude'}
        , <TimeAgo iso={u.createdAt} />
      </span>
      {u.tokens && (
        <span
          title={`${n(u.tokens.cached)} of the ${n(u.tokens.in)} input tokens were read from the prompt cache`}
        >
          {n(u.tokens.in)} tokens in · {n(u.tokens.out)} out
        </span>
      )}
      {u.costUsd != null && <span>{usd(u.costUsd)}</span>}
    </p>
  );
}

// Under a cent, show enough digits to not read as $0.00.
const usd = (x: number) =>
  `$${x > 0 && x < 0.01 ? x.toFixed(4) : x.toFixed(2)}`;
