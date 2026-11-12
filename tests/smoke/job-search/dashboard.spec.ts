import { test, expect } from '../../helpers/fixtures';
import { useRole } from '../../helpers/roles';
import { DashboardPage, type DashboardGroup } from '../../pages/dashboard.page';
import { JobSearchPage } from '../../pages/job-search.page';

// [Smoke] - Job Search - Test Plan, MD-1 to MD-6 (My Job Search on the
// dashboard). See test-suites/smoke/smoke-job-search.md.
//
// Logged in as the job seeker, whose dashboard is /user. The job search
// section is the "Jobs For Me" block, with a "Saved searches" and a
// "Bookmarked jobs" group. These tests save searches and bookmark jobs on
// that account, so they never run on Production (@no-prod); they run on
// desktop and phone. Each removes what it added, by name or job ID, in a
// `finally` block. Limits: 5 saved searches, 15 bookmarks.

const KEYWORD = 'nurse';
const SEARCH_LIMIT = 5;
const BOOKMARK_LIMIT = 15;

type Bookmarked = { jobId: string; title: string };

// Saved searches: removes existing ones to make room if the account is full.
// Bookmarks: fails, rather than removing someone else's, when full.
async function expectRoom(
  dashboard: DashboardPage,
  kind: 'search' | 'bookmark',
) {
  await dashboard.goto();
  if (kind === 'search') {
    await dashboard.makeRoomForSearches(1, SEARCH_LIMIT);
    const count = (await dashboard.savedSearchNames()).length;
    expect(
      count,
      `The job seeker account has ${count} of ${SEARCH_LIMIT} saved searches; this test needs 1 free.`,
    ).toBeLessThan(SEARCH_LIMIT);
  } else {
    const count = await dashboard.bookmarkCount();
    expect(
      count,
      `The job seeker account has ${count} of ${BOOKMARK_LIMIT} bookmarks; this test needs 1 free.`,
    ).toBeLessThan(BOOKMARK_LIMIT);
  }
}

// Saves "nurse" filtered by the city with the most jobs; returns its `loc`.
async function saveSearch(jobs: JobSearchPage, name: string): Promise<string> {
  await jobs.search({ title: KEYWORD });
  const [city] = await jobs.topOptions(jobs.citySelect, 1);
  expect(city, 'the City dropdown should list at least 1 city').toBeDefined();
  await jobs.search({ title: KEYWORD, loc: city.value });
  await jobs.saveSearch(name);
  await expect(jobs.saveSearchDialog).toBeHidden();
  return city.value;
}

// Bookmarks the first job for "nurse" that isn't bookmarked yet. `onAdded`
// runs as soon as the job is picked, so cleanup knows it even if a later
// check fails.
async function bookmarkFirstJob(
  jobs: JobSearchPage,
  onAdded: (job: Bookmarked) => void,
): Promise<Bookmarked> {
  await jobs.search({ title: KEYWORD });
  const card = jobs.cards
    .filter({ has: jobs.page.locator('a.bookmark.bookmark--add') })
    .first();
  await expect(
    card,
    'a job on the first page that is not bookmarked yet',
  ).toBeVisible();
  const jobId = (await card.getAttribute('data-jvid')) ?? '';
  const title = ((await jobs.cardTitle(card).textContent()) ?? '').trim();
  const job = { jobId, title };
  onAdded(job);

  const bookmark = jobs.bookmarkLink(jobs.card(jobId));
  await bookmark.click();
  await expect(bookmark).toHaveClass(/\bbookmark--remove\b/);
  return job;
}

test.describe('My Job Search on the dashboard', { tag: '@no-prod' }, () => {
  useRole('jobseeker');

  test('MD-1: the job search section shows', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await expect(dashboard.jobsHeading).toBeVisible();

    const groups: DashboardGroup[] = ['Saved searches', 'Bookmarked jobs'];
    for (const name of groups) {
      await test.step(name, async () => {
        const group = await dashboard.open(name);
        const items = await dashboard.items(group).all();
        if (items.length === 0) {
          await expect(dashboard.emptyMessage(name)).toBeVisible();
        }
        for (const item of items) {
          await expect(
            item.locator('a:not(.remove-field-link)'),
          ).not.toBeEmpty();
          await expect(dashboard.removeLink(item)).toBeVisible();
        }
      });
    }
  });

  test('MD-2: a saved search opens from the dashboard', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    const dashboard = new DashboardPage(page);
    const name = `Playwright test ${Date.now()}`;
    await expectRoom(dashboard, 'search');

    try {
      const loc = await saveSearch(jobs, name);

      await dashboard.goto();
      await dashboard.open('Saved searches');
      const item = dashboard.savedSearch(name);
      await expect(item).toBeVisible();
      await item.getByRole('link', { name, exact: true }).click();

      await jobs.waitForParams({ title: KEYWORD, loc });
      await expect(jobs.heading).toBeVisible();
      await expect(jobs.cards.first()).toBeVisible();
    } finally {
      await dashboard.cleanUp({ searches: [name] });
    }
  });

  test('MD-3: remove a saved search from the dashboard', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    const dashboard = new DashboardPage(page);
    const name = `Playwright test ${Date.now()}`;
    await expectRoom(dashboard, 'search');

    try {
      await saveSearch(jobs, name);

      await dashboard.goto();
      const others = (await dashboard.savedSearchNames()).filter(
        (n) => n !== name,
      );
      const item = dashboard.savedSearch(name);
      await expect(item).toBeVisible();
      const response = await dashboard.remove(item);
      expect(response.ok(), 'the site should accept the removal').toBe(true);
      await expect(item).toHaveCount(0);

      await page.reload();
      const after = await dashboard.savedSearchNames();
      expect(after, 'gone after a reload').not.toContain(name);
      expect(after.sort(), 'every other saved search is still listed').toEqual(
        others.sort(),
      );

      await page.goto('/job-search');
      const listed = await jobs.jobsForMeItems('Saved searches');
      expect(listed, '"Jobs for me" no longer lists it').not.toContain(name);
      expect(listed.sort(), '"Jobs for me" still lists the others').toEqual(
        others.sort(),
      );
    } finally {
      await dashboard.cleanUp({ searches: [name] });
    }
  });

  test('MD-4: a bookmarked job shows on the dashboard', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    const dashboard = new DashboardPage(page);
    const added: string[] = [];
    await expectRoom(dashboard, 'bookmark');

    try {
      const job = await bookmarkFirstJob(jobs, ({ jobId }) =>
        added.push(jobId),
      );

      await page.reload();
      expect(
        await jobs.jobsForMeItems('Bookmarked jobs'),
        '"Jobs for me" lists it',
      ).toContain(job.title);

      await dashboard.goto();
      await dashboard.open('Bookmarked jobs');
      const item = dashboard.bookmark(job.jobId);
      await expect(item).toBeVisible();
      const link = item.locator('a:not(.remove-field-link)');
      await expect(link).toHaveText(job.title);

      await link.click();
      await expect(page).toHaveURL(
        new RegExp(`/job-search\\?(.*&)?jvid=${job.jobId}(&|$)`),
      );
      await expect(jobs.cards).toHaveCount(1);
      await expect(jobs.cardTitle(jobs.cards.first())).toHaveText(job.title);
    } finally {
      await dashboard.cleanUp({ jobIds: added });
    }
  });

  test('MD-5: remove a bookmark from the dashboard', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    const dashboard = new DashboardPage(page);
    const added: string[] = [];
    await expectRoom(dashboard, 'bookmark');

    try {
      const job = await bookmarkFirstJob(jobs, ({ jobId }) =>
        added.push(jobId),
      );

      await dashboard.goto();
      await dashboard.open('Bookmarked jobs');
      const item = dashboard.bookmark(job.jobId);
      await expect(item).toBeVisible();
      const response = await dashboard.remove(item);
      expect(response.ok(), 'the site should accept the removal').toBe(true);
      await expect(item).toHaveCount(0);

      await page.reload();
      await dashboard.open('Bookmarked jobs');
      await expect(
        dashboard.bookmark(job.jobId),
        'gone after a reload',
      ).toHaveCount(0);

      await jobs.search({ title: KEYWORD });
      await expect(jobs.bookmarkLink(jobs.card(job.jobId))).toHaveClass(
        /\bbookmark--add\b/,
      );
    } finally {
      await dashboard.cleanUp({ jobIds: added });
    }
  });

  test('MD-6: un-bookmark from the results', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    const dashboard = new DashboardPage(page);
    const added: string[] = [];
    await expectRoom(dashboard, 'bookmark');

    try {
      const job = await bookmarkFirstJob(jobs, ({ jobId }) =>
        added.push(jobId),
      );

      const bookmark = jobs.bookmarkLink(jobs.card(job.jobId));
      await bookmark.click();
      await expect(bookmark).toHaveClass(/\bbookmark--add\b/);

      await dashboard.goto();
      await dashboard.open('Bookmarked jobs');
      await expect(dashboard.bookmark(job.jobId)).toHaveCount(0);
    } finally {
      await dashboard.cleanUp({ jobIds: added });
    }
  });
});
