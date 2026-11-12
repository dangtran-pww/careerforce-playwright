import type {
  Browser,
  Locator,
  Page,
  Request,
  TestInfo,
} from '@playwright/test';

import { test, expect, type SiteHealth } from '../fixtures';
import { DashboardPage } from '../../../pages/dashboard.page';
import { JobSearchPage } from '../../../pages/job-search.page';

// Shared by the specs of test-suites/job-search/functional-job-search-logged-in.md.
// Everything here works on the job seeker account the spec logs in as
// (useRole('jobseeker')), and never removes anything the test didn't add.

export const KEYWORD = 'nurse';
export const BOOKMARK_LIMIT = 15;
export const SEARCH_LIMIT = 5;
export const SAVED = 'Saved searches';
export const BOOKMARKED = 'Bookmarked jobs';
export const CAREER_GOALS = 'Career goals';
export const IN_DEMAND = 'In demand jobs';

// The jobs-for-me groups the site can offer.
export const JOBS_FOR_ME_GROUPS = [BOOKMARKED, SAVED, CAREER_GOALS, IN_DEMAND];

export function testName(suffix = ''): string {
  return `Playwright test ${Date.now()}${suffix ? ` ${suffix}` : ''}`;
}

export type Job = { jobId: string; title: string };
export type Option = { value: string; text: string };

// --- Bookmarks --------------------------------------------------------------

export function unbookmarkedCards(jobs: JobSearchPage): Locator {
  return jobs.cards.filter({
    has: jobs.page.locator('a.bookmark.bookmark--add'),
  });
}

export async function jobOf(jobs: JobSearchPage, card: Locator): Promise<Job> {
  const jobId = (await card.getAttribute('data-jvid')) ?? '';
  const title = ((await jobs.cardTitle(card).textContent()) ?? '').trim();
  expect(jobId, 'every job card has a data-jvid').not.toBe('');
  return { jobId, title };
}

// The first job on the current results page that isn't bookmarked.
export async function firstUnbookmarked(jobs: JobSearchPage): Promise<Job> {
  const card = unbookmarkedCards(jobs).first();
  await expect(
    card,
    'a job on this page that is not bookmarked yet',
  ).toBeVisible();
  return jobOf(jobs, card);
}

export async function bookmarkState(
  jobs: JobSearchPage,
  jobId: string,
): Promise<'add' | 'remove' | 'other'> {
  const cls =
    (await jobs.bookmarkLink(jobs.card(jobId)).getAttribute('class')) ?? '';
  if (/\bbookmark--remove\b/.test(cls)) return 'remove';
  if (/\bbookmark--add\b/.test(cls)) return 'add';
  return 'other';
}

// Clicks a job's bookmark icon and waits for it to switch to `to`.
export async function toggleBookmark(
  jobs: JobSearchPage,
  jobId: string,
  to: 'add' | 'remove',
) {
  const link = jobs.bookmarkLink(jobs.card(jobId));
  await link.click();
  await expect(link).toHaveClass(new RegExp(`\\bbookmark--${to}\\b`));
}

// The job IDs the dashboard lists under "Bookmarked jobs", in order.
export async function dashboardBookmarkIds(
  dashboard: DashboardPage,
): Promise<string[]> {
  await dashboard.open('Bookmarked jobs');
  const hrefs = await dashboard
    .items(dashboard.bookmarks)
    .locator('a:not(.remove-field-link)')
    .evaluateAll((els) => els.map((el) => el.getAttribute('href') ?? ''));
  return hrefs.map(jvidOf);
}

export function jvidOf(href: string): string {
  return href.match(/[?&]jvid=([0-9a-zA-Z]+)/)?.[1] ?? '';
}

export async function expectBookmarkRoom(
  dashboard: DashboardPage,
  needed: number,
): Promise<string[]> {
  await dashboard.goto();
  const ids = await dashboardBookmarkIds(dashboard);
  expect(
    ids.length,
    `The job seeker account has ${ids.length} of ${BOOKMARK_LIMIT} bookmarks; ` +
      `this test needs ${needed} free. Remove some by hand (dashboard, "x").`,
  ).toBeLessThanOrEqual(BOOKMARK_LIMIT - needed);
  return ids;
}

// --- Saved searches ---------------------------------------------------------

export async function expectSearchRoom(
  dashboard: DashboardPage,
  needed: number,
): Promise<string[]> {
  await dashboard.goto();
  const names = await dashboard.savedSearchNames();
  expect(
    names.length,
    `The job seeker account has ${names.length} of ${SEARCH_LIMIT} saved searches; ` +
      `this test needs ${needed} free. Remove some by hand (dashboard, "x").`,
  ).toBeLessThanOrEqual(SEARCH_LIMIT - needed);
  return names;
}

// Saves the current page's search and waits for the dialog to close (it
// closes only when the save worked).
export async function saveCurrentSearch(jobs: JobSearchPage, name: string) {
  await jobs.saveSearch(name);
  await expect(jobs.saveSearchDialog).toBeHidden();
}

export function saveDialogParts(jobs: JobSearchPage) {
  const dialog = jobs.saveSearchDialog;
  return {
    dialog,
    nameBox: dialog.getByLabel('Name job search'),
    save: dialog.getByRole('button', { name: 'Save', exact: true }),
    close: dialog.getByRole('button', { name: /^close$/i }),
    limitWarning: dialog.getByText(
      'You have already reached the limit for saved jobs.',
    ),
  };
}

// Removes every saved search whose name starts with `prefix` (a name the
// test made, e.g. `Playwright test <timestamp>`), for names the site may
// have cut short.
export async function cleanUpSearchesStartingWith(
  dashboard: DashboardPage,
  prefix: string,
) {
  await dashboard.goto();
  const names = (await dashboard.savedSearchNames()).filter((n) =>
    n.startsWith(prefix),
  );
  await dashboard.cleanUp({ searches: [...new Set(names)] });
}

// --- Jobs for me ------------------------------------------------------------

export async function jobsForMeGroups(jobs: JobSearchPage): Promise<string[]> {
  return jobs.jobsForMeCategory
    .locator('option')
    .evaluateAll((els) =>
      els
        .filter((el) => (el as HTMLOptionElement).value !== '')
        .map((el) => el.textContent?.trim() ?? ''),
    );
}

// A group's items with their values (relative addresses such as
// `?jvid=<ID>` or `?title=...&delta=<n>`), or [] when the group isn't offered.
export async function jobsForMeOptions(
  jobs: JobSearchPage,
  group: string,
): Promise<Option[]> {
  if (!(await jobsForMeGroups(jobs)).includes(group)) return [];
  await jobs.jobsForMeCategory.selectOption({ label: group });
  const options = await jobs.jobsForMeItem
    .locator('option')
    .evaluateAll((els) =>
      els
        .map((el) => ({
          value: (el as HTMLOptionElement).value,
          text: el.textContent?.trim() ?? '',
        }))
        .filter((o) => o.value !== ''),
    );
  await jobs.jobsForMeCategory.selectOption({ index: 0 });
  return options;
}

// Picks a Jobs for me item by its value and waits for the page it opens.
export async function pickJobsForMe(
  jobs: JobSearchPage,
  group: string,
  value: string,
) {
  await jobs.jobsForMeCategory.selectOption({ label: group });
  await waitForNewPage(jobs.page, () =>
    jobs.jobsForMeItem.selectOption({ value }),
  );
}

// Runs `action` and waits until it has loaded a new page in the tab.
export async function waitForNewPage(
  page: Page,
  action: () => Promise<unknown>,
) {
  const navigated = page.waitForEvent('framenavigated', {
    predicate: (frame) => frame === page.mainFrame(),
  });
  await action();
  await navigated;
  await page.waitForLoadState('load');
}

// Runs `action` and returns the pages the tab started loading meanwhile. A
// script that changes the page does it in the same event handler, so the
// request has started by the time a round trip to the page comes back.
export async function pagesLoadedDuring(
  page: Page,
  action: () => Promise<unknown>,
): Promise<string[]> {
  const loaded: string[] = [];
  const onRequest = (request: Request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      loaded.push(request.url());
    }
  };
  page.on('request', onRequest);
  try {
    await action();
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(resolve)),
    );
  } finally {
    page.off('request', onRequest);
  }
  return loaded;
}

// --- Account state ----------------------------------------------------------

export type AccountState = { searches: string[]; bookmarks: string[] };

export async function accountState(page: Page): Promise<AccountState> {
  const dashboard = new DashboardPage(page);
  await dashboard.goto();
  return {
    searches: await dashboard.savedSearchNames(),
    bookmarks: [...(await dashboardBookmarkIds(dashboard))].sort(),
  };
}

// "Checked in every case → Clean up": the account's saved searches and
// bookmarks after the case are what they were before it. Call inside a
// describe that uses useRole('jobseeker').
export function checkAccountUnchanged() {
  let before: AccountState | undefined;
  test.beforeEach(async ({ page }) => {
    before = await accountState(page);
  });
  test.afterEach(async ({ page }) => {
    if (!before) return;
    const after = await accountState(page);
    expect
      .soft(after, 'Clean up: saved searches and bookmarks are as before')
      .toEqual(before);
  });
}

// The job seeker's own tools on Job Search (also used by PV-1).
export async function expectJobSeekerTools(page: Page) {
  const jobs = new JobSearchPage(page);
  await expect(jobs.cards.first()).toBeVisible();

  await test.step('no "Customize my search"', async () => {
    await expect(page.getByText('Customize my search')).toHaveCount(0);
  });

  await test.step('Jobs for me lists only groups with items', async () => {
    await expect(jobs.jobsForMeCategory).toBeVisible();
    const groups = await jobsForMeGroups(jobs);
    expect(groups.length, 'Jobs for me lists at least 1 group').toBeGreaterThan(
      0,
    );
    for (const group of groups) {
      expect(JOBS_FOR_ME_GROUPS, `"${group}" is a known group`).toContain(
        group,
      );
      expect(
        (await jobs.jobsForMeItems(group)).length,
        `"${group}" is listed, so it has items`,
      ).toBeGreaterThan(0);
    }
  });

  await test.step('Save search opens the save dialog', async () => {
    const { dialog, nameBox, close } = saveDialogParts(jobs);
    await jobs.openSaveSearchDialog();
    await expect(nameBox).toBeVisible();
    await expect(
      page.getByRole('dialog').filter({ hasText: /log ?in/i }),
      'not the login dialog',
    ).toHaveCount(0);
    await close.click();
    await expect(dialog).toBeHidden();
  });

  await test.step('bookmark icons add or remove, not log in', async () => {
    const icons = await jobs.cards.locator('a.bookmark').evaluateAll((els) =>
      els.map((el) => ({
        cls: el.getAttribute('class') ?? '',
        href: el.getAttribute('href') ?? '',
      })),
    );
    expect(icons.length).toBeGreaterThan(0);
    for (const { cls, href } of icons) {
      expect(cls, 'bookmark icon state').toMatch(/\bbookmark--(add|remove)\b/);
      expect(href, 'bookmark icon is not the login dialog').not.toContain(
        'anonymous_modal',
      );
    }
  });
}

// --- Visitor ----------------------------------------------------------------

// A fresh browser that isn't logged in: the project's site and Basic Auth,
// no saved session. Its pages are watched like the test's own.
export async function visitorPage(
  browser: Browser,
  testInfo: TestInfo,
  siteHealth: SiteHealth,
): Promise<Page> {
  const { baseURL, httpCredentials, ignoreHTTPSErrors } = testInfo.project.use;
  const context = await browser.newContext({
    baseURL,
    httpCredentials,
    ignoreHTTPSErrors,
  });
  const page = await context.newPage();
  siteHealth.watch(page);
  return page;
}

// Every browser dialog (alert, confirm) a page opens, dismissed.
export function recordDialogs(page: Page): string[] {
  const messages: string[] = [];
  page.on('dialog', (dialog) => {
    messages.push(`${dialog.type()}: ${dialog.message()}`);
    void dialog.dismiss().catch(() => undefined);
  });
  return messages;
}

// True when the page doesn't scroll sideways.
export async function fitsWidth(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );
}

// True when the element sits inside the screen's width.
export async function insideViewport(element: Locator): Promise<boolean> {
  return element.evaluate((el) => {
    const box = el.getBoundingClientRect();
    return box.left >= -1 && box.right <= window.innerWidth + 1;
  });
}
