import { type Locator, type Page } from '@playwright/test';

// An event page, /events/event-occurrence/<id>. Each detail is a block with
// an <h2> ("Date", "Time", "Location", "Offered By") and its value.
export class EventOccurrencePage {
  readonly page: Page;
  readonly main: Locator;
  readonly title: Locator;
  readonly date: Locator;
  readonly location: Locator;
  readonly offeredBy: Locator;

  constructor(page: Page) {
    this.page = page;
    this.main = page.getByRole('main');
    this.title = this.main.getByRole('heading', { level: 1 });
    // "Tuesday, November 17, 2026"
    this.date = this.main
      .locator('.block-field-blockhappenings-occurrencehappenings-occurrencetimestamp-start time')
      .first();
    this.location = this.main
      .locator('.block-views-blockhappenings-occurrence-location .view-content')
      .first();
    this.offeredBy = this.main
      .locator('.block-field-blockhappenings-occurrencehappenings-occurrencefield-locations-primary .content')
      .first();
  }

  async goto(id: string) {
    await this.page.goto(`/events/event-occurrence/${id}`);
  }

  // Logged in as a job seeker.
  get registerButton(): Locator {
    return this.main.getByRole('button', { name: 'Register', exact: true });
  }

  get completeRegistrationButton(): Locator {
    return this.main.getByRole('button', { name: 'Complete Registration' });
  }

  get registeredStatus(): Locator {
    return this.main.getByText('You are registered for this event.');
  }

  get cancelRegistrationLink(): Locator {
    return this.main.getByRole('link', { name: 'Cancel Registration' });
  }

  /** The "Cancel Event Registration" Drupal dialog. */
  get cancelDialog(): Locator {
    return this.page.getByRole('dialog');
  }
}
