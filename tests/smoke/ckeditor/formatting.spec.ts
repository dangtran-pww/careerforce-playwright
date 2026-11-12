import type { Page } from '@playwright/test';

import { test, expect } from '../../helpers/fixtures';
import { useRole } from '../../helpers/roles';
import { uniqueTitle } from '../../helpers/test-data';
import {
  NodeForm,
  deleteNode,
  statusMessages,
} from '../../pages/node-form.page';

// [Smoke] - CKEditor 5 - Test Plan — CK-2 to CK-6. See
// test-plans/smoke-ckeditor.md.
//
// Each test writes a Page body in CKEditor (format Full HTML, the default),
// saves it as Draft so visitors never see it, checks the saved page, and
// deletes it afterwards.

useRole('admin');

let created: string[] = [];

test.afterEach(async ({ page }) => {
  for (const path of created) await deleteNode(page, path);
  created = [];
});

/** Opens a new Page with a title; the caller writes the body. */
async function newPage(page: Page): Promise<NodeForm> {
  const form = new NodeForm(page);
  await form.openAdd();
  await expect(form.textFormat).toHaveValue('full_html');
  await form.title.fill(uniqueTitle());
  await form.focusBody();
  return form;
}

/** Saves as Draft; the saved page is shown afterwards. */
async function saveDraft(form: NodeForm) {
  await form.state.selectOption('draft');
  created.push(await form.save());
  await expect(statusMessages(form.page)).toBeVisible();
}

test.describe(
  'CKEditor formatting',
  { tag: ['@no-prod', '@desktop-only'] },
  () => {
    test('CK-2: headings', async ({ page }) => {
      const form = await newPage(page);
      const keys = page.keyboard;
      const heading = form.bodyToolbar.locator('.ck-heading-dropdown');

      // 1. Three lines as Heading 2, 3 and 4.
      for (const level of [2, 3, 4]) {
        await keys.type(`Heading level ${level}`);
        await heading.locator('button').first().click();
        await heading
          .getByRole('menuitemradio', { name: `Heading ${level}` })
          .or(
            heading.locator('.ck-list__item button', {
              hasText: `Heading ${level}`,
            }),
          )
          .first()
          .click();
        await expect(heading.locator('.ck-button__label').first()).toHaveText(
          `Heading ${level}`,
        );
        await keys.press('Enter');
      }

      // 2. The saved page has the headings.
      await saveDraft(form);
      for (const level of [2, 3, 4]) {
        await expect(
          page.locator(`main h${level}`, { hasText: `Heading level ${level}` }),
        ).toHaveCount(1);
      }
    });

    test('CK-3: bulleted and numbered lists with sub-items', async ({
      page,
    }) => {
      const form = await newPage(page);
      const keys = page.keyboard;
      const editor = form.bodyEditor;

      // 1. A bulleted list with a sub-item.
      await form.toolbarButton('Bulleted List').click();
      await keys.type('Bullet one');
      await keys.press('Enter');
      await keys.type('Bullet sub');
      await form.toolbarButton('Increase indent').click();
      await expect(
        editor.locator('ul li ul li', { hasText: 'Bullet sub' }),
      ).toHaveCount(1);

      // 2. A numbered list with a sub-item. Enter on an empty item moves it
      // out one level at a time, until it leaves the list.
      for (let i = 0; i < 3; i++) await keys.press('Enter');
      await form.toolbarButton('Numbered List').click();
      await keys.type('Number one');
      await keys.press('Enter');
      await keys.type('Number sub');
      await form.toolbarButton('Increase indent').click();
      await expect(
        editor.locator('ol li ol li', { hasText: 'Number sub' }),
      ).toHaveCount(1);

      // 3. The saved page has both nested lists (structure only).
      await saveDraft(form);
      await expect(
        page.locator('main ul li ul li', { hasText: 'Bullet sub' }),
      ).toHaveCount(1);
      await expect(
        page.locator('main ol li ol li', { hasText: 'Number sub' }),
      ).toHaveCount(1);
    });

    test('CK-4: table', async ({ page }) => {
      const form = await newPage(page);
      const cells = ['Cell A1', 'Cell B1', 'Cell A2', 'Cell B2'];

      // 1. Insert a 2 × 2 table from the grid (10 boxes per row).
      await form.toolbarButton('Insert table').click();
      await form.bodyToolbar
        .locator('.ck-insert-table-dropdown-grid-box')
        .nth(11)
        .click();
      await expect(form.bodyEditor.locator('table tr')).toHaveCount(2);
      await expect(form.bodyEditor.locator('table td, table th')).toHaveCount(
        4,
      );

      // 2. Fill each cell and save.
      for (const [i, text] of cells.entries()) {
        if (i > 0) await page.keyboard.press('Tab');
        await page.keyboard.type(text);
      }
      await saveDraft(form);
      const table = page.locator('main table').first();
      await expect(table.locator('tr')).toHaveCount(2);
      for (const text of cells)
        await expect(table.getByText(text, { exact: true })).toBeVisible();
      await expect(table.locator('tr').first()).toContainText('Cell B1');
    });

    test('CK-5: media embed', async ({ page }) => {
      const form = await newPage(page);
      const dialog = page.getByRole('dialog');

      // 1. The media library opens and lists images.
      await form.toolbarButton('Insert Media').click();
      await expect(dialog).toBeVisible();
      const imageTab = dialog.getByRole('link', { name: /^Image\b/ });
      if (await imageTab.count()) await imageTab.first().click();
      const items = dialog.locator('.js-media-library-item');
      await expect(items.first()).toBeVisible();

      // 2. Insert the first image.
      await items.first().locator('input[type="checkbox"]').check();
      await page.getByRole('button', { name: 'Insert selected' }).click();
      await expect(dialog).toBeHidden();
      await expect(form.bodyEditor.locator('img').first()).toBeVisible();

      // 3. The saved page shows the image, loaded.
      await saveDraft(form);
      const image = page
        .locator(
          'main [data-entity-type="media"] img, main .media img, main article.media img',
        )
        .first();
      await expect(image).toBeVisible();
      await expect
        .poll(() =>
          image.evaluate((img) => (img as HTMLImageElement).naturalWidth),
        )
        .toBeGreaterThan(0);
    });

    test('CK-6: bold, italic and a link', async ({ page }) => {
      const form = await newPage(page);
      const keys = page.keyboard;
      const editor = form.bodyEditor;

      // 1. One word bold, one italic (keyboard shortcuts toggle the style).
      await keys.type('Alpha ');
      await keys.press('ControlOrMeta+B');
      await keys.type('Bravo');
      await keys.press('ControlOrMeta+B');
      await keys.type(' ');
      await keys.press('ControlOrMeta+I');
      await keys.type('Charlie');
      await keys.press('ControlOrMeta+I');
      await keys.type(' Delta');
      await expect(editor.locator('strong', { hasText: 'Bravo' })).toHaveCount(
        1,
      );
      await expect(editor.locator('i, em', { hasText: 'Charlie' })).toHaveCount(
        1,
      );

      // 2. Select "Delta" and link it.
      for (let i = 0; i < 'Delta'.length; i++)
        await keys.press('Shift+ArrowLeft');
      await form.toolbarButton('Link').click();
      const url = page
        .locator('.ck-link-form input, .ck-balloon-panel input[type="text"]')
        .first();
      await url.fill('/education-and-training/events');
      await keys.press('Enter');
      await expect(editor.locator('a', { hasText: 'Delta' })).toHaveCount(1);

      // 3. The saved page has them.
      await saveDraft(form);
      await expect(
        page.locator('main strong', { hasText: 'Bravo' }),
      ).toHaveCount(1);
      await expect(
        page.locator('main em, main i', { hasText: 'Charlie' }).first(),
      ).toBeVisible();
      await expect(
        page.locator('main a[href$="/education-and-training/events"]', {
          hasText: 'Delta',
        }),
      ).toHaveCount(1);
    });
  },
);
