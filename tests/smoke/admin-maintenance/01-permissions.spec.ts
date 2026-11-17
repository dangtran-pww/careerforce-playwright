import { test, expect } from '../../helpers/fixtures';
import { useRole } from '../../helpers/roles';
import { waitForBatch } from '../../pages/search-api-index.page';

// [Smoke] - Admin Maintenance - Test Plan — AM-1. See
// test-suites/smoke/smoke-admin-maintenance.md.
//
// Writes site state (rebuilds node access). QA/stage only.
// Files in this folder are numbered so one worker runs them in plan order:
// permissions, then the reindex and searches (AM-2/AM-3).

useRole('admin');

test('AM-1: permissions rebuild completes', { tag: '@no-prod' }, async ({ page }) => {
  test.setTimeout(15 * 60_000);

  await page.goto('/admin/reports/status/rebuild');
  await expect(
    page.getByRole('heading', {
      name: 'Are you sure you want to rebuild the permissions on site content?',
    }),
  ).toBeVisible();
  const rebuild = page.getByRole('button', { name: 'Rebuild permissions' });
  await expect(rebuild).toBeVisible();
  // Drupal confirm forms render "Cancel" as a link styled as a button.
  await expect(
    page
      .getByRole('button', { name: 'Cancel', exact: true })
      .or(page.getByRole('link', { name: 'Cancel', exact: true })),
  ).toBeVisible();

  await rebuild.click();
  await waitForBatch(page, 14 * 60_000);

  await expect(page.locator('.messages--status')).toContainText(
    /permissions have been rebuilt/i,
  );
  await expect(page.locator('.messages--error')).toHaveCount(0);
});
