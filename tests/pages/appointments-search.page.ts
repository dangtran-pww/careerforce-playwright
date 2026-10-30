import { type Locator, type Page } from '@playwright/test';

// Appointments search (/connect-careerforce/schedule-an-appointment, view
// book_an_appointment). No keyword box: a Mon–Fri date strip (`start`),
// location + radius, and format checkboxes — all GET params. Results are
// location cards, each with slot links whose text lists the slot's formats.
// The filter form (and the strip) is rendered twice — sidebar and mobile
// drawer — so strip/button locators keep to the visible copy.
// See "Appointments search page" in test-plans/smoke-admin-maintenance.md.
export const APPOINTMENTS_PATH = '/connect-careerforce/schedule-an-appointment';

export type Format = 'online' | 'phone' | 'in_person';

export type AppointmentsQuery = {
  start?: string;
  formats?: Format[];
  location?: string;
  radiusKm?: string;
};

export type Slot = {
  href: string;
  location: string;
  formats: Format[];
};

export class AppointmentsSearchPage {
  readonly page: Page;
  readonly view: Locator;
  readonly heading: Locator;
  readonly cards: Locator;
  readonly slotLinks: Locator;
  readonly emptyMessage: Locator;
  readonly strip: Locator;

  constructor(page: Page) {
    this.page = page;
    this.view = page.locator('.view-id-book_an_appointment').first();
    this.heading = page.getByRole('heading', {
      name: /^Available appointments for /,
    });
    this.cards = this.view.locator(
      '.civiserv-location--appointments-for-booking',
    );
    this.slotLinks = this.cards.locator('.appt-slots a');
    this.emptyMessage = this.view.locator('.view-empty');
    this.strip = page
      .locator('ul[aria-label="Appointment booking dates"]')
      .filter({ visible: true })
      .first();
  }

  async search(query: AppointmentsQuery = {}) {
    const params = new URLSearchParams();
    if (query.start) params.set('start', query.start);
    if (query.location) params.set('location[loc][text]', query.location);
    if (query.radiusKm) params.set('location[radius]', query.radiusKm);
    for (const f of query.formats ?? []) params.set(`format[${f}]`, f);
    const qs = params.toString();
    await this.page.goto(qs ? `${APPOINTMENTS_PATH}?${qs}` : APPOINTMENTS_PATH);
  }

  // "CareerForce in Bemidji" → "Bemidji", in page order.
  async locationNames(): Promise<string[]> {
    return (await this.cards.locator('h3').allTextContents()).map((t) =>
      t.trim().replace(/^CareerForce in\s+/i, ''),
    );
  }

  async slots(): Promise<Slot[]> {
    return this.cards.evaluateAll((cards) =>
      cards.flatMap((card) => {
        const location = (card.querySelector('h3')?.textContent ?? '')
          .trim()
          .replace(/^CareerForce in\s+/i, '');
        return Array.from(card.querySelectorAll('.appt-slots a')).map((a) => {
          const text = (a.textContent ?? '').toLowerCase();
          const formats: Format[] = [];
          if (/\bonline\b/.test(text)) formats.push('online');
          if (/\bphone\b/.test(text)) formats.push('phone');
          if (/\bin person\b/.test(text)) formats.push('in_person');
          return { href: a.getAttribute('href') ?? '', location, formats };
        });
      }),
    );
  }

  // Date strip ---------------------------------------------------------

  // `start` values of the strip's linked (selectable, not selected) days.
  async linkedDays(): Promise<string[]> {
    const hrefs = await this.strip
      .locator('li.date-weekday a')
      .evaluateAll((els) => els.map((el) => el.getAttribute('href') ?? ''));
    return hrefs
      .map((h) => new URL(h, 'http://x').searchParams.get('start') ?? '')
      .filter(Boolean);
  }

  nextWeekLink(): Locator {
    return this.strip.getByRole('link', { name: /Next Week/ });
  }

  previousWeekLink(): Locator {
    return this.strip.getByRole('link', { name: /Previous Week/ });
  }

  // Every strip link and the Reset button do a full page load; wait for the
  // URL to change so callers never read the previous page.
  async clickAndWait(target: Locator) {
    const before = this.page.url();
    await target.click();
    await this.page.waitForURL((url) => url.href !== before);
  }

  async goNextWeek() {
    await this.clickAndWait(this.nextWeekLink());
  }

  async goPreviousWeek() {
    await this.clickAndWait(this.previousWeekLink());
  }

  currentStart(): string | null {
    return new URL(this.page.url()).searchParams.get('start');
  }

  // Bookable days to try, in order: this week's selected + linked days, then
  // the following weeks while Next Week is a link. Leaves the page wherever
  // the walk ended — callers navigate again.
  async candidateDays(today: string): Promise<string[]> {
    const days: string[] = [];
    await this.search();
    for (let week = 0; week < 4; week++) {
      const selected = this.currentStart() ?? today;
      for (const d of [selected, ...(await this.linkedDays())]) {
        if (d >= today && !days.includes(d)) days.push(d);
      }
      if ((await this.nextWeekLink().count()) === 0) break;
      await this.goNextWeek();
    }
    return days.sort();
  }

  // First candidate day whose unfiltered results satisfy `accept`; null if
  // none does. Leaves the page on that day.
  async findDay(
    today: string,
    accept: (slots: Slot[]) => boolean,
  ): Promise<{ day: string; slots: Slot[] } | null> {
    for (const day of await this.candidateDays(today)) {
      await this.search({ start: day });
      const slots = await this.slots();
      if (accept(slots)) return { day, slots };
    }
    return null;
  }
}
