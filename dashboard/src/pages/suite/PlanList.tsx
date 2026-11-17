// The list of plans on the suite page, one row per plan: its name with its
// status, a muted line with its cases, tests and logins, and its Run and
// Details buttons. Run runs every case
// of the plan, like the panel's Run plan button; Details opens it in the side
// panel, where its cases can be run one by one. Plans with nothing to run
// come last, under their own heading, so the ones you can run stay together.

import type { Suite, SuitePlan } from '../../api/types';
import { Badge } from '../../components/Badge';
import { PlanLogins } from '../../components/LoginBadges';
import { PlanRunButton } from '../../components/PlanRunButton';
import { useEnv } from '../../hooks/useEnv';
import { plural, testsSummary } from '../../lib/format';
import { PLAN_STATUS } from '../../lib/status';
import { PLAN_PANEL_ID } from './PlanPanel';
import { RunRefused, useRunRefusal } from './RunRefused';

interface RowProps {
  shownPlan: string | null; // plan whose details are in the side panel
  onShowPlan: (slug: string | null) => void;
  suite: string;
  activeRun: string | null; // the run in progress on this environment
  onRunError: (err: Error) => void;
}

export function PlanList({
  suite,
  shownPlan,
  onShowPlan,
  activeRun,
}: {
  suite: Suite;
  shownPlan: string | null;
  onShowPlan: (slug: string | null) => void;
  activeRun: string | null;
}) {
  // Why the last row Run press didn't start a run (a login not ready opens
  // the Login sessions panel too).
  const { refusal, onError } = useRunRefusal();
  if (!suite.plans.length) return <p className="note">None.</p>;
  // In the suite's order within each group: the order its run takes.
  const runnable = suite.plans.filter((p) => p.runnable);
  const idle = suite.plans.filter((p) => !p.runnable);
  const rowProps: RowProps = {
    shownPlan,
    onShowPlan,
    suite: suite.slug,
    activeRun,
    onRunError: onError,
  };
  return (
    <>
      {refusal && <RunRefused refusal={refusal} />}
      {runnable.length > 0 && <Rows plans={runnable} {...rowProps} />}
      {idle.length > 0 && (
        <>
          <h3 className="plan-group-title">
            No tests yet <span className="note">({idle.length})</span>
          </h3>
          <Rows plans={idle} {...rowProps} />
        </>
      )}
    </>
  );
}

function Rows({ plans, ...rowProps }: RowProps & { plans: SuitePlan[] }) {
  return (
    <ul className="plan-list">
      {plans.map((p) => (
        <PlanRow key={p.slug} plan={p} {...rowProps} />
      ))}
    </ul>
  );
}

function PlanRow({
  plan: p,
  shownPlan,
  onShowPlan,
  suite,
  activeRun,
  onRunError,
}: RowProps & { plan: SuitePlan }) {
  const shown = shownPlan === p.slug;
  return (
    <li className={shown ? 'plan-row plan-row-shown' : 'plan-row'}>
      <div className="plan-row-main">
        <div className="plan-row-title">
          <strong>{p.found ? p.name : p.slug}</strong>
          {!p.found ? (
            <span className="badge badge-bad small">Not found</span>
          ) : (
            p.status && <Badge map={PLAN_STATUS} value={p.status} small />
          )}
          <ProdBadge plan={p} />
        </div>
        {p.found && <PlanMeta plan={p} />}
      </div>
      {p.found && (
        <div className="plan-row-actions">
          {p.runnable && (
            <RowRunButton
              plan={p}
              suite={suite}
              activeRun={activeRun}
              onError={onRunError}
            />
          )}
          <button
            type="button"
            className="ghost small"
            aria-expanded={shown}
            aria-controls={PLAN_PANEL_ID}
            onClick={() => onShowPlan(shown ? null : p.slug)}
          >
            {shown ? 'Hide details' : 'Details'}
          </button>
        </div>
      )}
    </li>
  );
}

// "21 cases · 69 tests · No login", with the tests per project on hover.
function PlanMeta({ plan: p }: { plan: SuitePlan }) {
  const tests = p.projectTests
    ? testsSummary(p.projectTests)
    : `${plural(p.testCount, 'test')} · ${p.projects.join(', ')}`;
  return (
    <div className="plan-row-meta note small">
      {p.caseCount != null && <span>{plural(p.caseCount, 'case')}</span>}
      {p.runnable && <span title={tests}>{plural(p.testCount, 'test')}</span>}
      <PlanLogins roleCases={p.roleCases} caseIds={p.caseIds} roles={p.roles} />
    </div>
  );
}

// Whether the plan runs on Production. A fact, not a problem, so it's a
// neutral badge.
function ProdBadge({ plan: p }: { plan: SuitePlan }) {
  if (p.allNoProd)
    return (
      <span
        className="badge badge-neutral small"
        title={
          p.noProd
            ? 'The plan is no-prod, so it is skipped on Production'
            : 'Every case is no-prod, so the plan is skipped on Production'
        }
      >
        Not on prod
      </span>
    );
  const count = p.noProdCases?.length ?? 0;
  if (!count) return null;
  return (
    <span
      className="badge badge-neutral small"
      title={`Left out on Production: ${p.noProdCases?.join(', ')}`}
    >
      {count} not on prod
    </span>
  );
}

// Runs every case of the plan on the header's environment, in the projects
// the suite runs it in, and opens the run's page. Off on Production when
// nothing in the plan runs there, and while another run is going.
function RowRunButton({
  plan: p,
  suite,
  activeRun,
  onError,
}: {
  plan: SuitePlan;
  suite: string;
  activeRun: string | null;
  onError: (err: Error) => void;
}) {
  const { currentEnv } = useEnv();
  const offProd = currentEnv.production && p.allNoProd;
  return (
    <PlanRunButton
      plan={p}
      className="small"
      body={{ projects: p.projects.length ? p.projects : undefined, suite }}
      onError={onError}
      busyLabel={p.roles?.length ? 'Checking logins…' : 'Starting…'}
      disabled={Boolean(activeRun) || offProd}
      aria-label={`Run ${p.name} on ${currentEnv.name}`}
      title={
        activeRun
          ? `Another run is in progress on ${currentEnv.name}`
          : offProd
            ? `Nothing in ${p.name} runs on Production`
            : `Run every case of ${p.name} on ${currentEnv.name}`
      }
    >
      Run
    </PlanRunButton>
  );
}
