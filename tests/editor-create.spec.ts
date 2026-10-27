import { test, expect } from '@playwright/test';
import { deleteTestArticleByNid, uniqueTitle } from './helpers/test-data';

// The real editor journey: create through the UI, publish, and check the
// published page. Cleanup still goes through the API so the test does not
// depend on the delete UI working to leave a clean database.

test('editor can create and publish an article through the UI', async ({
  page,
}) => {
  const title = uniqueTitle();
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
      await deleteTestArticleByNid(nid);
    }
  }
});
