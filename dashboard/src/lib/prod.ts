import type { PlanSummary } from '../api/types';

// No-prod plans ("Prod: No" in the header) and no-prod cases ("No" in the
// Prod column, or tests tagged @no-prod) never run on production: a run
// there refuses the plan or leaves the cases out. Mirrors planArgs in
// dashboard/server/runs/playwright.mjs.

// Why running `cases` of `plan` (all of them when empty) on production would
// run nothing, or null when something is left to run.
export function offProdReason(
  plan: PlanSummary,
  cases: string[] = [],
): string | null {
  if (plan.noProd)
    return `${plan.name} is no-prod, so it never runs on Production`;
  const noProd = new Set(plan.noProdCases);
  if (cases.length)
    return cases.every((id) => noProd.has(id))
      ? `${cases.join(', ')} ${cases.length > 1 ? 'are' : 'is'} no-prod, so ${cases.length > 1 ? 'they never run' : 'it never runs'} on Production`
      : null;
  const withTests = plan.cases.filter((c) => c.testCount > 0);
  return withTests.length > 0 && withTests.every((c) => c.noProd)
    ? `Every case of ${plan.name} is no-prod, so it never runs on Production`
    : null;
}

// The `playwright test` filter that drops the no-prod cases on production.
export const noProdGrep = (ids: string[]) => `'\\b(?:${ids.join('|')})(?!\\d)'`;
