import { test, expect } from '../../helpers/fixtures';
import { EventsSearchPage } from '../../pages/events-search.page';
import { ListingPage } from '../../pages/listing.page';

// [Smoke] - Events - Test Plan, EP-4 (was LV-2 in smoke-public-site.md).
// See test-suites/smoke/smoke-events.md.

test('EP-4: Events page lists events', async ({ page }) => {
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
  // log in to register (not clicked: registering is ER-1, logged in).
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
