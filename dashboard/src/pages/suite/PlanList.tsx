// The list of plans on the suite page. Each plan's Details button opens it
// in the side panel, where it's run.

import type { Suite, SuitePlan } from '../../api/types';
import { PlanLogins } from '../../components/LoginBadges';
import { plural, testsSummary } from '../../lib/format';
import { PLAN_PANEL_ID } from './PlanPanel';

export function PlanList({
  suite,
  shownPlan,
  onShowPlan,
}: {
  suite: Suite;
  shownPlan: string | null; // plan whose details are in the side panel
  onShowPlan: (slug: string | null) => void;
}) {
  if (!suite.plans.length) return <p className="note">None.</p>;
  return (
    <ul className="check-list plan-list">
      {suite.plans.map((p) => (
        <li
          key={p.slug}
          className={
            shownPlan === p.slug ? 'check-row check-row-shown' : 'check-row'
          }
        >
          <PlanRow plan={p} />
          {p.found && (
            <button
              type="button"
              className="ghost small"
              aria-expanded={shownPlan === p.slug}
              aria-controls={PLAN_PANEL_ID}
              onClick={() => onShowPlan(shownPlan === p.slug ? null : p.slug)}
            >
              {shownPlan === p.slug ? 'Hide details' : 'Details'}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function PlanRow({ plan: p }: { plan: SuitePlan }) {
  return (
    <div className="check">
      <span>
        <strong>{p.found ? `${p.type} - ${p.name}` : p.slug}</strong>
        {p.runnable &&
          ` — ${p.caseCount != null ? `${plural(p.caseCount, 'case')} · ` : ''}${
            p.projectTests
              ? testsSummary(p.projectTests)
              : `${plural(p.testCount, 'test')} · ${p.projects.join(', ')}`
          }`}
      </span>
      {p.found && (
        <PlanLogins
          roleCases={p.roleCases}
          caseIds={p.caseIds}
          roles={p.roles}
        />
      )}
      {!p.found ? (
        <span className="badge badge-bad small">Not found</span>
      ) : (
        !p.runnable && (
          <span className="badge badge-neutral small">No tests yet</span>
        )
      )}
      {p.allNoProd ? (
        <span
          className="badge badge-warn small"
          title={
            p.noProd
              ? 'The plan is no-prod, so it is skipped on Production'
              : 'Every case is no-prod, so the plan is skipped on Production'
          }
        >
          Not on prod
        </span>
      ) : (
        (p.noProdCases?.length ?? 0) > 0 && (
          <span
            className="badge badge-warn small"
            title={`Left out on Production: ${p.noProdCases?.join(', ')}`}
          >
            {p.noProdCases?.length} not on prod
          </span>
        )
      )}
    </div>
  );
}
