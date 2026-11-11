import type { PlanCase, PlanSummary } from '../api/types';

// "Not on prod" on a case that never runs on production, with the plan's
// reason as its tooltip. Warns when the plan marks it but its tests aren't
// tagged @no-prod yet (a plain `playwright test` on production would run
// them; the dashboard still leaves them out).
export function NoProdBadge({ testCase: c }: { testCase: PlanCase }) {
  if (!c.noProd) return null;
  const reason = c.noProdReason ?? 'Never runs on Production';
  return c.noProdUntagged ? (
    <span
      className="badge badge-bad small"
      title={`${reason}. Some of its tests aren't tagged @no-prod yet.`}
    >
      Not on prod · untagged
    </span>
  ) : (
    <span className="badge badge-warn small" title={reason}>
      Not on prod
    </span>
  );
}

// "Not on prod" on a no-prod plan (its cases don't get their own badge).
export function PlanNoProdBadge({ plan }: { plan: PlanSummary }) {
  if (plan.noProd)
    return (
      <span
        className={`badge small ${plan.noProdUntagged ? 'badge-bad' : 'badge-warn'}`}
        title={`${plan.noProdReason ?? 'Never runs on Production'}${plan.noProdUntagged ? ". Some of its tests aren't tagged @no-prod yet." : ''}`}
      >
        Not on prod{plan.noProdUntagged ? ' · untagged' : ''}
      </span>
    );
  if (!plan.noProdCases.length) return null;
  return (
    <span
      className="badge badge-warn small"
      title={`Left out on Production: ${plan.noProdCases.join(', ')}`}
    >
      {plan.noProdCases.length} not on prod
    </span>
  );
}

// A case's tags without @no-prod, which NoProdBadge already shows.
export const otherTags = (c: PlanCase) =>
  c.tags?.filter((t) => t !== 'no-prod');
