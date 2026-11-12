import { test, expect } from '../../helpers/fixtures';
import { isProd, isStage } from '../../helpers/environments.mjs';
import { useRole } from '../../helpers/roles';

// [Smoke] - Admin Reports - Test Plan — AR-1..AR-3. See
// test-suites/smoke/smoke-admin-reports.md. Desktop only (DESKTOP_ONLY_SMOKE_AREAS).
//
// Read-only admin report checks. All cases need the `admin` storageState
// (write-capable, but every assertion here is read-only — see open
// question 3 in the plan).
//
// Selectors confirmed against a live admin session on qa.careerforce.link
// (Drupal 11.4, Claro theme). AR-3 reads each index's own page, not the
// /admin/config/search/search-api overview table — that table only lists
// Type/Name/Status/Operations; the indexed item count and per-index health
// live on /admin/config/search/search-api/index/<machine-name>.

useRole('admin');

// AR-1 fails on any error row: there is no allowlist of accepted errors.
test('AR-1: status report has no errors', async ({ page }) => {
  await page.goto('/admin/reports/status');
  await expect(
    page.getByRole('heading', { name: 'Status report' }),
  ).toBeVisible();

  const errorRows = page.locator(
    '.system-status-report__row:has(.system-status-report__status-icon--error)',
  );
  const titles = (
    await errorRows
      .locator('.system-status-report__status-title')
      .allTextContents()
  ).map((title) => title.trim());

  expect(titles, 'Errors on the status report').toEqual([]);
});

test('AR-2: translations warning matches environment', async ({
  page,
  baseURL,
}) => {
  await page.goto('/admin/reports/translations');

  const warningBanner = page.locator('.messages--warning');

  // Expected on stage and prod, but not QA.
  if (isStage(baseURL!) || isProd(baseURL!)) {
    await expect(warningBanner.first()).toBeVisible();
  } else {
    await expect(warningBanner).toHaveCount(0);
  }
});

test('AR-3: search index item counts are sane', async ({ page }) => {
  // The /admin/config/search/search-api overview table only lists
  // Type/Name/Status/Operations — the indexed item count and per-index
  // health only appear on each index's own page.
  const indexes = [
    { label: 'Appointment Occurrences', path: 'appointment_occurrences' },
    { label: 'Events More Like This', path: 'events_mlt' },
    { label: 'General site content index', path: 'general_site_content' },
    { label: 'Occupations', path: 'occupations' },
  ];

  for (const { label, path } of indexes) {
    await page.goto(`/admin/config/search/search-api/index/${path}`);

    const description = (
      await page.locator('.search-api-index-status .progress__description').textContent()
    )?.trim() ?? '';
    const indexedMatch = description.match(/^(\d+)\/(\d+)\s+indexed/i);
    const indexedCount = indexedMatch ? Number(indexedMatch[1]) : NaN;

    expect(
      Number.isFinite(indexedCount) && indexedCount > 0,
      `expected "${label}" index to show an indexed item count > 0, got: "${description}"`,
    ).toBeTruthy();

    const statusRowClass =
      (await page.locator('.search-api-index-summary--status').getAttribute('class')) ?? '';

    expect(
      /\berror\b/.test(statusRowClass),
      `expected "${label}" index status row to show no error status, got row class: "${statusRowClass}"`,
    ).toBeFalsy();
  }
});
