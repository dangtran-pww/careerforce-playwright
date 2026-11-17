import { type Locator, type Page } from '@playwright/test';

// Event cards outside the Events search: the homepage "Upcoming Events"
// carousel (view display upcoming_events) and a location page's "Events"
// section (block_events_by_service_location). Both use the same green
// cf-card: a hidden full date ("Monday, November 23rd, 2026"), the title
// link (a.cf-card__title, to /events/event-occurrence/<id>), the time
// ("7:00 AM - 7:15 AM") and the location line ("Bemidji, MN or Online").
//
// The homepage carousel is a slick slider: it clones its slides, so every
// card is in the page twice. Clones (.slick-cloned) are left out here.

export const UPCOMING_EVENTS = '.view-display-id-upcoming_events';
export const LOCATION_EVENTS = '.view-display-id-block_events_by_service_location';

export type EventCard = {
  title: string;
  href: string;
  /** "November 23, 2026": the hidden date without weekday or ordinal. */
  date: string;
  time: string;
  location: string;
};

function clean(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

// "Monday, November 23rd, 2026" -> "November 23, 2026".
export function plainDate(text: string): string {
  return clean(text)
    .replace(/^[A-Za-z]+,\s*/, '')
    .replace(/(\d{1,2})(st|nd|rd|th)\b/, '$1');
}

export class EventCards {
  readonly page: Page;
  readonly view: Locator;
  readonly cards: Locator;

  constructor(page: Page, viewClass: string) {
    this.page = page;
    this.view = page.locator(`main ${viewClass}`).first();
    this.cards = this.view
      .locator('article')
      .filter({ has: page.locator('a.cf-card__title') });
  }

  /** The cards in page order, without the carousel's clones. */
  async read(): Promise<EventCard[]> {
    const raw = await this.cards.evaluateAll((els) =>
      els
        .filter((el) => !el.closest('.slick-cloned'))
        .map((el) => {
          const link = el.querySelector('a.cf-card__title');
          return {
            title: link?.textContent ?? '',
            href: link?.getAttribute('href') ?? '',
            date:
              el.querySelector('.field--name-timestamp-start .visually-hidden')
                ?.textContent ?? '',
            time:
              el.querySelector(
                '.field--name-cf-happenings-resolved-time-slot',
              )?.textContent ?? '',
            location:
              el.querySelector(
                '.field--name-cf-happenings-resolved-location-address',
              )?.textContent ?? '',
          };
        }),
    );
    return raw.map((c) => ({
      title: clean(c.title),
      href: c.href,
      date: plainDate(c.date),
      time: clean(c.time),
      location: clean(c.location),
    }));
  }

  /** The pager's "Next page" link (location pages: 6 cards a page). */
  nextPage(): Locator {
    return this.view.getByRole('link', { name: /Next page/ });
  }

  allEventsLink(): Locator {
    return this.view.getByRole('link', {
      name: 'Find a filterable list of all events',
    });
  }
}
