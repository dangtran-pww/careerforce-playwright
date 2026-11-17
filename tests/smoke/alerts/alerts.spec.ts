import type { Page } from '@playwright/test';

import { test, expect } from '../../helpers/fixtures';
import { useRole } from '../../helpers/roles';
import { uniqueToken } from '../../helpers/test-data';
import { rolePage, visitorPage } from '../../helpers/visitor';
import { BlockLayout } from '../../pages/block-layout.page';
import { statusMessages } from '../../pages/node-form.page';

// [Smoke] - Alerts and Notifications - Test Plan — AL-1 to AL-5. See
// test-suites/smoke/smoke-alerts.md.
//
// An alert (Page Pre Top) and a notification (Notifications) go through all
// five cases, in order. While placed, each shows at the top of every page
// for every visitor, so afterAll removes both placements and deletes both
// blocks even when a case failed. QA/stage only.

useRole('admin');
test.describe.configure({ mode: 'serial' });

const token = uniqueToken();
const prefix = `Playwright test ${token}`;
const ALERT = {
  description: `${prefix} alert`,
  body: `Playwright alert body ${token}`,
  color: '#b12028',
  rgb: 'rgb(177, 32, 40)',
  region: 'page_pre_top',
  type: 'alert',
} as const;
const NOTIFICATION = {
  description: `${prefix} notification`,
  body: `Playwright notification body ${token}`,
  color: '#005cab',
  rgb: 'rgb(0, 92, 171)',
  region: 'notifications',
  type: 'notification',
} as const;
const PAGES = ['/', '/education-and-training/events'];
const placements: Record<'alert' | 'notification', string | undefined> = {
  alert: undefined,
  notification: undefined,
};

/** Opens `path` as the visitor and checks it loads. */
async function open(visitor: Page, path: string) {
  const response = await visitor.goto(path);
  expect(response?.status(), `${path} loads`).toBe(200);
}

/**
 * Where the alert's text sits and how its bar looks: whether it comes before
 * the skip link, whether it's inside the page header, and the bar's
 * background and text colors (the bar is the nearest element up from the
 * text with a background color).
 */
function alertLayout(visitor: Page) {
  return visitor
    .getByText(ALERT.body, { exact: true })
    .evaluate((text) => {
      const skip = document.querySelector('.skip-link');
      let bar: Element | null = text;
      while (
        bar &&
        getComputedStyle(bar).backgroundColor.replace(/\s/g, '') ===
          'rgba(0,0,0,0)'
      ) {
        bar = bar.parentElement;
      }
      return {
        beforeSkipLink:
          !!skip &&
          !!(
            text.compareDocumentPosition(skip) &
            Node.DOCUMENT_POSITION_FOLLOWING
          ),
        inHeader: !!text.closest('#page__header'),
        background: bar ? getComputedStyle(bar).backgroundColor : '',
        color: getComputedStyle(text).color,
      };
    });
}

/**
 * The notification's row: the icon box (nearest element up from the icon svg
 * with a background color), the bordered text box (nearest element up from
 * the text with a border), the row that holds both, and the text's own width.
 */
function notificationLayout(visitor: Page) {
  return visitor
    .getByText(NOTIFICATION.body, { exact: true })
    .evaluate((text) => {
      const wrapper = text.closest('[role="alert"]');
      const icon = wrapper?.querySelector('svg') ?? null;
      let iconBox: Element | null = icon;
      while (
        iconBox &&
        getComputedStyle(iconBox).backgroundColor.replace(/\s/g, '') ===
          'rgba(0,0,0,0)'
      ) {
        iconBox = iconBox.parentElement;
      }
      let textBox: Element | null = text;
      while (
        textBox &&
        parseFloat(getComputedStyle(textBox).borderTopWidth) === 0
      ) {
        textBox = textBox.parentElement;
      }
      let row: Element | null = textBox?.parentElement ?? null;
      while (row && iconBox && !row.contains(iconBox)) row = row.parentElement;
      const range = document.createRange();
      range.selectNodeContents(text);
      const box = (el: Element | null) => {
        if (!el) return null;
        const { left, right, top, bottom, width, height } =
          el.getBoundingClientRect();
        return { left, right, top, bottom, width, height };
      };
      const nav = document.querySelector('#page__header nav');
      return {
        inHeader: !!text.closest('#page__header'),
        beforeMenu:
          !!nav &&
          !!(
            text.compareDocumentPosition(nav) &
            Node.DOCUMENT_POSITION_FOLLOWING
          ),
        hasIcon: !!icon,
        iconBackground: iconBox ? getComputedStyle(iconBox).backgroundColor : '',
        icon: box(iconBox),
        text: box(textBox),
        row: box(row),
        textWidth: range.getBoundingClientRect().width,
      };
    });
}

test.describe(
  'alerts and notifications',
  { tag: ['@no-prod', '@desktop-only'] },
  () => {
    test.afterAll(async ({ browser }, testInfo) => {
      // Two removals and two deletions take about a minute on QA.
      test.setTimeout(180_000);
      const page = await rolePage(browser, testInfo, 'admin');
      try {
        const layout = new BlockLayout(page);
        for (const block of [ALERT, NOTIFICATION]) {
          const id =
            placements[block.type] ??
            (await layout.placementId(block.description));
          if (id) await layout.removePlacement(id);
          const contentId = await layout.blockContentId(block.description);
          if (contentId) await layout.deleteBlockContent(contentId);
        }
      } finally {
        await page.context().close();
      }
    });

    test('AL-1: create an alert and a notification', async ({ page }) => {
      const layout = new BlockLayout(page);

      // 1. The alert.
      await layout.createAlertNotificationBlock(ALERT);
      await expect(statusMessages(page)).toBeVisible();

      // 2. The notification.
      await layout.createAlertNotificationBlock(NOTIFICATION);
      await expect(statusMessages(page)).toBeVisible();

      // 3. Both are in the library once, as Alert & Notification blocks.
      const rows = await layout.libraryRow(prefix);
      await expect(rows).toHaveCount(2);
      for (const block of [ALERT, NOTIFICATION]) {
        const row = rows.filter({ hasText: block.description });
        await expect(row).toHaveCount(1);
        await expect(row).toContainText('Alert & Notification');
      }
    });

    test('AL-2: alert shows on every page', async ({
      page,
      browser,
    }, testInfo) => {
      const layout = new BlockLayout(page);

      // 1. The Configure block form, for Page Pre Top.
      await layout.openPlaceForm(ALERT.description, ALERT.region);
      await expect(page.locator('select[name="region"]')).toHaveValue(
        ALERT.region,
      );

      // 2. No title, no visibility rules; save.
      await page.locator('input[name="settings[label_display]"]').uncheck();
      placements.alert =
        (await layout.saveBlock()) ||
        (await layout.placementId(ALERT.description));
      expect(placements.alert, 'the alert was placed').toBeTruthy();
      await expect(statusMessages(page)).toBeVisible();
      await page.goto('/admin/structure/block');
      const row = layout.placementRow(ALERT.description);
      await expect(row).toHaveCount(1);
      await expect(row.locator('select[name$="[region]"]')).toHaveValue(
        ALERT.region,
      );

      // 3. A visitor sees it at the top of both pages.
      const visitor = await visitorPage(browser, testInfo);
      try {
        for (const path of PAGES) {
          await open(visitor, path);
          const text = visitor.getByText(ALERT.body, { exact: true });
          await expect(text, `alert on ${path}`).toHaveCount(1);
          await expect(
            visitor.locator('[role="alert"]', { has: text }),
            `alert on ${path} is in role="alert"`,
          ).not.toHaveCount(0);
          const found = await alertLayout(visitor);
          expect(found.beforeSkipLink, `alert before skip link on ${path}`).toBe(
            true,
          );
          expect(found.inHeader, `alert outside the header on ${path}`).toBe(
            false,
          );
          expect(found.background, `alert bar color on ${path}`).toBe(
            ALERT.rgb,
          );
          expect(found.color, `alert text color on ${path}`).toBe(
            'rgb(255, 255, 255)',
          );
        }
      } finally {
        await visitor.context().close();
      }
    });

    test('AL-3: notification shows on every page', async ({
      page,
      browser,
    }, testInfo) => {
      const layout = new BlockLayout(page);

      // 1. The Configure block form, for Notifications.
      await layout.openPlaceForm(NOTIFICATION.description, NOTIFICATION.region);
      await expect(page.locator('select[name="region"]')).toHaveValue(
        NOTIFICATION.region,
      );

      // 2. No title, no visibility rules; save.
      await page.locator('input[name="settings[label_display]"]').uncheck();
      placements.notification =
        (await layout.saveBlock()) ||
        (await layout.placementId(NOTIFICATION.description));
      expect(placements.notification, 'the notification was placed').toBeTruthy();
      await expect(statusMessages(page)).toBeVisible();
      await page.goto('/admin/structure/block');
      const row = layout.placementRow(NOTIFICATION.description);
      await expect(row).toHaveCount(1);
      await expect(row.locator('select[name$="[region]"]')).toHaveValue(
        NOTIFICATION.region,
      );

      // 3. A visitor sees it in the page header on both pages, and the
      // alert is still there.
      const visitor = await visitorPage(browser, testInfo);
      try {
        for (const path of PAGES) {
          await open(visitor, path);
          const text = visitor.getByText(NOTIFICATION.body, { exact: true });
          await expect(text, `notification on ${path}`).toHaveCount(1);
          await expect(
            visitor.locator('[role="alert"]', { has: text }),
            `notification on ${path} is in role="alert"`,
          ).not.toHaveCount(0);
          const found = await notificationLayout(visitor);
          expect(found.inHeader, `notification in the header on ${path}`).toBe(
            true,
          );
          expect(
            found.beforeMenu,
            `notification above the site menu on ${path}`,
          ).toBe(true);
          expect(found.hasIcon, `notification icon on ${path}`).toBe(true);
          expect(
            found.iconBackground,
            `notification icon box color on ${path}`,
          ).toBe(NOTIFICATION.rgb);
          await expect(
            visitor.getByText(ALERT.body, { exact: true }),
            `alert still on ${path}`,
          ).toHaveCount(1);
        }
      } finally {
        await visitor.context().close();
      }
    });

    test('AL-4: notification text box fills the row (MNDEED-7946)', async ({
      browser,
    }, testInfo) => {
      expect(placements.notification, 'AL-3 placed the notification').toBeTruthy();
      const visitor = await visitorPage(browser, testInfo);
      try {
        await visitor.setViewportSize({ width: 1366, height: 768 });

        // 1. The notification shows.
        await open(visitor, '/');
        await expect(
          visitor.getByText(NOTIFICATION.body, { exact: true }),
        ).toBeVisible();

        // 2. The bordered text box fills the row beside the icon box.
        const { icon, text, row, textWidth } =
          await notificationLayout(visitor);
        expect(icon, 'icon box found').not.toBeNull();
        expect(text, 'bordered text box found').not.toBeNull();
        expect(row, 'row found').not.toBeNull();
        expect(
          Math.abs(text!.left - icon!.right),
          'text box starts where the icon box ends',
        ).toBeLessThanOrEqual(2);
        expect(
          Math.abs(row!.right - text!.right),
          "text box reaches the row's right edge",
        ).toBeLessThanOrEqual(2);
        expect(
          text!.width,
          'text box is much wider than its text',
        ).toBeGreaterThan(textWidth * 2);
        expect(
          Math.abs(text!.height - icon!.height),
          'icon box and text box are the same height',
        ).toBeLessThanOrEqual(1);
      } finally {
        await visitor.context().close();
      }
    });

    test('AL-5: remove the alert and the notification', async ({
      page,
      browser,
    }, testInfo) => {
      const layout = new BlockLayout(page);

      // 1. Remove both placements.
      for (const block of [ALERT, NOTIFICATION]) {
        const id =
          placements[block.type] ??
          (await layout.placementId(block.description));
        expect(id, `${block.type} is placed`).toBeTruthy();
        await layout.removePlacement(id!);
        await expect(statusMessages(page)).toBeVisible();
        placements[block.type] = undefined;
      }
      await page.goto('/admin/structure/block');
      await expect(layout.placementRow(ALERT.description)).toHaveCount(0);
      await expect(layout.placementRow(NOTIFICATION.description)).toHaveCount(
        0,
      );

      // 2. Delete both blocks.
      for (const block of [ALERT, NOTIFICATION]) {
        const contentId = await layout.blockContentId(block.description);
        expect(contentId, `${block.type} is in the library`).toBeTruthy();
        await layout.deleteBlockContent(contentId!);
        await expect(statusMessages(page)).toBeVisible();
      }
      await expect(await layout.libraryRow(prefix)).toHaveCount(0);

      // 3. A visitor sees neither.
      const visitor = await visitorPage(browser, testInfo);
      try {
        for (const path of PAGES) {
          await open(visitor, path);
          await expect(
            visitor.getByText(ALERT.body, { exact: true }),
            `alert on ${path}`,
          ).toHaveCount(0);
          await expect(
            visitor.getByText(NOTIFICATION.body, { exact: true }),
            `notification on ${path}`,
          ).toHaveCount(0);
        }
      } finally {
        await visitor.context().close();
      }
    });
  },
);
