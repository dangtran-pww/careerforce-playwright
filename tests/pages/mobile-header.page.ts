import { type Locator, type Page } from '@playwright/test';

// Below the lg breakpoint the header swaps the desktop menu for a Search
// button and a "Toggle Navigation" (hamburger) button. The mobile copy of
// the main menu lives in #page__masthead-mobile and stays hidden until the
// toggle opens it. The header is the same on every page, so this isn't tied
// to the homepage.
//
// Each top-level item is a list item in the menu's first list, with its link,
// a "Sub-menu for <name>" arrow button and its own list of links. Editors can
// change the items' text and links, so they are found by position, not by
// name (as in MainMenu).
export class MobileHeader {
  readonly page: Page;
  readonly menuToggle: Locator;
  readonly mainNavigation: Locator;
  readonly items: Locator;

  constructor(page: Page) {
    this.page = page;
    this.menuToggle = page.getByRole('button', { name: 'Toggle Navigation' });
    this.mainNavigation = page
      .locator('#page__masthead-mobile')
      .getByRole('navigation', { name: 'Main navigation' });
    this.items = this.mainNavigation.getByRole('list').first().locator(':scope > li');
  }

  topLevelLink(index: number): Locator {
    return this.items.nth(index).getByRole('link').first();
  }

  subMenuButton(index: number): Locator {
    return this.items.nth(index).getByRole('button', { name: /^Sub-menu for / });
  }

  subMenuLinks(index: number): Locator {
    return this.items.nth(index).getByRole('list').getByRole('link');
  }
}
