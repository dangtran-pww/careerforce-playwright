import type { Locator } from '@playwright/test';

import { expect } from '../fixtures';
import type { JobSearchPage } from '../../../pages/job-search.page';

// Helpers for tests/functional/job-search/search.spec.ts
// (test-suites/job-search/functional-job-search-search.md). Everything else comes from
// the shared page object, tests/pages/job-search.page.ts.

export type SearchForm = {
  keyword?: string;
  location?: string;
  // The Distance option's value, e.g. '5' for "5 miles".
  radius?: string;
};

// Opens /job-search with nothing after it, types the search in the form
// (no suggestion is picked) and clicks "Search". Fails if the search answers
// with an error page; otherwise waits for its results or the empty state.
export async function searchWithForm(jobs: JobSearchPage, form: SearchForm) {
  await jobs.page.goto('/job-search');
  await fillAndSearch(jobs, form);
}

// Types the search into the form already on the page and clicks "Search".
export async function fillAndSearch(jobs: JobSearchPage, form: SearchForm) {
  const status = await submitSearch(jobs, form);
  expect(
    status,
    `the search should load Job Search, not an error page (the site answered ${status} for ${jobs.page.url()})`,
  ).toBeLessThan(400);
  await jobs.resultSummary.or(jobs.noResults).first().waitFor();
}

// Types the search, clicks "Search" and returns the HTTP status of the page
// the search loads, without judging it.
export async function submitSearch(
  jobs: JobSearchPage,
  form: SearchForm,
): Promise<number> {
  const keyword = form.keyword ?? '';
  const location = form.location ?? '';
  await jobs.keywordInput.fill(keyword);
  await jobs.locationInput.fill(location);
  // Typing in Location opens the suggestions; close them so they can't
  // cover the Search button. Escape keeps what was typed.
  if (location !== '') await jobs.locationInput.press('Escape');
  if (form.radius) await jobs.distanceSelect.selectOption(form.radius);
  const page = jobs.page;
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.request().isNavigationRequest() &&
        r.request().frame() === page.mainFrame() &&
        new URL(r.url()).pathname === '/job-search' &&
        new URL(r.url()).searchParams.has('title'),
    ),
    jobs.searchButton.click(),
  ]);
  await page.waitForURL((url) => url.searchParams.has('title'));
  return response.status();
}

// The line under a job's title is "<company> <location>": the location is
// the second span.
export function cardLocation(card: Locator): Locator {
  return card.locator('div.tw-font-semibold > span').nth(1);
}

// "Posted 3 days ago" or "Available 2 days ago".
export function cardAgeLabel(card: Locator): Locator {
  return card
    .locator('span')
    .filter({ hasText: /^\s*(Posted|Available)\b[\s\S]*\bago\s*$/ });
}

export function cardSummary(card: Locator): Locator {
  return card.locator('.job-description__summary');
}

export function shareButton(card: Locator): Locator {
  return card.getByRole('button').and(card.getByTitle('Share', { exact: true }));
}

// The locations of the jobs on the page, trimmed. A job with no location
// gives ''.
export async function jobLocations(jobs: JobSearchPage): Promise<string[]> {
  const locations: string[] = [];
  for (const card of await jobs.cards.all()) {
    const line = cardLocation(card);
    locations.push(
      (await line.count()) === 0 ? '' : ((await line.textContent()) ?? '').trim(),
    );
  }
  return locations;
}

export async function jobTitles(jobs: JobSearchPage): Promise<string[]> {
  return (await jobs.cards.locator('h3').allTextContents()).map((t) =>
    t.replace(/\s+/g, ' ').trim(),
  );
}

// State codes and full names, for "the job is in <state>" checks.
export const STATES: Record<string, string> = {
  MN: 'Minnesota',
  WI: 'Wisconsin',
  SD: 'South Dakota',
  ND: 'North Dakota',
  IA: 'Iowa',
  IL: 'Illinois',
};

// True when a location line ends in ", ST" or the state's full name.
export function isInState(location: string, codes: string[]): boolean {
  return codes.some(
    (code) =>
      location.endsWith(`, ${code}`) ||
      (STATES[code] !== undefined && location.endsWith(STATES[code])),
  );
}

// Checks there is at least 1 job, and that every job on the page is in one
// of the given states.
export async function expectJobsIn(
  jobs: JobSearchPage,
  codes: string[],
  what: string,
) {
  await expect(
    jobs.cards.first(),
    `${what}: at least 1 job should be listed`,
  ).toBeVisible();
  const locations = await jobLocations(jobs);
  const wrong = locations.filter((location) => !isInState(location, codes));
  expect(
    wrong,
    `${what}: every job on the first page should be in ${codes
      .map((c) => STATES[c] ?? c)
      .join(' or ')}; these job locations aren't (all: ${locations.join(' ; ')})`,
  ).toEqual([]);
}

// Checks at least half the first page's job titles match `pattern`.
export async function expectMostTitlesMatch(
  jobs: JobSearchPage,
  pattern: RegExp,
  what: string,
) {
  await expect(
    jobs.cards.first(),
    `${what}: at least 1 job should be listed`,
  ).toBeVisible();
  const titles = await jobTitles(jobs);
  const matching = titles.filter((title) => pattern.test(title));
  expect(
    matching.length * 2,
    `${what}: at least half of the first page's job titles should match ${pattern} ` +
      `(${matching.length} of ${titles.length} do: ${titles.join(' ; ')})`,
  ).toBeGreaterThanOrEqual(titles.length);
}

// The friendly empty state: "No results found.", no jobs, no pager.
export async function expectEmptyState(jobs: JobSearchPage, what: string) {
  await expect(
    jobs.noResults,
    `${what}: the page should show the friendly "No results found." message`,
  ).toHaveText(/^\s*No results found\.?\s*$/);
  await expect(jobs.cards, `${what}: no jobs should be listed`).toHaveCount(0);
  await expect(jobs.pager, `${what}: there should be no pager`).toHaveCount(0);
}

// Either jobs are listed, or the friendly empty state shows.
export async function expectJobsOrEmptyState(
  jobs: JobSearchPage,
  what: string,
) {
  await jobs.cards.first().or(jobs.noResults).first().waitFor();
  if ((await jobs.cards.count()) > 0) {
    await expect(
      jobs.resultSummary,
      `${what}: the jobs listed should come with a "Showing N jobs" count`,
    ).toHaveText(/Showing\s+[\d,]+\s+jobs?/);
  } else {
    await expectEmptyState(jobs, what);
  }
}
