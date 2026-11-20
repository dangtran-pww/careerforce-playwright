import { test, expect } from '../../helpers/fixtures';
import { HomePage } from '../../pages/home.page';
import { MobileHeader } from '../../pages/mobile-header.page';

// [Smoke] - Public Site - General - Test Plan, MB-1 (mobile only).
// See test-suites/smoke/smoke-public-site.md.
//
// Given: an anonymous visitor on a phone
// When: they tap the menu button in the header
// Then: the main navigation opens with its top-level items, and the first
//   item's sub-menu opens with its own items
//
// Editors can change the menu, so the test checks counts, not names.

test(
  'MB-1: mobile menu button opens the main navigation',
  { tag: '@mobile-only' },
  async ({ page }) => {
    const home = new HomePage(page);
    const header = new MobileHeader(page);
    await home.goto();

    await test.step('open the menu', async () => {
      await expect(header.menuToggle).toHaveAttribute('aria-expanded', 'false');
      await expect(header.mainNavigation).toBeHidden();
      await header.menuToggle.click();
      await expect(header.menuToggle).toHaveAttribute('aria-expanded', 'true');
      await expect(header.mainNavigation).toBeVisible();
      // More than 1 menu item: the first two are shown.
      await expect(header.topLevelLink(0)).toBeVisible();
      await expect(header.topLevelLink(1)).toBeVisible();
    });

    await test.step("open the first item's sub-menu", async () => {
      const subMenu = header.subMenuButton(0);
      await expect(subMenu).toHaveAttribute('aria-expanded', 'false');
      await expect(header.subMenuLinks(0).first()).toBeHidden();
      await subMenu.click();
      await expect(subMenu).toHaveAttribute('aria-expanded', 'true');
      // At least 1 menu item.
      await expect(header.subMenuLinks(0).first()).toBeVisible();
    });

    await test.step('close the menu', async () => {
      await header.menuToggle.click();
      await expect(header.menuToggle).toHaveAttribute('aria-expanded', 'false');
      await expect(header.mainNavigation).toBeHidden();
    });
  },
);
