import { expect, type Locator, type Page } from '@playwright/test';

// The Page content type's add/edit form (/node/add/page, /<alias>/edit) and
// delete form. Pages use the "Content Review" moderation workflow, so the
// state is a select ("Save as" on add), not a Published checkbox. See
// test-plans/smoke-content-lifecycle.md → "What the site has".

export type ModerationState = 'draft' | 'review' | 'published' | 'archived';

export class NodeForm {
  readonly page: Page;
  readonly title: Locator;
  readonly bodyField: Locator;
  readonly bodyEditor: Locator;
  readonly bodyToolbar: Locator;
  readonly textFormat: Locator;
  readonly state: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title = page.locator('input[name="title[0][value]"]');
    this.bodyField = page.locator('[data-drupal-selector="edit-body-wrapper"]');
    this.bodyEditor = this.bodyField.locator('.ck-editor__editable');
    this.bodyToolbar = this.bodyField.locator('.ck-toolbar');
    this.textFormat = page.locator('select[name="body[0][format]"]');
    this.state = page.locator('select[name="moderation_state[0][state]"]');
    // The form's own Save (a translation form says "Save (this translation)").
    this.saveButton = page
      .locator('#edit-actions, .form-actions')
      .getByRole('button', { name: /^Save\b/ })
      .first();
  }

  async openAdd() {
    await this.page.goto('/node/add/page');
    await expect(this.bodyEditor).toBeVisible();
  }

  async openEdit(path: string) {
    await this.page.goto(`${path}/edit`);
    await expect(this.bodyEditor).toBeVisible();
  }

  /** Clicks into the body editor, at the end of what's there. */
  async focusBody() {
    await this.bodyEditor.click();
    await this.page.keyboard.press('ControlOrMeta+End');
  }

  async typeBody(text: string) {
    await this.focusBody();
    await this.page.keyboard.type(text);
  }

  async replaceBody(text: string) {
    await this.bodyEditor.click();
    await this.page.keyboard.press('ControlOrMeta+A');
    await this.page.keyboard.press('Delete');
    await this.page.keyboard.type(text);
  }

  /** A toolbar button of the body editor, by its label. */
  toolbarButton(name: string): Locator {
    return this.bodyToolbar.getByRole('button', { name, exact: true }).first();
  }

  /** Saves, checks there's no error, and returns the saved page's path. */
  async save(): Promise<string> {
    const before = this.page.url();
    await this.saveButton.click();
    await this.page.waitForURL((url) => url.href !== before);
    await expectNoErrors(this.page);
    return new URL(this.page.url()).pathname;
  }

  /** Creates a Page and returns its path (its URL alias). */
  async createPage(options: {
    title: string;
    body: string;
    state?: ModerationState;
  }): Promise<string> {
    await this.openAdd();
    await this.title.fill(options.title);
    await this.typeBody(options.body);
    await this.state.selectOption(options.state ?? 'draft');
    const path = await this.save();
    await expect(statusMessages(this.page)).toBeVisible();
    return path;
  }
}

export function statusMessages(page: Page): Locator {
  return page
    .locator('.messages--status, [data-drupal-messages] [role="status"]')
    .first();
}

export async function expectNoErrors(page: Page) {
  await expect(
    page.locator('.messages--error, [data-drupal-messages] [role="alert"]'),
  ).toHaveCount(0);
  await expect(
    page.getByText('The website encountered an unexpected error'),
  ).toHaveCount(0);
}

/** Deletes a node (and its translations) by path; ignores one already gone. */
export async function deleteNode(page: Page, path: string) {
  const response = await page.goto(`${path}/delete`);
  if (response?.status() === 404) return;
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/delete'));
  await expectNoErrors(page);
}
