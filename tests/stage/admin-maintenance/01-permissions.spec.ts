import { test, expect } from '@playwright/test';
import { waitForBatch } from '../../pages/search-api-index.page';

// [Smoke] - Admin Maintenance - Test Plan — AM-1. See
// test-plans/smoke-admin-maintenance.md.
//
// Writes site state (rebuilds node access). QA/stage only.
// Files in this folder are numbered so one worker runs them in plan order:
// permissions, reindex (AM-2/AM-3), then the search checks (AM-4/AM-5).

test.use({ storageState: 'playwright/.auth/admin.json' });

test('AM-1: permissions rebuild completes', async ({ page }) => {
  test.setTimeout(15 * 60_000);

  await page.goto('/admin/reports/status/rebuild');
  await page.getByRole('button', { name: 'Rebuild permissions' }).click();
  await waitForBatch(page, 14 * 60_000);

  await expect(page.locator('.messages--status')).toContainText(
    /permissions have been rebuilt/i,
  );
  await expect(page.locator('.messages--error')).toHaveCount(0);
});
