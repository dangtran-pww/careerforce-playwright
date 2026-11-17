import path from 'node:path';

import type { Page } from '@playwright/test';

import { test, expect } from '../../helpers/fixtures';
import { useRole } from '../../helpers/roles';
import { uniqueTitle } from '../../helpers/test-data';
import {
  MediaField,
  addMedia,
  deleteMedia,
  mediaListRows,
} from '../../pages/media-library.page';
import {
  NodeForm,
  deleteNode,
  statusMessages,
} from '../../pages/node-form.page';

// [Smoke] - Media Browser - Test Plan — ML-1 to ML-4. See
// test-suites/smoke/smoke-media.md.
//
// ML-1 and ML-2 use the Teaser image media field of a Draft Page, so
// visitors never see it. Every test deletes the pages and media it created.

useRole('admin');

const fixture = (name: string) =>
  path.join(__dirname, '..', '..', 'fixtures', name);

let pages: string[] = [];
let media: string[] = [];

test.afterEach(async ({ page }) => {
  for (const node of pages) await deleteNode(page, node);
  for (const id of media) await deleteMedia(page, id);
  pages = [];
  media = [];
});

/** Opens a new Draft Page with a title, and its Teaser Image field. */
async function newPage(page: Page) {
  const form = new NodeForm(page);
  await form.openAdd();
  await form.title.fill(uniqueTitle());
  await form.state.selectOption('draft');
  const teaser = new MediaField(page, 'field_teaser_image', 'Teaser Image');
  return { form, teaser };
}

test.describe('Media library', { tag: ['@no-prod', '@desktop-only'] }, () => {
  test('ML-1: browse the library from a media field', async ({ page }) => {
    const { form, teaser } = await newPage(page);

    // 1. The browser lists existing images.
    await teaser.openBrowser();

    // 2. Select the first one; the field shows it.
    await teaser.selectFirstItem();
    await expect(teaser.selection).toHaveCount(1);
    await expect(teaser.selection.locator('img')).toBeVisible();
    const ids = await teaser.selectedIds();
    expect(ids).toHaveLength(1);

    // 3. Save; the page keeps it.
    pages.push(await form.save());
    await expect(statusMessages(page)).toBeVisible();
    await page.goto(`${pages[0]}/edit`);
    await expect(teaser.selection).toHaveCount(1);
    expect(await teaser.selectedIds()).toEqual(ids);
  });

  test('ML-2: use a newly uploaded image in a media field', async ({
    page,
  }) => {
    const name = uniqueTitle();

    // 1. Add sample.jpg as an Image media item, with alt text.
    media.push(
      await addMedia(page, {
        type: 'image',
        file: fixture('sample.jpg'),
        name,
        alt: 'Playwright test image',
      }),
    );
    const rows = await mediaListRows(page, name);
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText('Image');

    // 2. Find it by name in the Teaser Image browser and select it.
    const { form, teaser } = await newPage(page);
    await teaser.openBrowser();
    await teaser.filterByName(name);
    await teaser.selectFirstItem();
    await expect(teaser.selection.locator('img')).toBeVisible();
    expect(await teaser.selectedIds()).toEqual(media);

    // 3. Save; the page keeps the new image.
    pages.push(await form.save());
    await expect(statusMessages(page)).toBeVisible();
    await page.goto(`${pages[0]}/edit`);
    expect(await teaser.selectedIds()).toEqual(media);
  });

  test('ML-3: upload a document to the library', async ({ page }) => {
    const name = uniqueTitle();

    // 1. Add sample.pdf as a File media item (addMedia checks the status
    // message).
    media.push(
      await addMedia(page, { type: 'file', file: fixture('sample.pdf'), name }),
    );

    // 2. The media list has it, as a File.
    const rows = await mediaListRows(page, name);
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText('File');
  });

  test('ML-4: delete newly uploaded media', async ({ page }) => {
    const image = uniqueTitle();
    const file = uniqueTitle();
    media.push(
      await addMedia(page, {
        type: 'image',
        file: fixture('sample.jpg'),
        name: image,
        alt: 'Playwright test image',
      }),
      await addMedia(page, {
        type: 'file',
        file: fixture('sample.pdf'),
        name: file,
      }),
    );

    // 1. Delete each from its delete form.
    for (const [i, name] of [image, file].entries()) {
      await page.goto(`/media/${media[i]}/delete`);
      await page.getByRole('button', { name: 'Delete', exact: true }).click();
      await expect(statusMessages(page)).toContainText(name);
      await expect(statusMessages(page)).toContainText('deleted');
    }

    // 2. Neither is on the media list.
    for (const name of [image, file])
      await expect(await mediaListRows(page, name)).toHaveCount(0);
  });
});
