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

  // Each top-level item has a "Sub-menu for <name>" button next to its link,
  // which shows that item's own list of links.
  subMenuButton(name: string): Locator {
    return this.mainNavigation.getByRole('button', { name: `Sub-menu for ${name}` });
  }

  subMenuLinks(name: string): Locator {
    return this.mainNavigation
      .getByRole('listitem')
      // `has` is searched inside each list item, so it must not start from
      // the navigation again.
      .filter({ has: this.page.getByRole('button', { name: `Sub-menu for ${name}` }) })
      .getByRole('list')
      .getByRole('link');
  }
}
