import { expect, type Locator, type Page } from '@playwright/test';

import { expectNoErrors } from './node-form.page';

// Content blocks and their placement in the site theme, CareerForce Skin.
// See test-suites/smoke/smoke-block-placement.md → "What the site has".

export const THEME = 'careerforce_skin';

export class BlockLayout {
  constructor(readonly page: Page) {}

  /** BP-1: adds a Generic text block (the site has no "Basic" type). */
  async createGenericTextBlock(description: string, body: string) {
    await this.page.goto('/block/add/generic_text_block');
    await this.page.locator('input[name="info[0][value]"]').fill(description);
    const editor = this.page.locator(
      '[data-drupal-selector="edit-body-wrapper"] .ck-editor__editable',
    );
    await editor.click();
    await this.page.keyboard.type(body);
    await this.page.getByRole('button', { name: 'Save', exact: true }).click();
    await this.page.waitForURL((url) => !url.pathname.startsWith('/block/add'));
    await expectNoErrors(this.page);
  }

  /** The block's row in the Custom block library, filtered by description. */
  async libraryRow(description: string): Promise<Locator> {
    await this.page.goto(
      `/admin/content/block?info=${encodeURIComponent(description)}`,
    );
    return this.page.locator('main table tbody tr', { hasText: description });
  }

  /** The block content's id from its library row, or undefined. */
  async blockContentId(description: string): Promise<string | undefined> {
    const row = await this.libraryRow(description);
    if (!(await row.count())) return undefined;
    const href = await row
      .first()
      .locator('a[href*="/delete"]')
      .first()
      .getAttribute('href');
    return href?.match(/\/(\d+)\/delete/)?.[1];
  }

  /** BP-2: opens the "Configure block" form for this block in `region`. */
  async openPlaceForm(description: string, region: string) {
    await this.page.goto(
      `/admin/structure/block/library/${THEME}?region=${region}`,
    );
    const row = this.page.locator('main table tbody tr', {
      hasText: description,
    });
    await expect(row).toHaveCount(1);
    // The link opens a dialog by AJAX; following its address opens the
    // same form as a page.
    const href = await row
      .getByRole('link', { name: 'Place block' })
      .getAttribute('href');
    await this.page.goto(href!);
    await expect(this.page.locator('h1').first()).toHaveText('Configure block');
  }

  /** Saves the Configure block form and returns the placement's id. */
  async saveBlock(): Promise<string> {
    await this.page
      .getByRole('button', { name: 'Save block', exact: true })
      .click();
    await this.page.waitForURL(
      /\/admin\/structure\/block(\/list\/[^/?]+)?(\?|$)/,
    );
    await expectNoErrors(this.page);
    const fromUrl = new URL(this.page.url()).searchParams.get(
      'block-placement',
    );
    return fromUrl ?? '';
  }

  /** The placement's row on the Block layout page. */
  placementRow(description: string): Locator {
    return this.page.locator('#blocks tbody tr', { hasText: description });
  }

  /** The placement's machine name, read from its Configure link. */
  async placementId(description: string): Promise<string | undefined> {
    await this.page.goto('/admin/structure/block');
    const row = this.placementRow(description);
    if (!(await row.count())) return undefined;
    const href = await row
      .first()
      .locator('a[href*="/admin/structure/block/manage/"]')
      .first()
      .getAttribute('href');
    return href?.match(/\/manage\/([^/?]+)/)?.[1];
  }

  /** BP-3: shows the placement only on the listed pages. */
  async restrictToPages(placementId: string, pages: string[]) {
    await this.page.goto(`/admin/structure/block/manage/${placementId}`);
    await this.page
      .locator('.vertical-tabs__menu-item a', { hasText: /^Pages/ })
      .click();
    await this.page
      .locator('textarea[name="visibility[request_path][pages]"]')
      .fill(pages.join('\n'));
    await this.page.getByLabel('Show for the listed pages').check();
    await this.saveBlock();
  }

  /** BP-4 step 1: removes the placement. */
  async removePlacement(placementId: string) {
    await this.page.goto(`/admin/structure/block/manage/${placementId}/delete`);
    await this.page.getByRole('button', { name: /^(Remove|Delete)$/ }).click();
    await this.page.waitForURL((url) => !url.pathname.endsWith('/delete'));
    await expectNoErrors(this.page);
  }

  /** BP-4 step 2: deletes the block content. */
  async deleteBlockContent(id: string) {
    await this.page.goto(`/admin/content/block/${id}/delete`);
    await this.page
      .getByRole('button', { name: 'Delete', exact: true })
      .click();
    await this.page.waitForURL((url) => !url.pathname.endsWith('/delete'));
    await expectNoErrors(this.page);
  }
}
