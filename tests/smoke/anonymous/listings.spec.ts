import { test, expect } from '../../helpers/fixtures';
import { ListingPage } from '../../pages/listing.page';

// [Smoke] - Public Site - General - Test Plan, LV-3.
// See test-suites/smoke/smoke-public-site.md. LV-2 (Events page) moved to
// test-suites/smoke/smoke-events.md as EP-4.

test('LV-3: /programs-services view page loads', async ({ page }) => {
  const programsAndServices = new ListingPage(
    page,
    '/programs-services',
    'Programs and Services',
  );
  await programsAndServices.goto();
  await expect(programsAndServices.mainHeading()).toBeVisible();
  await expect(programsAndServices.listItems().first()).toBeVisible();

  // The first 2 cards each open a page with the same title as the card.
  const cardLinks = page.getByRole('main').getByRole('article').getByRole('heading', { level: 3 }).getByRole('link');
  const first2 = [];
  for (const link of (await cardLinks.all()).slice(0, 2)) {
    first2.push({
      title: ((await link.textContent()) ?? '').trim(),
      href: (await link.getAttribute('href')) ?? '',
    });
  }
  expect(first2.length).toBeGreaterThan(0);
  for (const { title, href } of first2) {
    await test.step(title, async () => {
      expect(href).toMatch(/^\/programs-services\/[\w-]+$/);
      await page.goto(href);
      await expect(
        page.getByRole('main').getByRole('heading', { level: 1, name: title, exact: true }),
      ).toBeVisible();
    });
  }
});
