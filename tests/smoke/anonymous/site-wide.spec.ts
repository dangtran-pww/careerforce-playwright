import { test, expect } from '../../helpers/fixtures';
import { HomePage } from '../../pages/home.page';
import { SiteFooter } from '../../pages/site-footer.page';

// [Smoke] - Anonymous - Test Plan, GN-1 to GN-4.
// See test-plans/smoke-anonymous.md.
//
// Site-wide basics that every page relies on: the "page not found" page,
// the footer, the main menu's pages, and the "Skip to main content" link.

test('GN-1: an unknown address shows the Page Not Found page', async ({ page }) => {
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

test('GN-2: the footer shows contact details and its links', async ({ page }) => {
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

// The 5 top-level items of the main menu. Each page's title starts with
// the menu item's name (e.g. "Resources for" → "Resources for Job Seekers
// and Career Explorers").
const MAIN_MENU = [
  ['Find a Job', '/find-job'],
  ['Job Loss Resources', '/job-loss-resources'],
  ['Job Search Tools', '/job-search-tools'],
  ['Education and Training', '/education-and-training'],
  ['Resources for', '/resources-job-seekers-and-career-explorers'],
] as const;

for (const [name, href] of MAIN_MENU) {
  test(`GN-3: main menu "${name}" page opens`, async ({ page }) => {
    // The menu link is on every page (shown on desktop, inside the ☰ menu
    // on a phone), so check it's there before opening its page.
    await page.goto('/');
    await expect(
      page.getByRole('banner').locator(`a[href="${href}"]`).first(),
    ).toBeAttached();

    const response = await page.goto(href);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toContainText(name);
  });
}

test('GN-4: "Skip to main content" moves keyboard focus past the header', async ({
  page,
}) => {
  const home = new HomePage(page);
  await home.goto();
  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skipLink).toHaveAttribute('href', '#main-content');
  await expect(page.locator('#main-content')).toBeAttached();

  // It's hidden until focused; the first Tab focuses it and shows it.
  await page.keyboard.press('Tab');
  await expect(skipLink).toBeFocused();
  await expect
    .poll(async () => (await skipLink.boundingBox())?.width ?? 0, {
      message: 'the skip link should show at full size once focused',
    })
    .toBeGreaterThan(10);

  // Following it, the next Tab lands inside the main content, not in the
  // header menu.
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main-content$/);
  await page.keyboard.press('Tab');
  await expect(page.locator('#main-content :focus')).toHaveCount(1);
});
