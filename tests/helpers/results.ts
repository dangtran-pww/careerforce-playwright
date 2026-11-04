import { expect } from './fixtures';

// What a filtered listing shows: the total it reports, plus something that
// identifies each item on the first page (a title, link or job ID), in page
// order. Used to tell whether two filters gave different results without
// relying on exact counts, which change with content.
export type Results = {
  total: number;
  items: string[];
};

function sameResults(a: Results, b: Results): boolean {
  return a.total === b.total && a.items.join('\n') === b.items.join('\n');
}

function describe(results: Results): string {
  const first = results.items.slice(0, 3).join(' / ');
  return `${results.total} results${first ? ` (${first})` : ''}`;
}

// The core FL check: with some results unfiltered, filter X and filter Y
// each return no more than the unfiltered list, and X and Y differ from each
// other (in total, or in which items are on the first page). An empty result
// is fine; only identical X and Y results fail.
export function expectFilterPairDiffers(
  all: Results,
  x: Results,
  y: Results,
  names: [string, string],
) {
  const [xName, yName] = names;
  expect(all.total, 'The unfiltered list should show at least 1 result').toBeGreaterThan(0);
  expect(x.total, `"${xName}" should not return more than no filter`).toBeLessThanOrEqual(
    all.total,
  );
  expect(y.total, `"${yName}" should not return more than no filter`).toBeLessThanOrEqual(
    all.total,
  );
  expect(
    sameResults(x, y),
    `"${xName}" and "${yName}" gave the same results: ${describe(x)}`,
  ).toBe(false);
}
