import {
  expect,
  type FrameLocator,
  type Locator,
  type Page,
} from '@playwright/test';

import { expectNoErrors, statusMessages } from './node-form.page';

// The media screens editors use: a media field's Entity Browser (a
// collapsed section on the node form with a "Select images" button that
// opens a "browse existing" list in an iframe dialog: QA's browsers have no
// upload tab), the media add forms (/media/add/<type>), the media list
// (/admin/content/media) and the media delete form. See
// test-suites/smoke/smoke-media.md.

/** One Entity Browser media field on a node form, e.g. Teaser Image. */
export class MediaField {
  readonly page: Page;
  /** The field's collapsible section (`<details>`). */
  readonly section: Locator;
  readonly dialog: Locator;
  /** The browser's own page, inside the dialog's iframe. */
  readonly browser: FrameLocator;
  readonly browserRows: Locator;
  /** The items the field holds, shown in the section once selected. */
  readonly selection: Locator;
  private readonly field: string;

  /** `field` is the machine name, `label` the section's title. */
  constructor(page: Page, field: string, label: string) {
    this.page = page;
    this.field = field;
    // AJAX adds a suffix to the selectors when the widget rebuilds.
    this.section = page
      .locator('details')
      .filter({ has: page.locator('summary', { hasText: label }) });
    this.dialog = page.getByRole('dialog');
    this.browser = this.dialog.frameLocator('iframe');
    this.browserRows = this.browser.locator('form tbody tr', {
      has: this.browser.locator('input[type="checkbox"]'),
    });
    this.selection = this.section.locator(
      `[data-drupal-selector^="edit-${field.replace(/_/g, '-')}-current"] .item-container`,
    );
  }

  /** Opens the section if needed, then the browser; waits for its list. */
  async openBrowser() {
    const summary = this.section.locator('summary');
    if ((await summary.getAttribute('aria-expanded')) !== 'true')
      await summary.click();
    await this.section.getByRole('button', { name: /^Select / }).click();
    await expect(this.dialog).toBeVisible();
    await expect(this.browserRows.first()).toBeVisible();
  }

  /** Narrows the browser's list to one name ("Filter by image name"). */
  async filterByName(name: string) {
    await this.browser.getByLabel(/^Filter by .* name$/).fill(name);
    await this.browser.getByRole('button', { name: 'Apply' }).click();
    await expect(this.browserRows).toHaveCount(1);
    await expect(this.browserRows).toContainText(name);
  }

  /** Ticks the first listed item and adds it to the field. */
  async selectFirstItem() {
    await this.browserRows.first().locator('input[type="checkbox"]').check();
    // The browser's own submit ("Select images"), not the filter's Apply.
    await this.browser.locator('input#edit-submit[name="op"]').click();
    await expect(this.dialog).toBeHidden();
  }

  /** The media ids the field holds (its hidden `target_id`: `media:<id>`). */
  async selectedIds(): Promise<string[]> {
    const value = await this.page
      .locator(`input[name="${this.field}[target_id]"]`)
      .inputValue();
    return value
      .split(/\s+/)
      .filter(Boolean)
      .map((item) => item.replace(/^media:/, ''));
  }
}

/** The media list filtered to one name; its rows. */
export async function mediaListRows(
  page: Page,
  name: string,
): Promise<Locator> {
  await page.goto(`/admin/content/media?name=${encodeURIComponent(name)}`);
  return page.locator('table tbody tr', { hasText: name });
}

/**
 * Adds a media item on /media/add/<type> with a file and a name, saves it
 * and returns its id (from the list, since saving goes back to it).
 */
export async function addMedia(
  page: Page,
  options: { type: 'file' | 'image'; file: string; name: string; alt?: string },
): Promise<string> {
  await page.goto(`/media/add/${options.type}`);
  await page.locator('main input[type="file"]').setInputFiles(options.file);
  // The upload is done when the file shows with a Remove button.
  await expect(
    page.locator('main').getByRole('button', { name: 'Remove' }).first(),
  ).toBeVisible();
  if (options.alt !== undefined)
    await page.locator('main input[name$="[alt]"]').fill(options.alt);
  await page.locator('input[name="name[0][value]"]').fill(options.name);
  await page
    .locator('#edit-actions, .form-actions')
    .getByRole('button', { name: 'Save', exact: true })
    .click();
  await expect(statusMessages(page)).toBeVisible();
  await expectNoErrors(page);
  return mediaId(page, options.name);
}

/** The id of the media item with this (unique) name, from the media list. */
export async function mediaId(page: Page, name: string): Promise<string> {
  const rows = await mediaListRows(page, name);
  await expect(rows).toHaveCount(1);
  const href = await rows
    .getByRole('link', { name, exact: true })
    .getAttribute('href');
  const id = href?.match(/\/media\/(\d+)/)?.[1];
  expect(id, `No media id in the link of "${name}"`).toBeTruthy();
  return id!;
}

/** Deletes a media item by id; ignores one already gone. */
export async function deleteMedia(page: Page, id: string) {
  const response = await page.goto(`/media/${id}/delete`);
  if (response?.status() === 404) return;
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/delete'));
  await expectNoErrors(page);
}
