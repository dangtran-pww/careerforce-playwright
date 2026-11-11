import { test, expect } from '../../helpers/fixtures';
import { useRole } from '../../helpers/roles';
import { DashboardPage } from '../../pages/dashboard.page';
import {
  JobSearchPage,
  type JobFilterOption,
} from '../../pages/job-search.page';

// [Smoke] - Job Search - Test Plan, SS-1 to SS-3 (saved searches).
// See test-plans/smoke-job-search.md.
//
// Logged in as the job seeker. These save searches on that account, so they
// never run on Production (@no-prod); they run on desktop and phone. Each test removes
// the saved searches it added, by name, in a `finally` block, and never
// anything else. A job seeker can have at most 5 saved searches.

const KEYWORD = 'nurse';
const LIMIT = 5;
const SAVED = 'Saved searches';

// Saves "nurse" filtered by the city with the most jobs, from the results
// page (a saved search keeps the address it was saved from).
async function saveNurseSearch(
  jobs: JobSearchPage,
  name: string,
  city?: JobFilterOption,
): Promise<JobFilterOption> {
  if (!city) {
    await jobs.search({ title: KEYWORD });
    [city] = await jobs.topOptions(jobs.citySelect, 1);
    expect(city, 'the City dropdown should list at least 1 city').toBeDefined();
  }
  await jobs.search({ title: KEYWORD, loc: city.value });
  await jobs.saveSearch(name);
  await expect(jobs.saveSearchDialog).toBeHidden();
  return city;
}

// Makes room for `needed` more saved searches (removing existing ones if the
// account is full), then checks there is room.
async function expectRoom(
  dashboard: DashboardPage,
  needed: number,
): Promise<string[]> {
  if (needed > 0) await dashboard.makeRoomForSearches(needed, LIMIT);
  await dashboard.goto();
  const names = await dashboard.savedSearchNames();
  expect(
    names.length,
    `The job seeker account has ${names.length} of ${LIMIT} saved searches; ` +
      `this test needs ${needed} free. Remove some by hand (dashboard, "x").`,
  ).toBeLessThanOrEqual(LIMIT - needed);
  return names;
}

test.describe('saved searches', { tag: '@no-prod' }, () => {
  useRole('jobseeker');

  test('SS-1: save a search', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    const dashboard = new DashboardPage(page);
    const name = `Playwright test ${Date.now()}`;
    await expectRoom(dashboard, 1);

    try {
      await jobs.search({ title: KEYWORD });
      const [city] = await jobs.topOptions(jobs.citySelect, 1);
      expect(
        city,
        'the City dropdown should list at least 1 city',
      ).toBeDefined();
      await jobs.search({ title: KEYWORD, loc: city.value });

      await jobs.openSaveSearchDialog();
      const nameBox = jobs.saveSearchDialog.getByLabel('Name job search');
      await expect(nameBox).toBeVisible();
      await nameBox.fill(name);
      await jobs.saveSearchDialog
        .getByRole('button', { name: 'Save', exact: true })
        .click();
      // The dialog closes only when the save worked; an error keeps it open.
      await expect(jobs.saveSearchDialog).toBeHidden();

      // "Jobs for me" refreshes itself after the save, without a reload.
      await expect
        .poll(() => jobs.jobsForMeItems(SAVED), {
          message: `"Jobs for me" → "${SAVED}" should list "${name}"`,
        })
        .toContain(name);
    } finally {
      await dashboard.cleanUp({ searches: [name] });
    }
  });

  test('SS-2: run a saved search from Jobs for me', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    const dashboard = new DashboardPage(page);
    const name = `Playwright test ${Date.now()}`;
    await expectRoom(dashboard, 1);

    try {
      const city = await saveNurseSearch(jobs, name);

      await page.goto('/job-search');
      await jobs.openJobsForMe(SAVED, name);
      await jobs.waitForParams({ title: KEYWORD, loc: city.value });
      await expect(jobs.keywordInput).toHaveValue(KEYWORD);
      await expect(jobs.citySelect).toHaveValue(city.value);
      await expect(jobs.cards.first()).toBeVisible();
    } finally {
      await dashboard.cleanUp({ searches: [name] });
    }
  });

  test('SS-3: no more than 5 saved searches', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    const dashboard = new DashboardPage(page);
    const stamp = Date.now();
    // The 6th is refused, but cleanup removes it too in case it was saved.
    const extra = `Playwright test ${stamp} ${LIMIT + 1}`;
    const added: string[] = [];
    const before = await expectRoom(dashboard, 0);

    try {
      let city: JobFilterOption | undefined;
      for (let n = before.length + 1; n <= LIMIT; n++) {
        const name = `Playwright test ${stamp} ${n}`;
        added.push(name);
        await test.step(`save ${name}`, async () => {
          city = await saveNurseSearch(jobs, name, city);
        });
      }
      const five = [...before, ...added];

      await test.step('Save search warns at the limit', async () => {
        await jobs.search({ title: KEYWORD });
        await jobs.openSaveSearchDialog();
        await expect(
          jobs.saveSearchDialog.getByText(
            'You have already reached the limit for saved jobs.',
          ),
        ).toBeVisible();
      });

      await test.step('a 6th is refused', async () => {
        const save = jobs.saveSearchDialog.getByRole('button', {
          name: 'Save',
          exact: true,
        });
        if (await save.isEnabled()) {
          await jobs.saveSearchDialog.getByLabel('Name job search').fill(extra);
          await save.click();
          // Refused with a message, not closed as if it had been saved.
          await expect
            .soft(
              jobs.saveSearchDialog.locator('.messages--error, [role="alert"]'),
              'Saving a 6th search should show an error that it was not saved',
            )
            .toBeVisible();
        }
      });

      await test.step('still exactly the same 5', async () => {
        await jobs.search({ title: KEYWORD });
        const listed = await jobs.jobsForMeItems(SAVED);
        expect(
          listed,
          `"Jobs for me" should not list "${extra}"`,
        ).not.toContain(extra);
        expect(listed.sort()).toEqual([...five].sort());

        await dashboard.goto();
        const onDashboard = await dashboard.savedSearchNames();
        expect(
          onDashboard,
          `the dashboard should not list "${extra}"`,
        ).not.toContain(extra);
        expect(onDashboard.sort()).toEqual([...five].sort());
      });
    } finally {
      await dashboard.cleanUp({ searches: [...added, extra] });
    }
  });
});
