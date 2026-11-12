import type { Page } from '@playwright/test';

import { test, expect } from '../../helpers/fixtures';
import { useRole } from '../../helpers/roles';
import { uniqueTitle } from '../../helpers/test-data';
import {
  NodeForm,
  deleteNode,
  expectNoErrors,
  statusMessages,
} from '../../pages/node-form.page';

// [Smoke] - Content Lifecycle - Test Plan — CL-3, CL-4. See
// test-suites/smoke/smoke-content-lifecycle.md.
//
// Revisions list: /<alias>/revisions (Diff module), newest first; the newest
// row says "Current revision", older rows link their date to
// …/revisions/<vid>/view and have "Revert".

useRole('admin');

let created: string[] = [];

test.afterEach(async ({ page }) => {
  for (const path of created) await deleteNode(page, path);
  created = [];
});

const revisionRows = (page: Page) => page.locator('main table tbody tr');

/** Creates a published page and saves it twice more: Revision 1, 2, 3. */
async function pageWithThreeRevisions(page: Page): Promise<string> {
  const form = new NodeForm(page);
  const path = await form.createPage({
    title: uniqueTitle(),
    body: 'Revision 1',
    state: 'published',
  });
  created.push(path);
  await expect(page.getByText('Revision 1', { exact: true })).toBeVisible();

  for (const text of ['Revision 2', 'Revision 3']) {
    await form.openEdit(path);
    await form.replaceBody(text);
    await form.state.selectOption('published');
    await form.save();
  }
  await expect(page.getByText('Revision 3', { exact: true })).toBeVisible();
  return path;
}

test.describe(
  'content lifecycle: revisions',
  { tag: ['@no-prod', '@desktop-only'] },
  () => {
    test('CL-3: revisions list and an old revision', async ({ page }) => {
      // 1–2. Three saves.
      const path = await pageWithThreeRevisions(page);

      // 3. The revisions list.
      await page.goto(`${path}/revisions`);
      await expect(page.locator('h1').first()).toHaveText(/^Revisions for /);
      const rows = revisionRows(page);
      expect(await rows.count()).toBeGreaterThanOrEqual(3);
      await expect(rows.first()).toContainText('Current revision');

      // 4. The oldest revision.
      await rows.last().locator('a').first().click();
      await expect(page).toHaveURL(/\/revisions\/\d+\/view$/);
      await expect(page.getByText('Revision 1', { exact: true })).toBeVisible();
      await expectNoErrors(page);
    });

    test('CL-4: revert to an older revision', async ({ page }) => {
      const path = await pageWithThreeRevisions(page);
      await page.goto(`${path}/revisions`);
      const before = await revisionRows(page).count();

      // 1. Revert the oldest.
      await revisionRows(page)
        .last()
        .getByRole('link', { name: 'Revert' })
        .click();
      await expect(page).toHaveURL(/\/revisions\/\d+\/revert/);
      await page.getByRole('button', { name: 'Revert', exact: true }).click();
      await expect(statusMessages(page)).toBeVisible();
      await expectNoErrors(page);

      // 2. The page shows the old body.
      await page.goto(path);
      await expect(page.getByText('Revision 1', { exact: true })).toBeVisible();
      await expect(page.getByText('Revision 3', { exact: true })).toHaveCount(
        0,
      );

      // 3. One more revision, and it's current.
      await page.goto(`${path}/revisions`);
      await expect(revisionRows(page)).toHaveCount(before + 1);
      await expect(revisionRows(page).first()).toContainText(
        'Current revision',
      );
    });
  },
);
