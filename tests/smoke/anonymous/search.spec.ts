import { test, expect } from '../../helpers/fixtures';
import { SearchPage } from '../../pages/search.page';

// [Smoke] - Anonymous - Test Plan, SR-1/SR-2.
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
});
