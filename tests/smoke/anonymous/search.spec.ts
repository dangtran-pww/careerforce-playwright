import { test, expect } from '../../helpers/fixtures';
import { SearchPage } from '../../pages/search.page';
import { CareerDetailPage } from '../../pages/career-detail.page';
import { JobSearchPage } from '../../pages/job-search.page';
import { HomePage } from '../../pages/home.page';
import { SiteHeader } from '../../pages/site-header.page';

// [Smoke] - Public Site - General - Test Plan, SR-1 to SR-5.
// See test-plans/smoke-public-site.md.

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
      // "Search results 1-50 of 142": the page shows where it is in the list.
      await expect(search.resultSummary).toHaveText(/^Search results 1-\d+ of \d+$/);
      // Results are pages on this site.
      await expect(search.resultRows.first().getByRole('link').first()).toHaveAttribute(
        'href',
        /^\/[^/]/,
      );
    });
  }

  // A word that matches nothing shows the empty message instead of results,
  // so the results above aren't just a fixed list.
  test('SR-1: a keyword with no matches says "No results found."', async ({ page }) => {
    const search = new SearchPage(page, '/search', 'k');
    await search.search('zzqxnotaword');
    await expect(search.noResults).toBeVisible();
    await expect(search.resultRows).toHaveCount(0);
    expect(await search.resultCount()).toBe(0);
  });

  // The header box is its own form. It only has to send the visitor to the
  // site search with the keyword in `k`, which SR-1 doesn't cover.
  test('SR-5: the header search box runs a site search', async ({ page }) => {
    await page.goto('/');
    await new SiteHeader(page).search('networking');
    await expect(page).toHaveURL(/\/search\?(.*&)?k=networking(&|$)/);
    const search = new SearchPage(page, '/search', 'k');
    expect(await search.resultCount()).toBeGreaterThan(0);
  });
});

test.describe('explore careers search', () => {
  for (const keyword of ['Nursing', 'taxi driver', 'project manager']) {
    test(`SR-2: "${keyword}" returns results`, async ({ page }) => {
      const careers = new SearchPage(page, '/explore/careers', 'otitle');
      await careers.search(keyword);
      expect(await careers.resultCount()).toBeGreaterThan(0);
    });
  }

  // A word that matches nothing shows the empty message instead of results,
  // so the results above aren't just the full list of careers.
  test('SR-2: a keyword with no matches says "No results found."', async ({ page }) => {
    const careers = new SearchPage(page, '/explore/careers', 'otitle');
    await careers.search('zzqxnotaword');
    await expect(careers.noResults).toBeVisible();
    await expect(careers.resultRows).toHaveCount(0);
    expect(await careers.resultCount()).toBe(0);
  });

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

  // The homepage box is its own form. It only has to send the visitor to the
  // career search with the keyword in `otitle`, which SR-2 doesn't cover.
  // "Nursing" is known to return results, so a failure here points at the
  // box, not the keyword.
  test('SR-4: the homepage Explore Careers box runs a career search', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();
    await home.exploreCareersInput.fill('Nursing');
    await home.exploreCareersButton.click();
    await expect(page).toHaveURL(/\/explore\/careers\?(.*&)?otitle=Nursing(&|$)/);
    const careers = new SearchPage(page, '/explore/careers', 'otitle');
    expect(await careers.resultCount()).toBeGreaterThan(0);
  });
});
