import { expect, type Locator, type Page } from '@playwright/test';

// The Attendees tab of an event occurrence (staff),
// /events/event-occurrence/<id>/attendees. Row operations are a dropbutton
// of links; "Mark Canceled" and "Undo Attendance" ask with a JS confirm().
export class EventAttendeesPage {
  readonly page: Page;
  readonly table: Locator;

  constructor(page: Page) {
    this.page = page;
    this.table = page.locator('main table').first();
  }

  async open(occurrenceId: string) {
    await this.page.goto(`/events/event-occurrence/${occurrenceId}/attendees`);
  }

  /** "+ Add Attendee": picks the user by email and a format, then submits. */
  async addAttendee(email: string, format: 'In Person' | 'Online') {
    const page = this.page;
    await page.getByRole('link', { name: /Add Attendee/ }).first().click();
    await expect(page).toHaveURL(/\/attendees\/add-attendee/);
    const user = page.locator('input[name="user"]');
    await user.pressSequentially(email, { delay: 20 });
    await page.locator('ul.ui-autocomplete:visible li').filter({ hasText: email }).first().click();
    await expect(user).toHaveValue(new RegExp(`\\(${escape(email)}\\)`));
    await page.getByRole('radio', { name: format, exact: true }).check();
    await page.getByRole('button', { name: 'Add Attendee', exact: true }).click();
    await expect(page).toHaveURL(/\/attendees(\?|$)/);
  }

  row(email: string): Locator {
    return this.table.locator('tbody tr').filter({ hasText: email });
  }

  async cell(row: Locator, header: string): Promise<string> {
    const headers = (await this.table.locator('thead th').allTextContents()).map((t) =>
      t.replace(/\s+/g, ' ').trim(),
    );
    const index = headers.findIndex((h) => h.startsWith(header));
    expect(index, `Column "${header}" in ${headers.join(' | ')}`).toBeGreaterThanOrEqual(0);
    return ((await row.locator('td').nth(index).textContent()) ?? '').replace(/\s+/g, ' ').trim();
  }

  /** Runs a row operation; accepts its confirm() if it asks. */
  async operation(row: Locator, name: string) {
    const link = row.getByRole('link', { name, exact: true });
    if (!(await link.isVisible())) {
      await row.locator('.dropbutton-toggle button, .dropbutton__toggle').first().click();
    }
    this.page.once('dialog', (dialog) => dialog.accept());
    await link.click();
    await this.page.waitForLoadState();
  }
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
