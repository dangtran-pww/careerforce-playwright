import { test, expect } from '../../helpers/fixtures';
import { SearchPage } from '../../pages/search.page';
import { CareerDetailPage } from '../../pages/career-detail.page';
import { JobSearchPage } from '../../pages/job-search.page';

// [Smoke] - Anonymous - Test Plan, SR-1/SR-2/SR-3.
// See test-plans/smoke-anonymous.md.

test.describe('site search', () => {
  test('SR-1: empty keyword returns the full index', async ({ page }) => {
    const search = new SearchPage(page, '/search', 'k');
    await search.search();
    expect(await search.resultCount()).toBeGreaterThan(0);
  });

  for (const keyword of ['job fair', 'networking', 'farmer']) {
    test(`SR-1: "${keyword}" returns results`, async ({ page }) => {
      const search = new SearchPage(page, '/search', 'k');
      await search.search(keyword);
      expect(await search.resultCount()).toBeGreaterThan(0);
    });
  }
});

test.describe('explore careers search', () => {
  for (const keyword of ['Nursing', 'taxi driver', 'project manager']) {
    test(`SR-2: "${keyword}" returns results`, async ({ page }) => {
      const careers = new SearchPage(page, '/explore/careers', 'otitle');
      await careers.search(keyword);
      expect(await careers.resultCount()).toBeGreaterThan(0);
    });
  }

  // Registered Nurses is O*NET code 29-1141.00, which doesn't change, so
  // its result is found by its address. Career results open in a new tab
  // (target="_blank"), so the rest of the test works in that tab.
  test('SR-3: a career page opens from the search and shows its sections', async ({
    page: searchPage,
  }) => {
    const careers = new SearchPage(searchPage, '/explore/careers', 'otitle');
    await careers.search('Nursing');
    const result = searchPage.locator('main a[href="/explore/careers/29-1141.00"]');
    await expect(result).toHaveAttribute('target', '_blank');
    const [page] = await Promise.all([
      searchPage.waitForEvent('popup'),
      result.click(),
    ]);

    const career = new CareerDetailPage(page, 'Registered Nurses');
    await expect(page).toHaveURL(/\/explore\/careers\/29-1141\.00$/);
    await expect(career.heading).toBeVisible();
    for (const section of [
      'Also known as',
      'Daily Work Activities',
      'Data By Region',
      'Qualifications',
    ]) {
      await expect(career.sectionHeading(section)).toBeVisible();
    }

    // "Find current job openings" runs a Job Search for this career.
    await career.jobOpeningsLink.click();
    const jobs = new JobSearchPage(page);
    await expect(jobs.heading).toBeVisible();
    await expect(jobs.keywordInput).toHaveValue(/^Registered Nurses/);
    expect(await jobs.resultCount()).toBeGreaterThan(0);
  });
});
