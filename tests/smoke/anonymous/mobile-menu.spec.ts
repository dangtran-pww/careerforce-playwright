import { test, expect } from '../../helpers/fixtures';
import { HomePage } from '../../pages/home.page';
import { MobileHeader } from '../../pages/mobile-header.page';

// [Smoke] - Anonymous - Test Plan, MB-1 (mobile only).
// See test-plans/smoke-anonymous.md.
//
// Given: an anonymous visitor on a phone
// When: they tap the menu button in the header
// Then: the main navigation opens with its top-level links

const TOP_LEVEL_LINKS = [
  'Find a Job',
  'Job Loss Resources',
  'Job Search Tools',
  'Education and Training',
  'Resources for',
];

test(
  'MB-1: mobile menu button opens the main navigation',
  { tag: '@mobile-only' },
  async ({ page }) => {
    const home = new HomePage(page);
    const header = new MobileHeader(page);
    await home.goto();
    await expect(header.menuToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(header.mainNavigation).toBeHidden();
    await header.menuToggle.click();
    await expect(header.menuToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(header.mainNavigation).toBeVisible();
    for (const name of TOP_LEVEL_LINKS) {
      await expect(header.topLevelLink(name)).toBeVisible();
    }
  },
);
