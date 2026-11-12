import { test, expect } from '../fixtures';
import { useRole } from '../../../helpers/roles';
import { DashboardPage } from '../../../pages/dashboard.page';
import { JobSearchPage } from '../../../pages/job-search.page';
import {
  KEYWORD,
  SAVED,
  checkAccountUnchanged,
  expectBookmarkRoom,
  expectSearchRoom,
  firstUnbookmarked,
  fitsWidth,
  insideViewport,
  jobsForMeOptions,
  pickJobsForMe,
  saveDialogParts,
  testName,
} from './helpers';

// [Functional] - Job Search - Logged-in Job Seeker - Test Plan, MO-1.
// See test-plans/functional-job-search-logged-in.md.
//
// The phone only (@mobile-only, functional-mobile). Saves a search and
// bookmarks a job on the job seeker account (@no-prod), and removes both in
// `finally`. The fixture also fails the test if the page it ends on scrolls
// sideways.

test.describe('on a phone', { tag: ['@no-prod', '@mobile-only'] }, () => {
  useRole('jobseeker');
  checkAccountUnchanged();

  test('MO-1: save, bookmark and Jobs for me on a phone', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    const dashboard = new DashboardPage(page);
    const name = testName();
    const added: string[] = [];
    await expectSearchRoom(dashboard, 1);
    await expectBookmarkRoom(dashboard, 1);

    // On a phone Jobs for me may sit in the filters drawer.
    const showJobsForMe = async () => {
      if (!(await jobs.jobsForMeCategory.isVisible())) await jobs.showFilters();
      await expect(jobs.jobsForMeCategory).toBeVisible();
    };

    try {
      await jobs.search({ title: KEYWORD });

      await test.step('save a search from the drawer', async () => {
        const { dialog, nameBox, save } = saveDialogParts(jobs);
        // Opens "Filters" first, and checks the dialog is on top of it.
        await jobs.openSaveSearchDialog();
        expect(await insideViewport(dialog), 'the dialog fits the screen').toBe(
          true,
        );
        expect(await fitsWidth(page), 'no sideways scroll').toBe(true);
        await nameBox.fill(name);
        await save.tap();
        await expect(dialog).toBeHidden();
        await expect
          .poll(
            async () =>
              (await jobsForMeOptions(jobs, SAVED)).map((o) => o.text),
            { message: 'Jobs for me lists it without a reload' },
          )
          .toContain(name);
      });

      await test.step('bookmark a job with a tap', async () => {
        await jobs.search({ title: KEYWORD });
        const job = await firstUnbookmarked(jobs);
        added.push(job.jobId);
        const icon = jobs.bookmarkLink(jobs.card(job.jobId));
        await icon.tap();
        await expect(icon).toHaveClass(/\bbookmark--remove\b/);
      });

      await test.step('open the saved search from Jobs for me', async () => {
        await showJobsForMe();
        const option = (await jobsForMeOptions(jobs, SAVED)).find(
          (o) => o.text === name,
        );
        expect(option, `Jobs for me lists "${name}"`).toBeDefined();
        await pickJobsForMe(jobs, SAVED, option?.value ?? '');
        expect(jobs.params().get('title')).toBe(KEYWORD);
        expect(await fitsWidth(page), 'no sideways scroll').toBe(true);
      });
    } finally {
      await dashboard.cleanUp({ searches: [name], jobIds: added });
    }
  });
});
