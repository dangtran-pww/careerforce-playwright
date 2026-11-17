import { PLAN_STATUS } from '../lib/status';
import { Badge } from './Badge';
import { InfoTip } from './InfoTip';

// What each plan status means, from test-suites/README.md → "Status on
// every plan", in the order a plan usually moves through them.
const STATUS_HELP: { status: string; text: string }[] = [
  {
    status: 'ready to generate',
    text: 'No test script yet. The plan is ready to be turned into one.',
  },
  {
    status: 'partially implemented',
    text: 'Some cases have tests; new cases are waiting to be generated.',
  },
  {
    status: 'needs update',
    text: 'Cases that already have tests have changed, so the test file no longer matches the plan.',
  },
  {
    status: 'implemented',
    text: 'The test script exists, has been verified and matches every case in the plan.',
  },
];

// An "i" button next to a plan's status badge that explains the statuses.
export function PlanStatusTip() {
  return (
    <InfoTip label="About plan statuses" align="start">
      <p className="plan-status-intro">
        Does the test file match the plan? If not, what work is needed?
      </p>
      <dl className="plan-status-list">
        {STATUS_HELP.map(({ status, text }) => (
          <div key={status}>
            <dt>
              <Badge map={PLAN_STATUS} value={status} />
            </dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
    </InfoTip>
  );
}
