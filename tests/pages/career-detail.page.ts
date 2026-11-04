import { type Locator, type Page } from '@playwright/test';

// A career (occupation) page, /explore/careers/<O*NET code>, e.g.
// /explore/careers/29-1141.00 for Registered Nurses. The page is drawn in
// the browser: <main> says "Loading..." until /occupation/<code>/json
// returns, so wait for the heading before checking anything else.
export class CareerDetailPage {
  readonly page: Page;
  readonly main: Locator;
  readonly heading: Locator;
  readonly jobOpeningsLink: Locator;

  constructor(page: Page, title: string) {
    this.page = page;
    this.main = page.getByRole('main');
    this.heading = this.main.getByRole('heading', { level: 1, name: title });
    this.jobOpeningsLink = this.main.getByRole('link', {
      name: 'Find current job openings in this occupation',
    });
  }

  sectionHeading(name: string): Locator {
    return this.main.getByRole('heading', { level: 2, name, exact: true });
  }
}
