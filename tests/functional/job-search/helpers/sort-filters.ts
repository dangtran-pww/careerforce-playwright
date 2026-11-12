import type { Locator, Page } from '@playwright/test';

import { expect } from '../fixtures';
import type { JobSearchPage } from '../../../pages/job-search.page';

// Helpers for test-suites/job-search/functional-job-search-sort-filters-paging.md
// (sort-filters.spec.ts and paging-url-state.spec.ts).

export const KEYWORD = 'nurse';

// The sort choices: the address value and the start of the dropdown label
// ("Job Title A-Z", "Company A-Z", "Date Posted", "Relevance").
export const SORT = {
  relevance: { value: 'best-match', label: /^Relevance/i },
  title: { value: 'job-title-asc', label: /^Job title/i },
  company: { value: 'company-asc', label: /^Company/i },
  date: { value: 'date-posted-desc', label: /^Date posted/i },
} as const;

// The line under a job's title: the company, then the city.
export function cardCity(card: Locator): Locator {
  return card.locator('div.tw-font-semibold > span').nth(1);
}

function clean(text: string | null): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

// The text of one field of every job on the page, in page order.
export async function cardTexts(
  jobs: JobSearchPage,
  field: 'title' | 'company' | 'posted',
): Promise<string[]> {
  const values: string[] = [];
  for (const card of await jobs.cards.all()) {
    const locator =
      field === 'title'
        ? jobs.cardTitle(card)
        : field === 'company'
          ? jobs.cardCompany(card)
          : jobs.cardPosted(card);
    values.push(clean(await locator.first().textContent()));
  }
  return values;
}

// "Posted 3 days ago" → 3 (days). "Available 2 hours ago" is read the same
// way. "today" and "just now" are 0. Any other wording fails, so a new one
// shows up instead of being skipped.
const DAYS_PER_UNIT: Record<string, number> = {
  minute: 1 / 1440,
  hour: 1 / 24,
  day: 1,
  week: 7,
  month: 30,
  year: 365,
};

export function ageInDays(label: string): number {
  const text = clean(label);
  if (/^(Posted|Available) (today|just now)$/i.test(text)) return 0;
  if (/^(Posted|Available) yesterday$/i.test(text)) return 1;
  const match = text.match(
    /^(?:Posted|Available) (\d+|an?) (minute|hour|day|week|month|year)s? ago$/i,
  );
  expect(match, `Can't read the date of "${text}"`).not.toBeNull();
  const count = /^\d+$/.test(match![1]) ? Number(match![1]) : 1;
  return count * DAYS_PER_UNIT[match![2].toLowerCase()];
}

// Titles and companies are compared ignoring letter case and leading or
// trailing spaces; other characters as they are.
function key(text: string): string {
  return text.trim().toLowerCase();
}

// A–Z within one list. `where` names the list in the message ("page 1").
export function expectAtoZ(values: string[], what: string, where: string) {
  expect(values.length, `${where} should list at least 1 job`).toBeGreaterThan(0);
  for (let i = 1; i < values.length; i++) {
    expect(
      key(values[i - 1]) <= key(values[i]),
      `${what} A–Z on ${where}: "${values[i - 1]}" (job ${i}) should come before "${values[i]}" (job ${i + 1})`,
    ).toBe(true);
  }
}

// Across the page break: the last of page 1 comes before (or equals) the
// first of page 2.
export function expectAtoZAcross(page1: string[], page2: string[], what: string) {
  const last = page1[page1.length - 1];
  const first = page2[0];
  expect(
    key(last) <= key(first),
    `${what} A–Z across the page break: the last on page 1 ("${last}") should come before the first on page 2 ("${first}")`,
  ).toBe(true);
}

// Newest to oldest. Equal labels may come in any order.
export function expectNewestFirst(labels: string[], where: string) {
  expect(labels.length, `${where} should list at least 1 job`).toBeGreaterThan(0);
  const ages = labels.map(ageInDays);
  for (let i = 1; i < ages.length; i++) {
    expect(
      ages[i],
      `Newest first on ${where}: "${labels[i]}" (job ${i + 1}) should not be newer than "${labels[i - 1]}" (job ${i})`,
    ).toBeGreaterThanOrEqual(ages[i - 1]);
  }
}

// Runs `action` (a click on Search, Filter or a pager link, or a Sort
// change) and waits until the page it opens has loaded. Every Job Search
// form is a GET form that reloads the page; a re-submit can open the same
// address again, so this waits for the navigation itself, not for the
// address to change.
export async function submitAndWait(page: Page, action: () => Promise<unknown>) {
  const request = page.waitForRequest(
    (r) => r.isNavigationRequest() && r.frame() === page.mainFrame(),
  );
  await action();
  const url = new URL((await request).url()).href;
  await page.waitForURL((current) => current.href === url);
  await page.waitForLoadState();
}

// The values the search form, filters and sort show.
export type FormValues = {
  keyword: string;
  location: string;
  distance: string;
  sort: string;
  company: string;
  city: string;
};

export async function formValues(jobs: JobSearchPage): Promise<FormValues> {
  return {
    keyword: await jobs.keywordInput.inputValue(),
    location: await jobs.locationInput.inputValue(),
    distance: await jobs.distanceSelect.inputValue(),
    sort: await jobs.sortSelect.inputValue(),
    company: await jobs.companySelect.inputValue(),
    city: await jobs.citySelect.inputValue(),
  };
}

// Checks the address has each value and the matching form field shows it.
// `null` means the value is not in the address (or is empty).
export async function expectSearchKept(
  jobs: JobSearchPage,
  expected: {
    title?: string;
    location?: string;
    radius?: string;
    sort?: string;
    company?: string;
    loc?: string;
  },
  when: string,
) {
  const params = jobs.params();
  const fields: Array<[string, string | undefined, Locator]> = [
    ['title', expected.title, jobs.keywordInput],
    ['location[text]', expected.location, jobs.locationInput],
    ['radius', expected.radius, jobs.distanceSelect],
    ['sort', expected.sort, jobs.sortSelect],
    ['company', expected.company, jobs.companySelect],
    ['loc', expected.loc, jobs.citySelect],
  ];
  for (const [param, value, field] of fields) {
    if (value === undefined) continue;
    expect
      .soft(params.get(param), `${when}: the address should have ${param}=${value}`)
      .toBe(value);
    await expect
      .soft(field, `${when}: the form should still show ${param} "${value}"`)
      .toHaveValue(value);
  }
}

// Every job on the page shows `company`.
export async function expectAllFromCompany(
  jobs: JobSearchPage,
  company: string,
  where: string,
) {
  await expect(jobs.cards.first(), `${where} should list at least 1 job`).toBeVisible();
  for (const [index, card] of (await jobs.cards.all()).entries()) {
    await expect(
      jobs.cardCompany(card),
      `${where}: job ${index + 1} should be from "${company}"`,
    ).toHaveText(company);
  }
}

// Every job on the page shows `city` in its location.
export async function expectAllInCity(jobs: JobSearchPage, city: string, where: string) {
  await expect(jobs.cards.first(), `${where} should list at least 1 job`).toBeVisible();
  for (const [index, card] of (await jobs.cards.all()).entries()) {
    await expect(
      cardCity(card),
      `${where}: job ${index + 1} should be in "${city}"`,
    ).toContainText(city);
  }
}

// The pager's numbered page links ("Page 2", "Current page 1"), and its
// "Next" / "Last" links.
export function pagerPageLink(jobs: JobSearchPage, number: number): Locator {
  return jobs.pager.getByRole('link', { name: `Page ${number}`, exact: true });
}

export function pagerNext(jobs: JobSearchPage): Locator {
  return jobs.pager.getByRole('link', { name: /\bNext\b/i });
}

export function pagerLast(jobs: JobSearchPage): Locator {
  return jobs.pager.getByRole('link', { name: /\bLast\b/i });
}

export function pagerCurrent(jobs: JobSearchPage): Locator {
  return jobs.pager.locator('[aria-current="page"]');
}

// The highest page number the pager links to, or 0 when it links to none.
export async function highestPagerNumber(jobs: JobSearchPage): Promise<number> {
  const names = await jobs.pager.getByRole('link').allTextContents();
  const numbers = names
    .map((name) => clean(name).match(/^Page (\d+)$/))
    .filter((match) => match !== null)
    .map((match) => Number(match![1]));
  return numbers.length > 0 ? Math.max(...numbers) : 0;
}
