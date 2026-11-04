import { test, expect } from '../../helpers/fixtures';
import { EventsSearchPage } from '../../pages/events-search.page';
import { ListingPage } from '../../pages/listing.page';

// [Smoke] - Anonymous - Test Plan, LV-2/LV-3.
// See test-plans/smoke-anonymous.md.

test('LV-2: /education-and-training/events view page loads', async ({ page }) => {
  const events = new ListingPage(page, '/education-and-training/events', 'Events');
  await events.goto();
  await expect(events.mainHeading()).toBeVisible();
  await expect(events.listItems().first()).toBeVisible();

  // The first event card has a title, a date, a start time and a place.
  const search = new EventsSearchPage(page);
  const card = search.cards.first();
  const link = card.locator('a.cf-events-search-card-link');
  const title = ((await link.textContent()) ?? '').trim();
  await test.step('first event card', async () => {
    expect(title).not.toBe('');
    await expect(link).toHaveAttribute('href', /^\/events\/event-occurrence\/\d+$/);
    await expect(card.locator('time').first()).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}T/);
    await expect(card.locator('time').filter({ hasText: /^\d{1,2}:\d{2} [AP]M$/ }).first()).toBeVisible();
    await expect(search.cardLocations.first()).not.toBeEmpty();
  });

  // The event page: an anonymous visitor sees the details, and is asked to
  // log in to register (not clicked: registering isn't part of this plan).
  await test.step('event page', async () => {
    await link.click();
    await expect(page).toHaveURL(/\/events\/event-occurrence\/\d+$/);
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 1 })).toContainText(title);
    for (const section of ['Date', 'Time', 'Location', 'Offered By']) {
      await expect(main.getByRole('heading', { level: 2, name: section, exact: true })).toBeVisible();
    }
    await expect(main.getByRole('button', { name: 'Log In or Create Account' })).toBeVisible();
  });
});

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
