import { FAILURE_CAUSE } from '../lib/status';
import { Badge } from './Badge';
import { InfoTip } from './InfoTip';

// What each failure cause means, as Claude is told when it sorts failures
// (server/claude/summary.mjs and failure.mjs → CAUSES).
const CAUSE_HELP: { cause: string; text: string }[] = [
  {
    cause: 'site',
    text: "The site doesn't do what the tests expect: a bug, or a change on the site the tests weren't updated for.",
  },
  {
    cause: 'test',
    text: 'The tests themselves are wrong: a bad locator, the wrong expected text, a mistake in the code.',
  },
  {
    cause: 'environment',
    text: 'Something got in the way: the site was down, slow, behind an error page, logged out, or missing the data the tests need.',
  },
  {
    cause: 'flaky',
    text: 'A timing or race problem; a retry or rerun would likely pass.',
  },
  {
    cause: 'unclear',
    text: "The errors don't say why.",
  },
];

// An "i" button next to an issue's cause badge that explains the causes.
export function FailureCauseTip() {
  return (
    <InfoTip label="About failure causes" align="start">
      <p className="status-help-intro">
        Claude's best guess at why the tests fail, one of{' '}
        {CAUSE_HELP.length} causes. It's a guess from the errors, so check
        before acting on it.
      </p>
      <dl className="status-help-list">
        {CAUSE_HELP.map(({ cause, text }) => (
          <div key={cause}>
            <dt>
              <Badge map={FAILURE_CAUSE} value={cause} />
            </dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
    </InfoTip>
  );
}
