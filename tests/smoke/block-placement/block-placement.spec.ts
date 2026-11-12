import type { Page } from '@playwright/test';

import { test, expect } from '../../helpers/fixtures';
import { useRole } from '../../helpers/roles';
import { uniqueToken } from '../../helpers/test-data';
import { rolePage, visitorPage } from '../../helpers/visitor';
import { BlockLayout } from '../../pages/block-layout.page';
import { statusMessages } from '../../pages/node-form.page';

// [Smoke] - Block Placement - Test Plan — BP-1 to BP-4. See
// test-suites/smoke/smoke-block-placement.md.
//
// One block goes through all four cases, in order. While placed, it shows in
// the footer of every page for every visitor, so afterAll removes the
// placement and deletes the block even when a case failed. QA/stage only.

useRole('admin');
test.describe.configure({ mode: 'serial' });

const token = uniqueToken();
const description = `Playwright test ${token}`;
const body = `Playwright block body ${token}`;
const EVENTS = '/education-and-training/events';
let placementId: string | undefined;

/** True when the visitor sees the block's text in the footer of `path`. */
async function visitorSeesBlock(visitor: Page, path: string): Promise<boolean> {
  const response = await visitor.goto(path);
  expect(response?.status(), `${path} loads`).toBe(200);
  return (await visitor.locator('.region--footer').getByText(body).count()) > 0;
}

test.describe('block placement', { tag: ['@no-prod', '@desktop-only'] }, () => {
  test.afterAll(async ({ browser }, testInfo) => {
    const page = await rolePage(browser, testInfo, 'admin');
    try {
      const layout = new BlockLayout(page);
      const id = placementId ?? (await layout.placementId(description));
      if (id) await layout.removePlacement(id);
      const contentId = await layout.blockContentId(description);
      if (contentId) await layout.deleteBlockContent(contentId);
    } finally {
      await page.context().close();
    }
  });

  test('BP-1: create a content block', async ({ page }) => {
    const layout = new BlockLayout(page);

    // 1. Create it.
    await layout.createGenericTextBlock(description, body);
    await expect(statusMessages(page)).toBeVisible();

    // 2. It's in the library once, as a Generic text block.
    const row = await layout.libraryRow(description);
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Generic text block');
  });

  test('BP-2: place the block on every page', async ({
    page,
    browser,
  }, testInfo) => {
    const layout = new BlockLayout(page);

    // 1. The Configure block form, for Footer Content.
    await layout.openPlaceForm(description, 'footer');
    await expect(page.locator('select[name="region"]')).toHaveValue('footer');

    // 2. No title, no visibility rules; save.
    await page.locator('input[name="settings[label_display]"]').uncheck();
    placementId =
      (await layout.saveBlock()) || (await layout.placementId(description));
    expect(placementId, 'the placement was saved').toBeTruthy();
    await page.goto('/admin/structure/block');
    const row = layout.placementRow(description);
    await expect(row).toHaveCount(1);
    await expect(row.locator('select[name$="[region]"]')).toHaveValue('footer');

    // 3. A visitor sees it on both pages.
    const visitor = await visitorPage(browser, testInfo);
    try {
      expect(await visitorSeesBlock(visitor, '/'), 'block on /').toBe(true);
      expect(
        await visitorSeesBlock(visitor, EVENTS),
        `block on ${EVENTS}`,
      ).toBe(true);
    } finally {
      await visitor.context().close();
    }
  });

  test('BP-3: restrict the block to one page', async ({
    page,
    browser,
  }, testInfo) => {
    expect(placementId, 'BP-2 placed the block').toBeTruthy();
    const layout = new BlockLayout(page);

    // 1. Pages: show only on the events page.
    await layout.restrictToPages(placementId!, [EVENTS]);
    await expect(statusMessages(page)).toBeVisible();

    // 2. A visitor sees it on the events page only.
    const visitor = await visitorPage(browser, testInfo);
    try {
      expect(
        await visitorSeesBlock(visitor, EVENTS),
        `block on ${EVENTS}`,
      ).toBe(true);
      expect(await visitorSeesBlock(visitor, '/'), 'block on /').toBe(false);
    } finally {
      await visitor.context().close();
    }
  });

  test('BP-4: remove the block', async ({ page, browser }, testInfo) => {
    expect(placementId, 'BP-2 placed the block').toBeTruthy();
    const layout = new BlockLayout(page);

    // 1. Remove the placement.
    await layout.removePlacement(placementId!);
    await expect(statusMessages(page)).toBeVisible();
    await page.goto('/admin/structure/block');
    await expect(layout.placementRow(description)).toHaveCount(0);
    placementId = undefined;

    // 2. Delete the block content.
    const contentId = await layout.blockContentId(description);
    expect(contentId, 'the block is in the library').toBeTruthy();
    await layout.deleteBlockContent(contentId!);
    await expect(statusMessages(page)).toBeVisible();
    await expect(await layout.libraryRow(description)).toHaveCount(0);

    // 3. A visitor sees it nowhere.
    const visitor = await visitorPage(browser, testInfo);
    try {
      expect(
        await visitorSeesBlock(visitor, EVENTS),
        `block on ${EVENTS}`,
      ).toBe(false);
      expect(await visitorSeesBlock(visitor, '/'), 'block on /').toBe(false);
    } finally {
      await visitor.context().close();
    }
  });
});
