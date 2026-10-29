import { test, expect } from '@playwright/test';
import { isProd, isStage } from '../../helpers/environment';
import { isKnownIssue } from '../../helpers/known-issues';

// [Smoke] - Admin Reports - Test Plan — AR-1..AR-3. See
// test-plans/smoke-admin-reports.md.
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

test.use({ storageState: 'playwright/.auth/admin.json' });

test('AR-1: status report has no new errors', async ({ page }) => {
  await page.goto('/admin/reports/status');
  await expect(
    page.getByRole('heading', { name: 'Status report' }),
  ).toBeVisible();

  const errorRows = page.locator(
    '.system-status-report__row:has(.system-status-report__status-icon--error)',
  );
  const count = await errorRows.count();

  for (let i = 0; i < count; i++) {
    const title = (
      await errorRows
        .nth(i)
        .locator('.system-status-report__status-title')
        .textContent()
    )?.trim() ?? '';

    expect(
      isKnownIssue(title, 'error'),
      `Unexpected status-report error: "${title}" — not in the known-issues ` +
        `allowlist (tests/helpers/known-issues.ts) for this environment`,
    ).toBeTruthy();
  }
});

test('AR-2: translations warning matches environment', async ({
  page,
  baseURL,
}) => {
  await page.goto('/admin/reports/translations');

  const warningBanner = page.locator('.messages--warning');

  // Expected on stage and prod, but not QA — see
  // docs/deed-smoke-test-plan.md §1.
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
