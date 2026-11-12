import type { Page } from '@playwright/test';

import { test, expect } from '../fixtures';
import { useRole } from '../../../helpers/roles';
import { DashboardPage } from '../../../pages/dashboard.page';
import { JobSearchPage } from '../../../pages/job-search.page';
import {
  BOOKMARKED,
  CAREER_GOALS,
  IN_DEMAND,
  JOBS_FOR_ME_GROUPS,
  KEYWORD,
  SAVED,
  checkAccountUnchanged,
  dashboardBookmarkIds,
  expectBookmarkRoom,
  expectSearchRoom,
  firstUnbookmarked,
  jobsForMeGroups,
  jobsForMeOptions,
  jvidOf,
  pagesLoadedDuring,
  pickJobsForMe,
  saveCurrentSearch,
  testName,
  toggleBookmark,
  waitForNewPage,
} from './helpers';

// [Functional] - Job Search - Logged-in Job Seeker - Test Plan, JM-1 to JM-5.
// See test-plans/functional-job-search-logged-in.md.
//
// Changes the job seeker account (bookmarks, saved searches, a career goal,
// My Region), so QA and Stage only (@no-prod), desktop only. Each test puts
// back, in `finally`, only what it changed.

const NURSES_SOC = '29-1141.00';
const NURSES = 'Registered Nurses';

// --- Career goals (JM-2) ---

function goalButton(page: Page, name: RegExp) {
  const main = page.getByRole('main');
  return main
    .getByRole('link', { name })
    .or(main.getByRole('button', { name }))
    .first();
}
const ADD_GOAL = /^\s*Add to career goals\s*$/i;
const REMOVE_GOAL = /^\s*Remove from career goals\s*$/i;

async function userId(page: Page): Promise<string> {
  await page.goto('/user');
  const id = new URL(page.url()).pathname.match(/^\/user\/(\d+)/)?.[1];
  expect(id, '/user opens /user/<ID>').toBeDefined();
  return id ?? '';
}

// --- My Region (JM-4) ---

// The dashboard's "My Region" block: its text without the heading, e.g.
// "Saint Paul, MN 55101" or "Statewide".
async function myRegionText(page: Page): Promise<string> {
  await new DashboardPage(page).goto();
  const heading = page
    .getByRole('main')
    .getByRole('heading', { name: /^\s*My Region\s*$/i })
    .first();
  await expect(heading, 'the dashboard has a "My Region" block').toBeVisible();
  const block = heading.locator('xpath=..');
  const all = ((await block.innerText()) ?? '').trim();
  const title = ((await heading.innerText()) ?? '').trim();
  return all.replace(title, '').replace(/\s+/g, ' ').trim();
}

// The My Region form, also at /careerforce/forms/my_region_form.
async function myRegionForm(page: Page) {
  await page.goto('/careerforce/forms/my_region_form');
  const form = page
    .getByRole('main')
    .locator('form')
    .filter({ has: page.locator('[type="submit"]') })
    .first();
  return {
    input: form
      .locator('input[type="text"], input[type="search"], input:not([type])')
      .first(),
    submit: form.locator('[type="submit"]').first(),
  };
}

async function setMyRegion(page: Page, value: string) {
  const { input, submit } = await myRegionForm(page);
  await input.fill(value);
  await waitForNewPage(page, () => submit.click());
}

async function inDemandList(jobs: JobSearchPage): Promise<string[]> {
  await jobs.page.goto('/job-search');
  return (await jobsForMeOptions(jobs, IN_DEMAND)).map((o) => o.text);
}

test.describe('Jobs for me', { tag: ['@no-prod', '@desktop-only'] }, () => {
  useRole('jobseeker');
  checkAccountUnchanged();

  test('JM-1: Jobs for me matches the account', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    const dashboard = new DashboardPage(page);
    const name = testName();
    const added: string[] = [];
    await expectSearchRoom(dashboard, 1);
    await expectBookmarkRoom(dashboard, 1);

    try {
      await jobs.search({ title: KEYWORD });
      const job = await firstUnbookmarked(jobs);
      added.push(job.jobId);
      await toggleBookmark(jobs, job.jobId, 'remove');
      await saveCurrentSearch(jobs, name);

      await dashboard.goto();
      const searches = await dashboard.savedSearchNames();
      const bookmarks = await dashboardBookmarkIds(dashboard);

      await page.goto('/job-search');
      await expect(
        jobs.jobsForMeCategory,
        'the group dropdown is labelled',
      ).toBeVisible();
      const groups = await jobsForMeGroups(jobs);
      expect(groups).toContain(SAVED);
      expect(groups).toContain(BOOKMARKED);

      for (const group of groups) {
        await test.step(group, async () => {
          expect(JOBS_FOR_ME_GROUPS).toContain(group);
          const loaded = await pagesLoadedDuring(page, () =>
            jobs.jobsForMeCategory.selectOption({ label: group }),
          );
          expect(
            loaded,
            'picking a group alone does not leave the page',
          ).toEqual([]);
          const placeholder = jobs.jobsForMeItem.locator('option').first();
          await expect(placeholder).toHaveAttribute('value', '');
          await expect(placeholder).toHaveText(
            new RegExp(`^\\s*Select ${group}\\s*$`, 'i'),
          );
          await jobs.jobsForMeCategory.selectOption({ index: 0 });

          const options = await jobsForMeOptions(jobs, group);
          expect(options.length, 'a listed group has items').toBeGreaterThan(0);
          if (group === SAVED) {
            expect(
              options.map((o) => o.text),
              'the same names as the dashboard, in the same order',
            ).toEqual(searches);
          }
          if (group === BOOKMARKED) {
            expect(
              options.map((o) => jvidOf(o.value)).sort(),
              'the same jobs as the dashboard',
            ).toEqual([...bookmarks].sort());
          }
        });
      }

      await test.step('picking an item leaves the page', async () => {
        const option = (await jobsForMeOptions(jobs, SAVED)).find(
          (o) => o.text === name,
        );
        expect(option).toBeDefined();
        await pickJobsForMe(jobs, SAVED, option?.value ?? '');
        expect(jobs.params().get('title')).toBe(KEYWORD);
      });
    } finally {
      await dashboard.cleanUp({ searches: [name], jobIds: added });
    }
  });

  test('JM-2: career goals lead to their jobs', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    let addedGoal = false;

    try {
      await page.goto(`/explore/careers/${NURSES_SOC}`);
      const add = goalButton(page, ADD_GOAL);
      const remove = goalButton(page, REMOVE_GOAL);
      await expect(add.or(remove).first()).toBeVisible();
      if (await add.isVisible()) {
        addedGoal = true;
        await add.click();
        await expect(remove).toBeVisible();
      }

      await page.goto('/job-search');
      const goals = await jobsForMeOptions(jobs, CAREER_GOALS);
      const nurses = goals.find((o) => o.text === NURSES);
      expect(nurses, `Career goals lists "${NURSES}"`).toBeDefined();

      await test.step('the same goals as Goals & Experience', async () => {
        await page.goto(`/user/${await userId(page)}/skills-experience`);
        for (const goal of goals) {
          await expect(
            page
              .getByRole('main')
              .getByText(goal.text, { exact: true })
              .first(),
            `"${goal.text}" is a goal on Goals & Experience`,
          ).toBeVisible();
        }
      });

      await page.goto('/job-search');
      await pickJobsForMe(jobs, CAREER_GOALS, nurses?.value ?? '');
      const title = `${NURSES} (${NURSES_SOC})`;
      expect(jobs.params().get('title')).toBe(title);
      await expect(jobs.keywordInput).toHaveValue(title);
      await expect(jobs.cards.first(), 'at least 1 job').toBeVisible();
      const titles = (
        await jobs.cards.getByRole('heading', { level: 3 }).allTextContents()
      ).map((t) => t.trim());
      const matching = titles.filter((t) => /nurs|\bRN\b/i.test(t));
      expect(
        matching.length,
        `at least half the titles mention nursing: ${titles.join(' | ')}`,
      ).toBeGreaterThanOrEqual(titles.length / 2);
    } finally {
      if (addedGoal) {
        await page.goto(`/explore/careers/${NURSES_SOC}`);
        const remove = goalButton(page, REMOVE_GOAL);
        if (await remove.isVisible()) {
          await remove.click();
          await expect(goalButton(page, ADD_GOAL)).toBeVisible();
        }
      }
    }
  });

  test('JM-3: in-demand jobs lead to their jobs', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    await page.goto('/job-search');
    const options = await jobsForMeOptions(jobs, IN_DEMAND);
    expect(options.length, '1 to 10 occupations').toBeGreaterThanOrEqual(1);
    expect(options.length, '1 to 10 occupations').toBeLessThanOrEqual(10);

    const [first] = options;
    await pickJobsForMe(jobs, IN_DEMAND, first.value);
    const title = jobs.params().get('title') ?? '';
    expect(title).toMatch(/^.+ \(\d{2}-\d{4}\.\d{2}\)$/);
    expect(
      title.startsWith(first.text),
      `the title is "${first.text} (<code>)"`,
    ).toBe(true);
    await expect(jobs.keywordInput).toHaveValue(title);
    await expect(
      jobs.cards.first().or(jobs.noResults),
      'jobs, or the friendly empty state',
    ).toBeVisible();
  });

  test('JM-4: in-demand jobs follow My Region', async ({ page }) => {
    test.setTimeout(120_000);
    const jobs = new JobSearchPage(page);

    const originalText = await myRegionText(page);
    const { input } = await myRegionForm(page);
    const originalInput = await input.inputValue();
    const statewide = /statewide/i.test(originalText);
    const restoreTo = statewide ? '' : originalInput || originalText;
    const start = await inDemandList(jobs);
    let changed = false;

    try {
      changed = true;
      await setMyRegion(page, 'Duluth, MN');
      expect(await myRegionText(page), 'My Region is Duluth').toMatch(
        /Duluth/i,
      );
      const duluth = await inDemandList(jobs);

      await setMyRegion(page, 'Saint Paul, MN');
      expect(await myRegionText(page), 'My Region is Saint Paul').toMatch(
        /(Saint|St\.?) Paul/i,
      );
      const saintPaul = await inDemandList(jobs);

      expect(duluth.length).toBeGreaterThan(0);
      expect(saintPaul.length).toBeGreaterThan(0);
      expect(
        duluth,
        'Duluth (Northeast) and Saint Paul (Metro) have different lists',
      ).not.toEqual(saintPaul);
    } finally {
      if (changed) await setMyRegion(page, restoreTo);
    }

    expect(await myRegionText(page), 'My Region is back as it was').toBe(
      originalText,
    );
    expect(
      await inDemandList(jobs),
      'the list is back as at the start',
    ).toEqual(start);
  });

  test("JM-5: browsing the items with the keyboard doesn't leave the page", async ({
    page,
  }) => {
    const jobs = new JobSearchPage(page);
    const dashboard = new DashboardPage(page);
    const stamp = testName();
    const added: string[] = [];
    const before = await expectSearchRoom(dashboard, 0);

    try {
      // At least 2 saved searches.
      if (before.length < 2) await jobs.search({ title: KEYWORD });
      for (let n = before.length; n < 2; n++) {
        const name = `${stamp} ${n + 1}`;
        added.push(name);
        await saveCurrentSearch(jobs, name);
      }

      await page.goto('/job-search');
      await jobs.jobsForMeCategory.selectOption({ label: SAVED });
      await jobs.jobsForMeCategory.focus();
      await page.keyboard.press('Tab');
      await expect(
        jobs.jobsForMeItem,
        'Tab reaches the item dropdown',
      ).toBeFocused();

      const loaded = await pagesLoadedDuring(page, () =>
        page.keyboard.press('ArrowDown'),
      );
      expect(
        loaded,
        'moving the highlight with Down does not change the page',
      ).toEqual([]);
      await expect(
        jobs.jobsForMeItem,
        'Down highlighted an item',
      ).not.toHaveValue('');

      const go = page
        .locator('form.careerforce-jobs-for-me-form')
        .getByRole('button', { name: /^go$/i });
      await waitForNewPage(page, async () => {
        if (await go.isVisible()) await go.click();
        else await page.keyboard.press('Enter');
      });
      expect(page.url(), 'confirming opens the search').toContain(
        '/job-search',
      );
    } finally {
      await dashboard.cleanUp({ searches: added });
    }
  });
});
