import type { Page } from '@playwright/test';

import { test, expect } from '../fixtures';
import { useRole } from '../../../helpers/roles';
import { DashboardPage } from '../../../pages/dashboard.page';
import { JobSearchPage } from '../../../pages/job-search.page';
import {
  KEYWORD,
  checkAccountUnchanged,
  dashboardBookmarkIds,
  expectBookmarkRoom,
  expectJobSeekerTools,
  expectSearchRoom,
  firstUnbookmarked,
  saveCurrentSearch,
  testName,
  toggleBookmark,
  visitorPage,
} from './helpers';

// [Functional] - Job Search - Logged-in Job Seeker - Test Plan, PV-1 to PV-5.
// See test-suites/job-search/functional-job-search-logged-in.md.
//
// PV-1 to PV-3 change the job seeker account (@no-prod). PV-4 only looks,
// and PV-5 runs as a visitor, so both may run on Production. All desktop
// only.

const BOOKMARK_PATH = '/careerforce/ajax/job-post/add/';
const REMOVE_SEARCH_PATH = '/careerforce/ajax/job-search/remove/';
// "Refused (403 or similar)".
const REFUSED = [400, 401, 403];

// The visitor's Job Search: no job seeker's tools or data.
async function expectVisitorPage(
  page: Page,
  {
    searches,
    bookmarkTitles,
  }: { searches: string[]; bookmarkTitles: string[] },
) {
  const jobs = new JobSearchPage(page);
  await expect(jobs.cards.first()).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Customize my search' }),
    '"Customize my search" shows',
  ).toBeVisible();
  await expect(
    page.locator('a.bookmark.bookmark--remove'),
    'no "remove bookmark" state',
  ).toHaveCount(0);
  const hrefs = await jobs.cards
    .locator('a.bookmark')
    .evaluateAll((els) => els.map((el) => el.getAttribute('href') ?? ''));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) {
    expect(href, 'bookmark icons open the login dialog').toContain(
      'job_search_anonymous_modal',
    );
  }
  await expect(jobs.jobsForMeItem, 'no Jobs for me items').toHaveCount(0);
  const options = (await page.locator('option').allTextContents()).map((t) =>
    t.trim(),
  );
  for (const name of [...searches, ...bookmarkTitles]) {
    expect(options, `"${name}" is not offered anywhere`).not.toContain(name);
  }
}

// An address with its `token` taken out, or replaced.
function withToken(href: string, base: string, token?: string): string {
  const url = new URL(href, base);
  url.searchParams.delete('token');
  if (token !== undefined) url.searchParams.set('token', token);
  return `${url.pathname}${url.search}`;
}

test.describe('privacy (job seeker)', { tag: '@desktop-only' }, () => {
  useRole('jobseeker');

  test.describe('changes the account', { tag: '@no-prod' }, () => {
    checkAccountUnchanged();

    test("PV-1: a job seeker's page isn't shown to a visitor", async ({
      page,
      browser,
      siteHealth,
    }, testInfo) => {
      const jobs = new JobSearchPage(page);
      const dashboard = new DashboardPage(page);
      const added: string[] = [];
      await expectBookmarkRoom(dashboard, 1);

      try {
        await jobs.search({ title: KEYWORD });
        const job = await firstUnbookmarked(jobs);
        added.push(job.jobId);
        await toggleBookmark(jobs, job.jobId, 'remove');

        await dashboard.goto();
        const searches = await dashboard.savedSearchNames();
        await dashboard.open('Bookmarked jobs');
        const bookmarkTitles = (
          await dashboard
            .items(dashboard.bookmarks)
            .locator('a:not(.remove-field-link)')
            .allTextContents()
        ).map((t) => t.trim());

        await jobs.search({ title: KEYWORD });
        await expect(jobs.cards.first()).toBeVisible();

        const visitor = await visitorPage(browser, testInfo, siteHealth);
        try {
          await test.step('the visitor, after the job seeker', async () => {
            await visitor.goto(`/job-search?title=${KEYWORD}`);
            await expectVisitorPage(visitor, { searches, bookmarkTitles });
          });
          await test.step('the job seeker, after the visitor', async () => {
            await visitor.goto('/job-search?title=welder');
            await expectVisitorPage(visitor, { searches, bookmarkTitles });
            await page.goto('/job-search?title=welder');
            await expectJobSeekerTools(page);
          });
        } finally {
          await visitor.context().close();
        }
      } finally {
        await dashboard.cleanUp({ jobIds: added });
      }
    });

    test("PV-2: the bookmark link needs the page's security token", async ({
      page,
      siteHealth,
    }) => {
      const jobs = new JobSearchPage(page);
      const dashboard = new DashboardPage(page);
      siteHealth.allowStatus(BOOKMARK_PATH, REFUSED);
      let jobId = '';
      await expectBookmarkRoom(dashboard, 1);

      try {
        await jobs.search({ title: KEYWORD });
        ({ jobId } = await firstUnbookmarked(jobs));
        const href =
          (await jobs.bookmarkLink(jobs.card(jobId)).getAttribute('href')) ??
          '';
        expect(href, 'the bookmark link carries a token').toMatch(
          new RegExp(`${BOOKMARK_PATH}${jobId}\\?(.*&)?token=`),
        );

        for (const [label, token] of [
          ['no token', undefined],
          ['a wrong token', 'not-the-right-token'],
        ] as const) {
          await test.step(label, async () => {
            const response = await page.goto(
              withToken(href, page.url(), token),
            );
            expect(REFUSED, 'refused').toContain(response?.status());
          });
        }

        await dashboard.goto();
        expect(
          await dashboardBookmarkIds(dashboard),
          'the job is not bookmarked',
        ).not.toContain(jobId);
      } finally {
        if (jobId) await dashboard.cleanUp({ jobIds: [jobId] });
      }
    });

    test("PV-3: the remove-search link needs the page's security token", async ({
      page,
      siteHealth,
    }) => {
      const jobs = new JobSearchPage(page);
      const dashboard = new DashboardPage(page);
      siteHealth.allowStatus(REMOVE_SEARCH_PATH, REFUSED);
      const name = testName();
      await expectSearchRoom(dashboard, 1);

      try {
        await jobs.search({ title: KEYWORD });
        await saveCurrentSearch(jobs, name);

        await dashboard.goto();
        await dashboard.open('Saved searches');
        const href =
          (await dashboard
            .removeLink(dashboard.savedSearch(name))
            .getAttribute('href')) ?? '';
        expect(href, 'the "x" link carries a token').toMatch(
          new RegExp(`${REMOVE_SEARCH_PATH}\\d+/[^/?]+\\?(.*&)?token=`),
        );
        const base = page.url();

        for (const [label, token] of [
          ['no token', undefined],
          ['a wrong token', 'not-the-right-token'],
        ] as const) {
          await test.step(label, async () => {
            const response = await page.goto(withToken(href, base, token));
            expect(REFUSED, 'refused').toContain(response?.status());
          });
        }

        await dashboard.goto();
        expect(
          await dashboard.savedSearchNames(),
          'the search is still listed',
        ).toContain(name);
      } finally {
        await dashboard.cleanUp({ searches: [name] });
      }
    });
  });

  test("PV-4: someone else's dashboard is private", async ({
    page,
    siteHealth,
  }) => {
    siteHealth.allowStatus('/user/1', [403, 404]);
    const dashboard = new DashboardPage(page);
    const response = await page.goto('/user/1');
    expect(
      new URL(page.url()).pathname,
      'still /user/1, not redirected to a dashboard',
    ).toBe('/user/1');
    expect([403, 404], '"Access denied" or "Page not found"').toContain(
      response?.status(),
    );
    await expect(
      page.getByText(/access denied|page not found/i).first(),
    ).toBeVisible();
    await expect(dashboard.savedSearches, 'no saved searches').toHaveCount(0);
    await expect(dashboard.bookmarks, 'no bookmarked jobs').toHaveCount(0);
  });
});

test.describe('privacy (visitor)', { tag: '@desktop-only' }, () => {
  test("PV-5: the job seeker's tools refuse a visitor", async ({
    page,
    siteHealth,
  }) => {
    const jobs = new JobSearchPage(page);
    await jobs.search({ title: KEYWORD });
    const jobId = (await jobs.cards.first().getAttribute('data-jvid')) ?? '';
    expect(jobId, 'a job ID from the feed').not.toBe('');

    const addresses = [
      '/careerforce/ajax/jobs-for-me',
      '/careerforce/forms/job_search_authenticated_modal',
      `${BOOKMARK_PATH}${jobId}`,
    ];
    for (const address of addresses) {
      siteHealth.allowStatus(address, [403]);
      await test.step(address, async () => {
        const response = await page.goto(address);
        const onLogin = new URL(page.url()).pathname === '/user/login';
        expect(
          onLogin || response?.status() === 403,
          'refused (403) or sent to the login page',
        ).toBe(true);
        if (!onLogin) {
          // A 403 answer: nothing of the job seeker's in it.
          const body = (await response?.text()) ?? '';
          expect(body, 'no list of jobs or searches').not.toMatch(
            /[?&]jvid=|[?&]delta=/,
          );
          expect(body, 'no bookmark').not.toContain('bookmark--remove');
        }
        await expect(
          page.getByLabel('Name job search'),
          'no save form',
        ).toHaveCount(0);
      });
    }
  });
});
