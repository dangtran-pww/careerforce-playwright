import { type Locator, type Page } from '@playwright/test';

// Shared base for the two plain listing/view pages Phase 1 covers:
// /education-and-training/events and /programs-services. Both need to render their heading and list at
// least one item — neither has a bespoke interaction to test here.
//
// Each listing item is an <article> card inside <main> on both pages
// (events wrap theirs in <li>, services use node--view-mode-card), so
// matching the article role works for both without page-specific classes.
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

  listItems(): Locator {
    return this.page.getByRole('main').getByRole('article');
  }
}
