import { test, expect } from '../../helpers/fixtures';
import { addDays, siteDate } from '../../helpers/dates';
import {
  EventCards,
  LOCATION_EVENTS,
  UPCOMING_EVENTS,
  type EventCard,
} from '../../pages/event-cards.page';
import { EventOccurrencePage } from '../../pages/event-occurrence.page';
import { EventsSearchPage } from '../../pages/events-search.page';
import { HomePage } from '../../pages/home.page';

// [Smoke] - Events - Test Plan, EP-1 to EP-3: what a visitor sees of events
// outside the search itself: the 45-day window, the event cards on the
// homepage and a location page, and the location line of an online-only
// event (MNDEED-9620). See test-suites/smoke/smoke-events.md.
//
// Read-only and prod-safe; runs on desktop and on a phone.

const OCCURRENCE_HREF = /^\/events\/event-occurrence\/\d+$/;

// The LV-1 location pages (tests/smoke/anonymous/locations.spec.ts), then
// Bemidji, which had events when the plan was written.
const LOCATION_PAGES = [
  '/careerforce-location/careerforce-aitkin',
  '/careerforce-location/careerforce-bloomington',
  '/careerforce-location/careerforce-brooklyn-center',
  '/anywhere',
  '/careerforce-location/careerforce-bemidji',
];

// "November 23, 2026" -> "2026-11-23".
function ymd(date: string): string {
  const parsed = new Date(`${date} 00:00:00 UTC`);
  expect(Number.isNaN(parsed.getTime()), `Unreadable card date "${date}"`).toBe(false);
  return parsed.toISOString().slice(0, 10);
}

test('EP-1: Events stay within 45 days', async ({ page }) => {
  const D = siteDate();
  const last = addDays(D, 45);
  const search = new EventsSearchPage(page);

  await test.step('1. nothing from D+46 to D+365', async () => {
    await search.search({ fs: addDays(D, 46), fe: addDays(D, 365) });
    const occurrences = search.view.locator('a[href^="/events/event-occurrence/"]');
    expect(
      await occurrences.evaluateAll((els) => els.map((el) => el.getAttribute('href'))),
      `CareerForce events listed after ${last}`,
    ).toEqual([]);
  });

  await test.step('2. the last card of the unfiltered list', async () => {
    await search.search();
    const total = await search.resultCount();
    expect(total, 'The Events page lists no events').toBeGreaterThan(0);
    const lastPage = Math.ceil(total / 15) - 1;
    if (lastPage > 0) await search.search({ page: String(lastPage) });
    const dates = await search.cardDateTimes();
    expect(dates.length, 'The last page of the Events page has no cards').toBeGreaterThan(0);
    const lastDate = dates[dates.length - 1].slice(0, 10);
    expect(
      lastDate <= last,
      `The last event is on ${lastDate}, after D+45 (${last})`,
    ).toBe(true);
  });

  await test.step('3. homepage Upcoming Events', async () => {
    await new HomePage(page).goto();
    const upcoming = new EventCards(page, UPCOMING_EVENTS);
    await expect(upcoming.cards.first()).toBeAttached();
    const outside = (await upcoming.read()).filter((card) => {
      const date = ymd(card.date);
      return date < D || date > last;
    });
    expect(
      outside.map((c) => `${c.title} (${c.date})`),
      `Homepage cards dated before ${D} or after ${last}`,
    ).toEqual([]);
  });
});

test('EP-2: Homepage and location pages feature events', async ({ page }) => {
  const event = new EventOccurrencePage(page);

  await test.step('1. the first homepage Upcoming Events card', async () => {
    await new HomePage(page).goto();
    const upcoming = new EventCards(page, UPCOMING_EVENTS);
    await expect(upcoming.cards.first()).toBeAttached();
    const [card] = await upcoming.read();
    expect(card, 'The homepage has no Upcoming Events card').toBeTruthy();
    expectCompleteCard(card);

    await page.goto(card.href);
    await expect(event.title).toContainText(card.title);
    await expect(event.date).toHaveText(new RegExp(`${escape(card.date)}$`));
  });

  // The first location page with an "Events" section.
  let locationPath: string | undefined;
  let locationName = '';
  await test.step('2. a location page with events', async () => {
    for (const path of LOCATION_PAGES) {
      await page.goto(path);
      if ((await page.locator(`main ${LOCATION_EVENTS}`).count()) > 0) {
        locationPath = path;
        locationName = ((await page.getByRole('main').getByRole('heading', { level: 1 }).textContent()) ?? '').trim();
        break;
      }
    }
  });
  test.skip(!locationPath, `None of ${LOCATION_PAGES.join(', ')} has an Events section`);

  const section = new EventCards(page, LOCATION_EVENTS);
  let first: EventCard | undefined;
  await test.step('2. its Events section', async () => {
    const cards = await section.read();
    expect(cards.length, `${locationPath} lists no events`).toBeGreaterThan(0);
    first = cards[0];
    expectCompleteCard(first);
    await expect(section.allEventsLink()).toHaveAttribute('href', '/education-and-training/events');
  });

  await test.step('3. its first event', async () => {
    await page.goto(first!.href);
    await expect(event.title).toContainText(first!.title);
    await expect(event.offeredBy).toContainText(locationName);
  });
});

test('EP-3: Online-only event card shows "Online" (MNDEED-9620)', async ({ page }) => {
  const search = new EventsSearchPage(page);
  const event = new EventOccurrencePage(page);

  // An online-only event: its only format tag is "Online", and its event
  // page's LOCATION is "Online".
  type Candidate = { title: string; href: string; date: string; location: string };
  let picked: Candidate | undefined;
  let offeredBy: string | null = null;
  await test.step('pick an online-only event', async () => {
    await search.search({ 'ff[virtual]': 'virtual' });
    const candidates: Candidate[] = await search.cards.evaluateAll((els) =>
      els
        .filter((el) => {
          const pills = Array.from(el.querySelectorAll('.cf-events-search-card-pill')).map((p) =>
            (p.textContent ?? '').trim().toLowerCase(),
          );
          return pills.includes('online') && !pills.includes('in person');
        })
        .map((el) => ({
          title: (el.querySelector('a.cf-events-search-card-link')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
          href: el.querySelector('a.cf-events-search-card-link')?.getAttribute('href') ?? '',
          date: (el.querySelector('.cf-events-search-card-icon-date time')?.textContent ?? '').trim(),
          location: (el.querySelector('.views-row')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
        })),
    );
    for (const candidate of candidates) {
      await page.goto(candidate.href);
      if (((await event.location.textContent()) ?? '').replace(/\s+/g, ' ').trim() === 'Online') {
        picked = candidate;
        offeredBy = await event.offeredBy.getByRole('link').first().getAttribute('href');
        break;
      }
    }
  });
  test.skip(!picked, 'No online-only event on the first page of the Online-filtered Events page');
  const online = picked!;

  await test.step('1. the Events page card', async () => {
    expect(online.location, `Events page card of ${online.href}`).toBe('Online');
  });

  await test.step('2. the same event on the homepage or its location page', async () => {
    let other: EventCard | undefined;
    let where = '';
    const matches = (c: EventCard) =>
      c.href === online.href || (c.title === online.title && c.date === online.date);

    await new HomePage(page).goto();
    const upcoming = new EventCards(page, UPCOMING_EVENTS);
    await expect(upcoming.cards.first()).toBeAttached();
    other = (await upcoming.read()).find(matches);
    where = 'the homepage';

    if (!other && offeredBy) {
      await page.goto(offeredBy);
      const section = new EventCards(page, LOCATION_EVENTS);
      for (let pageNo = 1; !other && pageNo <= 10; pageNo++) {
        if ((await section.cards.count()) === 0) break;
        other = (await section.read()).find(matches);
        where = `${offeredBy} (page ${pageNo})`;
        if (other || (await section.nextPage().count()) === 0) break;
        await section.nextPage().click();
        await page.waitForURL(new RegExp(`page=${pageNo}`));
      }
    }

    expect(
      other,
      `${online.title} (${online.date}) is on neither the homepage nor ${offeredBy ?? 'a location page'}`,
    ).toBeTruthy();
    expect(other!.location, `Card for ${online.title} (${online.date}) on ${where}`).toBe('Online');
  });
});

function expectCompleteCard(card: EventCard) {
  expect(card.title, 'card title').not.toBe('');
  expect(card.href, `link of "${card.title}"`).toMatch(OCCURRENCE_HREF);
  expect(card.date, `date of "${card.title}"`).toMatch(/^[A-Z][a-z]+ \d{1,2}, \d{4}$/);
  expect(card.time, `time of "${card.title}"`).toMatch(/^\d{1,2}:\d{2} [AP]M/);
  expect(card.location, `location of "${card.title}"`).not.toBe('');
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
