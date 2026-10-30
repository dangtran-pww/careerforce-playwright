import { type Locator, type Page } from '@playwright/test';

// Events search (/education-and-training/events). Doesn't fit SearchPage:
// the count is "Showing X-Y of Z" at the start of .view-header (not
// .view-header__result-summary-header), and .views-row is only the address
// line inside a card, not the card. Every filter/sort is a GET param, so
// tests build the URL instead of clicking the (several times rendered) form.
// See "Events search page" in test-plans/smoke-admin-maintenance.md.
export type EventsQuery = Record<string, string>;

export const EVENTS_PATH = '/education-and-training/events';
const PAGE_SIZE = 15;

export class EventsSearchPage {
  readonly page: Page;
  readonly view: Locator;
  readonly header: Locator;
  readonly cardLinks: Locator;
  readonly cardDates: Locator;
  readonly cardLocations: Locator;
  readonly emptyMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.view = page.locator('.view-id-content_search').first();
    this.header = this.view.locator('.view-header').first();
    this.cardLinks = this.view.locator('a.cf-events-search-card-link');
    this.cardDates = this.view.locator('.cf-events-search-card-icon-date time');
    this.cardLocations = this.view.locator('.views-row');
    this.emptyMessage = this.view.locator('.view-empty');
  }

  async search(query: EventsQuery = {}) {
    const params = new URLSearchParams(query).toString();
    await this.page.goto(params ? `${EVENTS_PATH}?${params}` : EVENTS_PATH);
  }

  // Total across all pages; 0 when the header is missing (no results).
  async resultCount(): Promise<number> {
    if ((await this.header.count()) === 0) return 0;
    const text = (await this.header.textContent()) ?? '';
    const match = text.match(/Showing\s+\d+\s*-\s*\d+\s+of\s+(\d+)/i);
    return match ? Number(match[1]) : 0;
  }

  // ISO start timestamps of the cards on the current page, in page order.
  async cardDateTimes(): Promise<string[]> {
    return this.cardDates.evaluateAll((els) =>
      els.map((el) => el.getAttribute('datetime') ?? ''),
    );
  }

  async cardLocationTexts(): Promise<string[]> {
    return (await this.cardLocations.allTextContents()).map((t) =>
      t.replace(/\s+/g, ' ').trim(),
    );
  }

  // Every event detail link from every pager page of a query.
  async allEventLinks(query: EventsQuery = {}): Promise<string[]> {
    await this.search(query);
    const pages = Math.ceil((await this.resultCount()) / PAGE_SIZE);
    const links = new Set<string>();
    for (let p = 0; p < pages; p++) {
      if (p > 0) await this.search({ ...query, page: String(p) });
      for (const href of await this.cardLinks.evaluateAll((els) =>
        els.map((el) => el.getAttribute('href') ?? ''),
      )) {
        if (href) links.add(href);
      }
    }
    return [...links];
  }
}

// "Similar Events" block on an event detail page (view events_mlt). The
// block isn't rendered at all when there are no similar events.
export class SimilarEventsBlock {
  readonly block: Locator;
  readonly links: Locator;

  constructor(page: Page) {
    this.block = page.locator(
      '.block-views-blockevents-mlt-block-occurrence-mlt',
    );
    this.links = this.block.locator('a[href*="/events/event-occurrence/"]');
  }

  async linkedEventIds(): Promise<string[]> {
    const hrefs = await this.links.evaluateAll((els) =>
      els.map((el) => el.getAttribute('href') ?? ''),
    );
    return [...new Set(hrefs.map(eventIdFromHref))];
  }
}

export function eventIdFromHref(href: string): string {
  return href.match(/\/events\/event-occurrence\/(\d+)/)?.[1] ?? '';
}
