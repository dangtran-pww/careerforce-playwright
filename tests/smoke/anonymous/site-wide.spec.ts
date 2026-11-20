import { test, expect } from '../../helpers/fixtures';
import { HomePage } from '../../pages/home.page';
import { SiteFooter } from '../../pages/site-footer.page';
import { MainMenu } from '../../pages/main-menu.page';

// [Smoke] - Public Site - General - Test Plan, GN-1 to GN-3.
// See test-suites/smoke/smoke-public-site.md.
//
// Site-wide basics that every page relies on: the "page not found" page,
// the footer, and the main menu's pages. GN-4 ("Skip to main content") is
// now HN-1 in test-suites/site-wide/functional-site-wide-header-navigation.md.

test('GN-1: Page Not Found page answers 404 and links back', async ({ page }) => {
  const response = await page.goto('/pww-smoke-test-no-such-page');
  expect(response?.status(), 'an unknown address answers with HTTP 404').toBe(404);
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1, name: 'Page Not Found' })).toBeVisible();

  // Its suggestions lead to working pages. "/events" redirects to the
  // Events page. (Its 4th link, "new career opportunity", sends an
  // anonymous visitor to the login page, so it isn't checked here.)
  for (const [name, href] of [
    ['CareerForce.MN.gov', '/'],
    ['here on CareerForce.MN.gov', '/search'],
    ['CareerForce event or workshop', '/events'],
  ]) {
    await test.step(`"${name}" link`, async () => {
      const link = main.getByRole('link', { name, exact: true });
      await expect(link).toHaveAttribute('href', href);
      const target = await page.request.get(href);
      expect(target.status(), `${href} should open`).toBe(200);
    });
  }
});

const SOCIAL_LINKS = ['Facebook', 'X', 'LinkedIn', 'YouTube', 'Instagram'];

const FOOTER_LINKS = [
  ['CareerForce Locations', '/locations'],
  ['Connect to Our Services', '/programs-services'],
  ['Our Partners', '/our-partners'],
  ['Blog', '/careerforce-blog'],
  ['About CareerForce', '/about-us'],
  ['Your Right to Fair Treatment', '/your-right-fair-treatment'],
  ['Site Index', '/site-index'],
] as const;

test('GN-2: Footer shows its contact details and links', async ({ page }) => {
  const home = new HomePage(page);
  const footer = new SiteFooter(page);
  await home.goto();

  await test.step('contact details', async () => {
    await expect(footer.contactHeading).toBeVisible();
    await expect(footer.footer).toContainText(/Phone:\s*\d{3}-\d{3}-\d{4}/);
    await expect(footer.emailLink).toHaveAttribute('href', /^mailto:\S+@\S+$/);
  });

  await test.step('site links', async () => {
    for (const [name, href] of FOOTER_LINKS) {
      await expect(footer.link(name)).toHaveAttribute('href', href);
    }
  });

  // Each opens the CareerForce account on that site, in a new tab.
  await test.step('social media links', async () => {
    for (const site of SOCIAL_LINKS) {
      const link = footer.link(`Follow CareerForce on ${site}`);
      await expect(link).toHaveAttribute('href', /^https:\/\//);
      await expect(link).toHaveAttribute('target', '_blank');
    }
  });
});

// The main menu's items, their text, links and submenus are editor content
// that can change, so GN-3 reads them from the page rather than a fixed list
// (see "Main menu for GN-3" in the plan for what QA showed). It expects at
// least 1 item, at least 1 visible link per submenu, and each item's page to
// open; it doesn't open the submenu links.
test('GN-3: main menu submenus show on hover and the menu pages open', async ({
  page,
  isMobile,
}) => {
  const menu = new MainMenu(page);
  await page.goto('/');
  // On a phone the desktop menu is hidden but still in the page, with the
  // same items as the ☰ menu, so it is read there too.
  const items = await menu.readItems();
  expect(items.length, 'the main menu has at least 1 item').toBeGreaterThan(0);

  for (const [index, { name, href }] of items.entries()) {
    await test.step(`"${name}" (${href})`, async () => {
      expect(href, `"${name}" links to a page`).not.toBe('');
      // Back to the homepage after the previous item's page.
      if (index > 0) await page.goto('/');

      // On a phone there is no hover and the desktop menu is hidden (the ☰
      // menu is MB-1's job), so steps 1 and 2 run on desktop only.
      if (!isMobile) {
        const subMenuLinks = menu.subMenuLinks(index);

        await test.step('1. hover the item: its submenu shows, alone', async () => {
          await expect(menu.subMenu(index)).toBeHidden();
          await menu.hover(index);
          await expect(menu.subMenu(index)).toBeVisible();
          const count = await subMenuLinks.count();
          expect(count, `the "${name}" submenu has at least 1 link`).toBeGreaterThan(0);
          for (let i = 0; i < count; i++) {
            await expect(subMenuLinks.nth(i)).toBeVisible();
          }
          for (const [other, { name: otherName }] of items.entries()) {
            if (other === index) continue;
            await expect(
              menu.subMenu(other),
              `the "${otherName}" submenu stays closed`,
            ).toBeHidden();
          }
        });

        await test.step('2. move the mouse off the menu: the submenu closes', async () => {
          await menu.moveMouseAway();
          await expect(menu.subMenu(index)).toBeHidden();
        });
      }

      await test.step("3. the item's own page opens", async () => {
        const response = await page.goto(href);
        expect(response?.status()).toBe(200);
      });
    });
  }
});
