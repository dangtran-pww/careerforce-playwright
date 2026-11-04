import { type Locator, type Page } from '@playwright/test';

// The "Search CareerForce" box in the site header, on every page. It's a GET
// form to /search?k=... The header has two copies of it, one for wide
// screens and one for phones, and only one is shown. On a phone it's hidden
// until the header's "Search" button is tapped.
export class SiteHeader {
  readonly page: Page;
  readonly searchBoxes: Locator;
  readonly phoneSearchButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchBoxes = page.getByRole('textbox', { name: 'Search CareerForce' });
    this.phoneSearchButton = page
      .getByRole('banner')
      .getByRole('button', { name: 'Search' })
      .filter({ visible: true })
      .first();
  }

  async search(keyword: string) {
    const visibleBox = this.searchBoxes.filter({ visible: true });
    if ((await visibleBox.count()) === 0) {
      await this.phoneSearchButton.click();
    }
    await visibleBox.first().fill(keyword);
    await visibleBox.first().press('Enter');
  }
}
