// The list of plans on the suite page. Each tick calls onToggle(key, on).

import type { ReactNode } from 'react';
import type { Suite, SuitePlan } from '../../api/types';
import { PlanLogins } from '../../components/LoginBadges';
import { plural, testsSummary } from '../../lib/format';
import { PLAN_PANEL_ID } from './PlanPanel';

type OnToggle = (key: string, on: boolean) => void;

function Checklist({
  legend,
  children,
}: {
  legend: string;
  children: ReactNode[];
}) {
  return (
    <fieldset className="check-list">
      <legend>{legend}</legend>
      {children.length ? children : <p className="note">None.</p>}
    </fieldset>
  );
}

function Tick({
  checked,
  onToggle,
  disabled,
}: {
  checked: boolean;
  onToggle: (on: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onToggle(e.target.checked)}
    />
  );
}

export function PlanChecklist({
  suite,
  selected,
  onToggle,
  shownPlan,
  onShowPlan,
}: {
  suite: Suite;
  selected: Set<string>;
  onToggle: OnToggle;
  shownPlan: string | null; // plan whose details are in the side panel
  onShowPlan: (slug: string | null) => void;
}) {
  return (
    <Checklist legend="Test plans">
      {suite.plans.map((p) => (
        <div
          key={p.slug}
          className={
            shownPlan === p.slug ? 'check-row check-row-shown' : 'check-row'
          }
        >
          <PlanRow plan={p} selected={selected} onToggle={onToggle} />
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
        </div>
      ))}
    </Checklist>
  );
}

function PlanRow({
  plan: p,
  selected,
  onToggle,
}: {
  plan: SuitePlan;
  selected: Set<string>;
  onToggle: OnToggle;
}) {
  return (
    <label className="check">
      <Tick
        checked={selected.has(p.slug)}
        disabled={!p.runnable}
        onToggle={(on) => onToggle(p.slug, on)}
      />
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
    </label>
  );
}
