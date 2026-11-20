import { type Locator, type Page } from '@playwright/test';

// The desktop main menu in the site header (#block-careerforce-skin-main-menu),
// shown from 1024px wide; narrower screens get the ☰ menu (MobileHeader).
// Each top-level item is a list item in its first list, with its link, a
// "Sub-menu for <name>" arrow button and its own list of submenu links. The
// submenu shows while the mouse is on the item (plain CSS hover), with no
// delay. Editors can change the items' text and links, so they are found by
// position, not by name.
//
// The locators include hidden elements, so the menu can be read when it
// isn't shown (on a phone) and toBeHidden() means hidden, not missing.
export class MainMenu {
  readonly page: Page;
  readonly navigation: Locator;
  readonly items: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navigation = page.locator('#block-careerforce-skin-main-menu');
    this.items = this.navigation
      .getByRole('list', { includeHidden: true })
      .first()
      .locator(':scope > li');
  }

  // The top-level items' names and links, in menu order.
  async readItems(): Promise<{ name: string; href: string }[]> {
    return this.items.evaluateAll((items) =>
      items.map((item) => {
        const link = item.querySelector('a');
        return {
          name: link?.textContent?.trim() ?? '',
          href: link?.getAttribute('href') ?? '',
        };
      }),
    );
  }

  topLevelLink(index: number): Locator {
    return this.items.nth(index).getByRole('link', { includeHidden: true }).first();
  }

  subMenu(index: number): Locator {
    return this.items.nth(index).getByRole('list', { includeHidden: true });
  }

  subMenuLinks(index: number): Locator {
    return this.subMenu(index).getByRole('link', { includeHidden: true });
  }

  async hover(index: number) {
    await this.topLevelLink(index).hover();
  }

  // Moves the mouse to the bottom-left corner of the window, well away
  // from the header and any open submenu.
  async moveMouseAway() {
    const { height } = this.page.viewportSize() ?? { height: 720 };
    await this.page.mouse.move(5, height - 5);
  }
}
