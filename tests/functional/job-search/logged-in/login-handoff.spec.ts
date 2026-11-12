import type { Page, Response } from '@playwright/test';

import { test, expect } from '../fixtures';
import { useRole } from '../../../helpers/roles';
import { DashboardPage } from '../../../pages/dashboard.page';
import { JobSearchPage } from '../../../pages/job-search.page';
import {
  KEYWORD,
  SAVED,
  checkAccountUnchanged,
  dashboardBookmarkIds,
  expectBookmarkRoom,
  expectSearchRoom,
  firstUnbookmarked,
  jobsForMeOptions,
  recordDialogs,
  saveDialogParts,
  testName,
  toggleBookmark,
  waitForNewPage,
} from './helpers';

// [Functional] - Job Search - Logged-in Job Seeker - Test Plan, HO-1 to HO-4.
// See test-suites/job-search/functional-job-search-logged-in.md.
//
// A visitor who clicks Bookmark or Save search logs in through LoginMN and
// comes back to /job-search?<search>#save-search or #bookmark[<job ID>].
// LoginMN can't be driven by a test, so these open that return address as
// the logged-in job seeker. QA and Stage only (@no-prod), desktop only.

const SEARCH = `/job-search?title=${KEYWORD}`;

// Opens the return address as a fresh page load. Going there from the same
// search would only change the #fragment, and the page's script that reads
// it wouldn't run.
async function openReturnAddress(page: Page, fragment: string) {
  await page.goto('about:blank');
  await page.goto(`${SEARCH}#${fragment}`);
}

test.describe(
  'finishing an action after logging in',
  { tag: ['@no-prod', '@desktop-only'] },
  () => {
    useRole('jobseeker');
    checkAccountUnchanged();

    test('HO-1: coming back to save a search', async ({ page }) => {
      const jobs = new JobSearchPage(page);
      const dashboard = new DashboardPage(page);
      const name = testName();
      await expectSearchRoom(dashboard, 1);

      try {
        await openReturnAddress(page, 'save-search');
        const { dialog, nameBox, save } = saveDialogParts(jobs);
        await expect(dialog, 'the save dialog opens by itself').toBeVisible();
        await nameBox.fill(name);
        await save.click();
        await expect(dialog).toBeHidden();

        await expect
          .poll(
            async () =>
              (await jobsForMeOptions(jobs, SAVED)).map((o) => o.text),
            { message: `Jobs for me lists "${name}"` },
          )
          .toContain(name);

        await dashboard.goto();
        await dashboard.open('Saved searches');
        await expect(dashboard.savedSearch(name)).toHaveCount(1);
        await waitForNewPage(page, () =>
          dashboard
            .savedSearch(name)
            .getByRole('link', { name, exact: true })
            .click(),
        );
        expect(jobs.params().get('title')).toBe(KEYWORD);
        expect(new URL(page.url()).hash, 'without #save-search').toBe('');
      } finally {
        await dashboard.cleanUp({ searches: [name] });
      }
    });

    test('HO-2: coming back to bookmark a job', async ({ page }) => {
      const jobs = new JobSearchPage(page);
      const dashboard = new DashboardPage(page);
      const added: string[] = [];
      await expectBookmarkRoom(dashboard, 1);

      try {
        await page.goto(SEARCH);
        const job = await firstUnbookmarked(jobs);
        added.push(job.jobId);

        await openReturnAddress(page, `bookmark[${job.jobId}]`);
        // If a dialog asks to finish the bookmark, finish it.
        const icon = jobs.bookmarkLink(jobs.card(job.jobId));
        const finish = page
          .getByRole('dialog')
          .getByRole('button', { name: /bookmark|save|confirm|yes|ok/i })
          .first();
        await expect(
          finish.or(icon.and(page.locator('.bookmark--remove'))).first(),
        ).toBeVisible();
        if (await finish.isVisible()) await finish.click();

        await page.waitForURL((url) => url.hash === '', {
          waitUntil: 'load',
        });
        await expect(icon, 'the job is bookmarked').toHaveClass(
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

    test("HO-3: coming back to a job that's already bookmarked", async ({
      page,
    }) => {
      const jobs = new JobSearchPage(page);
      const dashboard = new DashboardPage(page);
      const dialogs = recordDialogs(page);
      const added: string[] = [];
      await expectBookmarkRoom(dashboard, 1);

      try {
        await page.goto(SEARCH);
        const job = await firstUnbookmarked(jobs);
        added.push(job.jobId);
        await toggleBookmark(jobs, job.jobId, 'remove');

        await openReturnAddress(page, `bookmark[${job.jobId}]`);
        await expect(
          page.getByText(/already/i).first(),
          'a plain message says it is already bookmarked',
        ).toBeVisible();
        expect(dialogs, 'no browser alert()').toEqual([]);

        await page.goto(SEARCH);
        await expect(
          jobs.bookmarkLink(jobs.card(job.jobId)),
          'still bookmarked',
        ).toHaveClass(/\bbookmark--remove\b/);
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

    test("HO-4: coming back with a job ID that doesn't exist", async ({
      page,
    }) => {
      const jobs = new JobSearchPage(page);
      const dashboard = new DashboardPage(page);
      const dialogs = recordDialogs(page);
      await dashboard.goto();
      const before = await dashboardBookmarkIds(dashboard);

      // The bookmark form the page opens for the ID, if it opens one.
      const formAnswers: Promise<unknown>[] = [];
      page.on('response', (response: Response) => {
        if (response.url().includes('bookmark-job-form')) {
          formAnswers.push(response.finished());
        }
      });

      for (const id of ['00000000000000000000000000000000', 'nothex']) {
        await test.step(`#bookmark[${id}]`, async () => {
          await openReturnAddress(page, `bookmark[${id}]`);
          await expect(jobs.cards.first(), 'the search as usual').toBeVisible();
          await page.waitForLoadState('load');
          await Promise.all(formAnswers);
          expect(dialogs, 'no browser alert()').toEqual([]);
        });
      }

      await dashboard.goto();
      expect(
        await dashboardBookmarkIds(dashboard),
        'nothing new on the dashboard',
      ).toEqual(before);
    });
  },
);
