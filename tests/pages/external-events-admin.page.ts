import { expect, type Locator, type Page } from '@playwright/test';

import { expectNoErrors } from './node-form.page';

// The admin side of external events: Webform Submissions ("Externally
// Submitted") and External Events, both under /admin/content/events. Their
// filters are GET params, so tests build the URL. Row operations sit in a
// Drupal dropbutton whose extra links are hidden until it's opened, so
// tests read a link's href and go there. See
// test-suites/smoke/smoke-external-events.md.

export const SUBMISSIONS_PATH = '/admin/content/events/webform-submissions';
export const EXTERNAL_EVENTS_PATH = '/admin/content/events/external-session';

export class ExternalEventsAdmin {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** Webform Submissions searched for `name` (the Search filter). */
  async openSubmissions(name: string) {
    await this.page.goto(`${SUBMISSIONS_PATH}?combine=${encodeURIComponent(name)}`);
    await expectNoErrors(this.page);
  }

  /** External Events filtered by Event Name. */
  async openExternalEvents(name: string) {
    await this.page.goto(`${EXTERNAL_EVENTS_PATH}?n=${encodeURIComponent(name)}`);
    await expectNoErrors(this.page);
  }

  /** The list's rows that mention `name`. */
  rows(name: string): Locator {
    return this.page.locator('main table tbody tr').filter({ hasText: name });
  }

  /** A row operation's link, by its text (it may be hidden in the dropbutton). */
  operation(row: Locator, name: string): Locator {
    return row.locator('a').filter({ hasText: new RegExp(`^\\s*${name}\\s*$`) });
  }

  /** The href of a row operation, or undefined when the row doesn't have it. */
  async operationHref(row: Locator, name: string): Promise<string | undefined> {
    const link = this.operation(row, name);
    if ((await link.count()) === 0) return undefined;
    return (await link.first().getAttribute('href')) ?? undefined;
  }

  /** The text of a row's Status cell. */
  async status(row: Locator): Promise<string> {
    const headers = await this.page.locator('main table thead th').allTextContents();
    const index = headers.findIndex((h) => h.trim() === 'Status');
    return ((await row.locator('td').nth(index).textContent()) ?? '').trim();
  }

  /** Goes to a delete confirmation page and confirms. */
  async confirmDelete(href: string) {
    await this.page.goto(href);
    await this.page
      .locator('main, form')
      .getByRole('button', { name: 'Delete', exact: true })
      .first()
      .click();
    await this.page.waitForURL((url) => !url.pathname.endsWith('/delete'));
    await expectNoErrors(this.page);
  }

  /**
   * Deletes every external event and submission named `name`, events first
   * (deleting a submission leaves its event behind). For cleanup: quiet
   * when there's nothing to delete.
   */
  async deleteAllNamed(name: string) {
    await this.openExternalEvents(name);
    for (;;) {
      const href = await this.operationHref(this.rows(name).first(), 'Delete').catch(() => undefined);
      if (!href) break;
      await this.confirmDelete(href);
      await this.openExternalEvents(name);
    }
    await this.openSubmissions(name);
    for (;;) {
      const href = await this.operationHref(this.rows(name).first(), 'Delete').catch(() => undefined);
      if (!href) break;
      await this.confirmDelete(href);
      await this.openSubmissions(name);
    }
  }
}

/** The status message after a save or delete. */
export async function expectStatusMessage(page: Page) {
  await expect(
    page.locator('.messages--status, [data-drupal-messages] [role="status"]').first(),
  ).toBeVisible();
}
