import { test, expect } from '../fixtures';
import { useRole } from '../../../helpers/roles';
import { DashboardPage } from '../../../pages/dashboard.page';
import { JobSearchPage } from '../../../pages/job-search.page';
import {
  BOOKMARKED,
  BOOKMARK_LIMIT,
  KEYWORD,
  bookmarkState,
  checkAccountUnchanged,
  dashboardBookmarkIds,
  expectBookmarkRoom,
  firstUnbookmarked,
  jobOf,
  jobsForMeOptions,
  jvidOf,
  pagesLoadedDuring,
  pickJobsForMe,
  recordDialogs,
  toggleBookmark,
  unbookmarkedCards,
} from './helpers';

// [Functional] - Job Search - Logged-in Job Seeker - Test Plan, BK-1 to BK-5.
// See test-plans/functional-job-search-logged-in.md.
//
// Bookmarks jobs on the job seeker account, so QA and Stage only
// (@no-prod), desktop only. Each test removes, by job ID in `finally`, only
// the bookmarks it added.

const BOOKMARK_PATH = '/careerforce/ajax/job-post/add/';

test.describe('bookmarks', { tag: ['@no-prod', '@desktop-only'] }, () => {
  useRole('jobseeker');
  checkAccountUnchanged();

  test("BK-1: a bookmark stays, and the search isn't disturbed", async ({
    page,
  }) => {
    const jobs = new JobSearchPage(page);
    const dashboard = new DashboardPage(page);
    const added: string[] = [];
    await expectBookmarkRoom(dashboard, 1);

    try {
      await page.goto(`/job-search?title=${KEYWORD}&sort=job-title-asc&page=1`);
      const job = await firstUnbookmarked(jobs);
      const card = jobs.card(job.jobId);
      await card.scrollIntoViewIfNeeded();
      const before = {
        url: page.url(),
        scrollY: await page.evaluate(() => window.scrollY),
        ids: (await jobs.results()).items,
      };

      added.push(job.jobId);
      const loaded = await pagesLoadedDuring(page, () =>
        toggleBookmark(jobs, job.jobId, 'remove'),
      );
      expect(loaded, 'bookmarking does not load a new page').toEqual([]);
      expect(page.url(), 'the address stays the same').toBe(before.url);
      expect(
        Math.abs((await page.evaluate(() => window.scrollY)) - before.scrollY),
        'the scroll position stays the same',
      ).toBeLessThanOrEqual(5);
      expect(
        await jobs.cards.evaluateAll((els) =>
          els.map((el) => el.getAttribute('data-jvid') ?? ''),
        ),
        'the same jobs are listed',
      ).toEqual(before.ids);

      await page.reload();
      await expect(
        jobs.bookmarkLink(jobs.card(job.jobId)),
        'still bookmarked after a reload',
      ).toHaveClass(/\bbookmark--remove\b/);

      await jobs.readMoreLink(jobs.card(job.jobId)).click();
      await expect(page).toHaveURL(new RegExp(`[?&]jvid=${job.jobId}(&|$)`));
      await expect(jobs.cards).toHaveCount(1);
      await expect(
        jobs.bookmarkLink(jobs.cards.first()),
        'bookmarked on its own page too',
      ).toHaveClass(/\bbookmark--remove\b/);
    } finally {
      await dashboard.cleanUp({ jobIds: added });
    }
  });

  test("BK-2: bookmark from the job's own page", async ({ page }) => {
    const jobs = new JobSearchPage(page);
    const dashboard = new DashboardPage(page);
    const added: string[] = [];
    await expectBookmarkRoom(dashboard, 1);

    try {
      await jobs.search({ title: KEYWORD });
      const job = await firstUnbookmarked(jobs);

      await page.goto(`/job-search?jvid=${job.jobId}`);
      await expect(jobs.cards).toHaveCount(1);
      added.push(job.jobId);
      await toggleBookmark(jobs, job.jobId, 'remove');

      await dashboard.goto();
      await dashboard.open('Bookmarked jobs');
      const item = dashboard.bookmark(job.jobId);
      await expect(item, 'the dashboard lists the job').toHaveCount(1);
      await expect(item.locator('a:not(.remove-field-link)')).toHaveText(
        job.title,
      );

      await page.goto('/job-search');
      const options = await jobsForMeOptions(jobs, BOOKMARKED);
      const option = options.find((o) => jvidOf(o.value) === job.jobId);
      expect(
        option,
        `Jobs for me → "${BOOKMARKED}" lists job ${job.jobId}`,
      ).toBeDefined();
      expect(option?.text).toBe(job.title);

      await pickJobsForMe(jobs, BOOKMARKED, option?.value ?? '');
      expect(jobs.params().get('jvid'), 'opens the job on its own').toBe(
        job.jobId,
      );
      await expect(jobs.cards).toHaveCount(1);
      await expect(jobs.cardTitle(jobs.cards.first())).toHaveText(job.title);
    } finally {
      await dashboard.cleanUp({ jobIds: added });
    }
  });

  test("BK-3: double-click doesn't leave a mess", async ({ page }) => {
    const jobs = new JobSearchPage(page);
    const dashboard = new DashboardPage(page);
    const added: string[] = [];
    await expectBookmarkRoom(dashboard, 1);

    try {
      await jobs.search({ title: KEYWORD });
      const job = await firstUnbookmarked(jobs);
      added.push(job.jobId);

      // Count the bookmark requests, to know when the page has settled.
      let started = 0;
      let finished = 0;
      const isBookmark = (url: string) =>
        new URL(url).pathname === `${BOOKMARK_PATH}${job.jobId}`;
      page.on('request', (r) => {
        if (isBookmark(r.url())) started++;
      });
      page.on('requestfinished', (r) => {
        if (isBookmark(r.url())) finished++;
      });
      page.on('requestfailed', (r) => {
        if (isBookmark(r.url())) finished++;
      });

      await jobs.bookmarkLink(jobs.card(job.jobId)).dblclick();
      await expect
        .poll(() => started > 0 && finished === started, {
          message: 'the bookmark requests have all been answered',
        })
        .toBe(true);

      await page.reload();
      const state = await bookmarkState(jobs, job.jobId);
      expect(['add', 'remove'], 'the icon has a state').toContain(state);

      await dashboard.goto();
      await dashboard.open('Bookmarked jobs');
      await expect(
        dashboard.bookmark(job.jobId),
        state === 'remove'
          ? 'the icon says bookmarked: the dashboard lists it once'
          : 'the icon says not bookmarked: the dashboard does not list it',
      ).toHaveCount(state === 'remove' ? 1 : 0);
    } finally {
      await dashboard.cleanUp({ jobIds: added });
    }
  });

  test('BK-4: two tabs, one job', async ({ page, context }) => {
    const jobs = new JobSearchPage(page);
    const dashboard = new DashboardPage(page);
    const added: string[] = [];
    await expectBookmarkRoom(dashboard, 1);

    try {
      const tab2 = await context.newPage();
      const jobs2 = new JobSearchPage(tab2);
      await jobs.search({ title: KEYWORD });
      await jobs2.search({ title: KEYWORD });

      const job = await firstUnbookmarked(jobs);
      added.push(job.jobId);
      await toggleBookmark(jobs, job.jobId, 'remove');

      const icon2 = jobs2.bookmarkLink(jobs2.card(job.jobId));
      await expect(icon2, 'tab 2 still shows it as not bookmarked').toHaveClass(
        /\bbookmark--add\b/,
      );
      const [answer] = await Promise.all([
        tab2.waitForResponse(
          (r) => new URL(r.url()).pathname === `${BOOKMARK_PATH}${job.jobId}`,
        ),
        icon2.click(),
      ]);
      await answer.finished();
      await expect(
        icon2,
        'tab 2 shows the real state: bookmarked (it already was)',
      ).toHaveClass(/\bbookmark--remove\b/);

      await page.reload();
      await tab2.reload();
      await expect(
        jobs.bookmarkLink(jobs.card(job.jobId)),
        'tab 1 after a reload: bookmarked',
      ).toHaveClass(/\bbookmark--remove\b/);
      await expect(icon2, 'tab 2 after a reload: bookmarked').toHaveClass(
        /\bbookmark--remove\b/,
      );

      await dashboard.goto();
      await dashboard.open('Bookmarked jobs');
      await expect(
        dashboard.bookmark(job.jobId),
        'the dashboard lists it once',
      ).toHaveCount(1);
    } finally {
      await dashboard.cleanUp({ jobIds: added });
    }
  });

  test('BK-5: limit of 15 bookmarks', async ({ page }) => {
    // Up to 15 bookmarks and their removal.
    test.setTimeout(300_000);
    const jobs = new JobSearchPage(page);
    const dashboard = new DashboardPage(page);
    const dialogs = recordDialogs(page);
    const added: string[] = [];
    const before = await expectBookmarkRoom(dashboard, 1);

    try {
      let count = before.length;
      let extraId = '';
      for (let pageNo = 0; pageNo < 5 && !extraId; pageNo++) {
        await jobs.search({ title: KEYWORD, page: String(pageNo) });
        await expect(jobs.cards.first()).toBeVisible();
        while (!extraId && (await unbookmarkedCards(jobs).count()) > 0) {
          const job = await jobOf(jobs, unbookmarkedCards(jobs).first());
          // Known before the click, so cleanup removes it even if a check
          // below fails.
          added.push(job.jobId);
          if (count < BOOKMARK_LIMIT) {
            await test.step(`bookmark ${count + 1}: ${job.jobId}`, () =>
              toggleBookmark(jobs, job.jobId, 'remove'));
            count++;
            continue;
          }
          extraId = job.jobId;
        }
      }
      expect(
        extraId,
        `enough jobs to fill ${BOOKMARK_LIMIT} bookmarks and try one more`,
      ).not.toBe('');

      await test.step(`the ${BOOKMARK_LIMIT + 1}th is refused`, async () => {
        const icon = jobs.bookmarkLink(jobs.card(extraId));
        const [answer] = await Promise.all([
          page.waitForResponse(
            (r) => new URL(r.url()).pathname === `${BOOKMARK_PATH}${extraId}`,
          ),
          icon.click(),
        ]);
        await answer.finished();
        await expect(
          page
            .locator(
              '.messages, [role="alert"], [role="status"], [role="dialog"]',
            )
            .filter({ hasText: /\b15\b|limit/i })
            .first(),
          'a plain message on the page says the limit is reached',
        ).toBeVisible();
        expect(dialogs, 'no browser alert()').toEqual([]);
        await expect(icon, 'its icon stays "add"').toHaveClass(
          /\bbookmark--add\b/,
        );
      });

      await test.step('exactly 15 are listed', async () => {
        await dashboard.goto();
        const onDashboard = await dashboardBookmarkIds(dashboard);
        expect(onDashboard).toHaveLength(BOOKMARK_LIMIT);
        expect(onDashboard).not.toContain(extraId);

        await jobs.search({ title: KEYWORD });
        const listed = (await jobsForMeOptions(jobs, BOOKMARKED)).map((o) =>
          jvidOf(o.value),
        );
        expect(listed).toHaveLength(BOOKMARK_LIMIT);
        expect(listed).not.toContain(extraId);
      });
    } finally {
      await dashboard.cleanUp({ jobIds: added });
    }
  });
});
