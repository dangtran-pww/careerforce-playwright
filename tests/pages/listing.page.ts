import { type Locator, type Page } from '@playwright/test';

// Shared base for the two plain listing/view pages Phase 1 covers: /events
// and /programs-services. Both just need to render their heading without
// error — neither has a bespoke interaction to test here.
export class ListingPage {
  readonly page: Page;
  private readonly path: string;
  private readonly heading: string;

  constructor(page: Page, path: string, heading: string) {
    this.page = page;
    this.path = path;
    this.heading = heading;
  }

  async goto() {
    await this.page.goto(this.path);
  }

  mainHeading(): Locator {
    return this.page.getByRole('heading', { level: 1, name: this.heading });
  }
}
