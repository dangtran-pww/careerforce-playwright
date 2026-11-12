import type { PlanSummary } from '../api/types';

// One case found by the header's case search.
export interface FoundCase {
  id: string;
  title: string;
  prompt: boolean;
  planSlug: string;
  planName: string;
  suite: string;
}

// Every case of every plan, ready to search.
export const allCases = (plans: PlanSummary[]): FoundCase[] =>
  plans.flatMap((p) =>
    p.cases.map((c) => ({
      id: c.id,
      title: c.title,
      prompt: c.kind === 'prompt',
      planSlug: p.slug,
      planName: p.name,
      suite: p.suite,
    })),
  );

// The cases whose ID starts with `query` (any case, spaces ignored): the
// exact match first, then by prefix and number, so "ss-1" gives SS-1,
// SS-10, SS-11 … At most `limit`.
export function findCases(query: string, cases: FoundCase[], limit = 10) {
  const q = query.replace(/\s+/g, '').toUpperCase();
  if (!q) return [];
  return cases
    .filter((c) => c.id.toUpperCase().startsWith(q))
    .sort(
      (a, b) =>
        Number(b.id.toUpperCase() === q) - Number(a.id.toUpperCase() === q) ||
        a.id.localeCompare(b.id, undefined, { numeric: true }),
    )
    .slice(0, limit);
}

// Where a case is shown: its suite page, with its plan's panel open and the
// case's row opened.
export const caseLink = (c: FoundCase) =>
  `/suites/${c.suite}?plan=${encodeURIComponent(c.planSlug)}&case=${encodeURIComponent(c.id)}`;
