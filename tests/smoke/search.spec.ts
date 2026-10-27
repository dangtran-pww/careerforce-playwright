import { test, expect } from '@playwright/test';
import { SearchPage } from '../pages/search.page';

// Phase 1 — Read-Only Smoke Test Plan, SR-1/SR-2.
// See docs/phase1-read-only-smoke-test-plan.md.

test.describe('site search', () => {
  test('empty keyword returns the full index', async ({ page }) => {
    const search = new SearchPage(page, '/search', 'k');
    await search.search();
    expect(await search.resultCount()).toBeGreaterThan(0);
  });

  for (const keyword of ['job fair', 'networking', 'farmer']) {
    test(`"${keyword}" returns results`, async ({ page }) => {
      const search = new SearchPage(page, '/search', 'k');
      await search.search(keyword);
      expect(await search.resultCount()).toBeGreaterThan(0);
    });
  }
});

test.describe('explore careers search', () => {
  for (const keyword of ['Nursing', 'taxi driver', 'project manager']) {
    test(`"${keyword}" returns results`, async ({ page }) => {
      const careers = new SearchPage(page, '/explore/careers', 'otitle');
      await careers.search(keyword);
      expect(await careers.resultCount()).toBeGreaterThan(0);
    });
  }
});
