import { test, expect } from '@playwright/test';

// Admin UI journeys. First case: create and publish an article, then clean
// up through Drupal's own delete form — no JSON:API dependency, so this
// file has no setup/teardown infra beyond what's below. Add further admin
// journeys to this file as they come up.

test.use({ storageState: 'playwright/.auth/admin.json' });

test('admin can create and publish an article through the UI', async ({ page }) => {
  const title = `Playwright test ${Date.now()}`;
  let nid: number | undefined;

  try {
    await page.goto('/node/add/article');

    await page.getByLabel('Title').fill(title);

    // CKEditor 5: click the editable area, then type. Do not fill a
    // hidden textarea. If your field uses a different label or format,
    // adjust the selector below, not the pattern.
    await page.locator('.ck-editor__editable').click();
    await page.keyboard.type('Created by the Playwright starter test.');

    await page.getByRole('button', { name: 'Save' }).click();

    // After saving, Drupal redirects to /node/<nid>. Capture it for cleanup.
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    const match = page.url().match(/\/node\/(\d+)/);
    nid = match ? Number(match[1]) : undefined;
    expect(nid, 'expected a /node/<nid> URL after saving').toBeDefined();
  } finally {
    if (nid) {
      await page.goto(`/node/${nid}/delete`);
      await page.getByRole('button', { name: 'Delete' }).click();
    }
  }
});
