import { type Locator, type Page } from '@playwright/test';

// Below the lg breakpoint the header swaps the desktop menu for a Search
// button and a "Toggle Navigation" (hamburger) button. The mobile copy of
// the main menu lives in #page__masthead-mobile and stays hidden until the
// toggle opens it. The header is the same on every page, so this isn't tied
// to the homepage.
export class MobileHeader {
  readonly page: Page;
  readonly menuToggle: Locator;
  readonly mainNavigation: Locator;

  constructor(page: Page) {
    this.page = page;
    this.menuToggle = page.getByRole('button', { name: 'Toggle Navigation' });
    this.mainNavigation = page
      .locator('#page__masthead-mobile')
      .getByRole('navigation', { name: 'Main navigation' });
  }

  topLevelLink(name: string): Locator {
    return this.mainNavigation.getByRole('link', { name, exact: true });
  }
}
