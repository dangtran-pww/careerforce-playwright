import { useState } from 'react';
import { Link } from 'react-router';
import type { PlanSummary, PlansResponse } from '../api/types';
import { Badge } from '../components/Badge';
import { ActiveRunBanner, ErrorBox, Loading } from '../components/Callouts';
import { LastRunLink } from '../components/LastRunLink';
import { PlanRunButton } from '../components/PlanRunButton';
import { Table, VisuallyHidden } from '../components/Table';
import { useApi } from '../hooks/useApi';
import { useEnv } from '../hooks/useEnv';
import { testsSummary } from '../lib/format';
import { PLAN_STATUS } from '../lib/status';

// #/plans — every test plan, grouped by type, with a Run button each.
export function PlansPage() {
  const { currentEnv } = useEnv();
  // After Reload, ask the server to list Playwright's tests again.
  const [refresh, setRefresh] = useState(false);
  const { data, error, loading, reload } = useApi<PlansResponse>(
    `/api/plans?env=${currentEnv.id}${refresh ? '&refresh=1' : ''}`,
  );

  return (
    <>
      <div className="section-head">
        <h1>Test plans</h1>
        <button
          type="button"
          className="ghost"
          disabled={loading}
          onClick={() => {
            setRefresh(true);
            reload();
          }}
        >
          Reload
        </button>
      </div>
      <p className="lede">
        Every plan in test-plans/, and the tests that implement it. Run a plan
        with its default projects here, or open it to pick projects and cases.
      </p>
      {error ? (
        <ErrorBox>Couldn't load the plans: {error.message}</ErrorBox>
      ) : data ? (
        <PlanList {...data} />
      ) : (
        <Loading>
          Loading plans… (asking Playwright for its list of tests)
        </Loading>
      )}
    </>
  );
}

function PlanList({ plans, site, activeRun, listErrors }: PlansResponse) {
  const { currentEnv } = useEnv();
  const types = [...new Set(plans.map((p) => p.type))];
  return (
    <div>
      <p className="note">
        Runs on <strong>{currentEnv.name}</strong> ({site}). Last run shown is
        the last one on this environment.
      </p>
      {listErrors.length > 0 && (
        <ErrorBox>
          Playwright reported errors while listing tests:{' '}
          {listErrors.join('; ')}
        </ErrorBox>
      )}
      <ActiveRunBanner runId={activeRun} />
      {types.map((type) => (
        <section key={type} className="plan-group">
          <h2>{type}</h2>
          <PlanTable
            plans={plans.filter((p) => p.type === type)}
            activeRun={activeRun}
          />
        </section>
      ))}
    </div>
  );
}

function PlanTable({
  plans,
  activeRun,
}: {
  plans: PlanSummary[];
  activeRun: string | null;
}) {
  return (
    <Table
      rows={plans}
      rowKey={(plan) => plan.slug}
      columns={[
        { head: 'Plan', cell: (plan) => <PlanName plan={plan} /> },
        {
          head: 'Status',
          cell: (plan) => <Badge map={PLAN_STATUS} value={plan.status} />,
        },
        {
          head: 'Cases',
          cell: (plan) => (
            <>
              {plan.cases.length}
              {plan.runnable && (
                <div className="note small">
                  {testsSummary(plan.projects.filter((p) => p.selected))}
                </div>
              )}
            </>
          ),
        },
        {
          head: 'Last run',
          cell: (plan) => <LastRunLink run={plan.lastRun} />,
        },
        {
          head: <VisuallyHidden>Actions</VisuallyHidden>,
          className: 'cell-action',
          cell: (plan) => <RunAction plan={plan} activeRun={activeRun} />,
        },
      ]}
    />
  );
}

function PlanName({ plan }: { plan: PlanSummary }) {
  return (
    <>
      <Link to={`/plans/${plan.slug}`} className="strong">
        {plan.name}
      </Link>
      {plan.changesData && (
        <span
          className="badge badge-warn small"
          title="Creates, edits or deletes content. QA/Stage only."
        >
          Changes data
        </span>
      )}
      {plan.roles.length > 0 && (
        <div className="note small">Logs in as {plan.roles.join(', ')}</div>
      )}
    </>
  );
}

// Run the plan with its default projects, or say why it can't run.
function RunAction({
  plan,
  activeRun,
}: {
  plan: PlanSummary;
  activeRun: string | null;
}) {
  const { currentEnv } = useEnv();
  if (!plan.runnable) return <span className="note small">No tests yet</span>;
  if (plan.changesData && currentEnv.production)
    return <span className="note small">Not on Production</span>;
  const projects = plan.projects
    .filter((p) => p.selected)
    .map((p) => p.name)
    .join(', ');
  return (
    <PlanRunButton
      plan={plan}
      disabled={Boolean(activeRun)}
      title={activeRun ? 'Another run is in progress' : `Run with ${projects}`}
    >
      Run
    </PlanRunButton>
  );
}
