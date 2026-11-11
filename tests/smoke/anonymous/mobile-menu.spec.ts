import { test, expect } from '../../helpers/fixtures';
import { HomePage } from '../../pages/home.page';
import { MobileHeader } from '../../pages/mobile-header.page';

// [Smoke] - Public Site - General - Test Plan, MB-1 (mobile only).
// See test-plans/smoke-public-site.md.
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

// The "Find a Job" sub-menu, as on QA (2026-11-04).
const FIND_A_JOB_LINKS = [
  ['Job Search', '/job-search'],
  ['Job Fairs and Networking Events', '/jobfairs'],
  ['Explore Careers', '/explore/careers'],
  ['Explore Industries', '/industry/all-industries-careerseekers'],
] as const;

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

    await test.step('open the "Find a Job" sub-menu', async () => {
      const subMenu = header.subMenuButton('Find a Job');
      await expect(subMenu).toHaveAttribute('aria-expanded', 'false');
      await expect(header.subMenuLinks('Find a Job').first()).toBeHidden();
      await subMenu.click();
      await expect(subMenu).toHaveAttribute('aria-expanded', 'true');
      for (const [name, href] of FIND_A_JOB_LINKS) {
        await expect(header.subMenuLinks('Find a Job').filter({ hasText: name })).toHaveAttribute(
          'href',
          href,
        );
        await expect(header.subMenuLinks('Find a Job').filter({ hasText: name })).toBeVisible();
      }
    });

    await test.step('close the menu', async () => {
      await header.menuToggle.click();
      await expect(header.menuToggle).toHaveAttribute('aria-expanded', 'false');
      await expect(header.mainNavigation).toBeHidden();
    });
  },
);
