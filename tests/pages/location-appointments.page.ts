import { expect, type Locator, type Page } from '@playwright/test';

import { expectNoErrors } from './node-form.page';

// Staff pages for a location's appointments: the location's Appointments
// tab, a session page (its slot table and "Cancel occurrences"), and the
// site-wide Appointment Sessions list ("Cancel Session"). Bulk actions are
// Views Bulk Operations forms: tick rows, pick an Action, "Apply to selected
// items". See test-suites/smoke/smoke-appointments.md → "What the site has".

export const AITKIN = {
  name: 'CareerForce in Aitkin',
  path: '/careerforce-location/careerforce-aitkin',
};

export const SESSIONS_PATH = '/admin/content/appointments/appointment-session';

/** One row of a session page's slot table. */
export type SessionSlot = {
  id: string;
  /** YYYY-MM-DD of the slot's start, in the site's timezone. */
  date: string;
  /** e.g. "15:00", from the start's datetime. */
  time: string;
  text: string;
  staffMember: string;
  status: string;
  registrant: string;
  registrationStatus: string;
  viewHref: string;
};

/** The text of `row`'s cell under the column headed `header`. */
async function cell(table: Locator, row: Locator, header: string): Promise<string> {
  const headers = (await table.locator('thead th').allTextContents()).map((h) => h.trim());
  const index = headers.indexOf(header);
  expect(index, `column "${header}" in ${headers.join(' | ')}`).toBeGreaterThanOrEqual(0);
  return ((await row.locator('td').nth(index).innerText()) ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Picks `action` in a bulk form, clicks "Apply to selected items", and
 * confirms when Views Bulk Operations asks first.
 */
async function applyBulk(page: Page, action: string) {
  const form = page.locator('main form').filter({ has: page.locator('select[name="action"]') }).first();
  await form.locator('select[name="action"]').selectOption({ label: action });
  await form.getByRole('button', { name: 'Apply to selected items' }).first().click();
  const status = page.locator('.messages--status, [data-drupal-messages] [role="status"]').first();
  const confirm = page
    .locator('main form')
    .getByRole('button', { name: /^(Execute action|Confirm)$/ })
    .first();
  await expect(status.or(confirm).first()).toBeVisible({ timeout: 30_000 });
  if (await confirm.isVisible()) {
    await confirm.click();
    await expect(status).toBeVisible({ timeout: 30_000 });
  }
  await expectNoErrors(page);
}

export class LocationAppointments {
  readonly page: Page;
  readonly location: typeof AITKIN;

  constructor(page: Page, location = AITKIN) {
    this.page = page;
    this.location = location;
  }

  get tabPath() {
    return `${this.location.path}/location-appointments`;
  }

  sessionPath(sessionId: string) {
    return `${this.tabPath}/${sessionId}`;
  }

  slotPath(sessionId: string, slotId: string) {
    return `${this.sessionPath(sessionId)}/${slotId}`;
  }

  // Appointments tab -------------------------------------------------------

  async openTab(range?: { from: string; to: string }) {
    const qs = range
      ? `?timestamp_start_granularity=${range.from}&timestamp_end_granularity=${range.to}`
      : '';
    await this.page.goto(`${this.tabPath}${qs}`);
    await expect(this.page.getByRole('heading', { level: 1 })).toHaveText(
      `Appointments for ${this.location.name}`,
    );
  }

  createLink(): Locator {
    return this.page.getByRole('link', { name: 'Create appointment' });
  }

  /** Rows of the Appointments tab that belong to session `sessionId`. */
  tabRows(sessionId: string): Locator {
    return this.page
      .locator('main table tbody tr')
      .filter({ has: this.page.locator(`a[href*="/location-appointments/${sessionId}/"]`) });
  }

  /**
   * Session `sessionId`'s rows on the open Appointments tab, from every page
   * of it (other sessions' slots on the same days can fill a page), as
   * header → cell text maps. Leaves the tab on its last page.
   */
  async allTabRows(sessionId: string): Promise<Record<string, string>[]> {
    const rows: Record<string, string>[] = [];
    for (;;) {
      const headers = (await this.page.locator('main table').first().locator('thead th').allInnerTexts()).map((h) =>
        h.trim(),
      );
      for (const row of await this.tabRows(sessionId).all()) {
        const cells = (await row.locator('td').allInnerTexts()).map((c) => c.replace(/\s+/g, ' ').trim());
        rows.push(Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ''])));
      }
      const next = this.page.getByRole('link', { name: /Next page/ }).first();
      if ((await next.count()) === 0) break;
      const href = await next.getAttribute('href');
      await this.page.goto(new URL(href!, this.page.url()).href);
    }
    return rows;
  }

  // Session page ----------------------------------------------------------

  async openSession(sessionId: string) {
    await this.page.goto(this.sessionPath(sessionId));
    await expectNoErrors(this.page);
  }

  sessionTable(): Locator {
    return this.page.locator('main table').first();
  }

  /** The session page's slot rows, in page order (the page must be open). */
  async sessionSlots(): Promise<SessionSlot[]> {
    const table = this.sessionTable();
    const rows = table.locator('tbody tr');
    const slots: SessionSlot[] = [];
    for (const row of await rows.all()) {
      const viewHref = (await row.locator('a').filter({ hasText: /^\s*View\s*$/ }).first().getAttribute('href')) ?? '';
      const datetime = (await row.locator('time').first().getAttribute('datetime')) ?? '';
      slots.push({
        id: /\/(\d+)$/.exec(viewHref)?.[1] ?? '',
        date: datetime.slice(0, 10),
        time: datetime.slice(11, 16),
        text: (await row.innerText()).replace(/\s+/g, ' ').trim(),
        staffMember: await cell(table, row, 'Staff Member'),
        status: await cell(table, row, 'Status'),
        registrant: await cell(table, row, 'Registrant'),
        registrationStatus: await cell(table, row, 'Registration Status'),
        viewHref,
      });
    }
    return slots;
  }

  /** On the open session page, ticks the given slots and cancels them. */
  async cancelOccurrences(slotIds: string[]) {
    const table = this.sessionTable();
    for (const id of slotIds) {
      const row = table
        .locator('tbody tr')
        .filter({ has: this.page.locator(`a[href$="/${id}"]`) });
      await row.locator('input[type="checkbox"]').check();
    }
    await applyBulk(this.page, 'Cancel occurrences');
  }

  // Appointment Sessions list -------------------------------------------

  /** The Appointment Sessions list, newest first. */
  async openSessionList() {
    await this.page.goto(`${SESSIONS_PATH}?order=id&sort=desc`);
    await expectNoErrors(this.page);
  }

  sessionListRow(sessionId: string): Locator {
    return this.page
      .locator('main table tbody tr')
      .filter({ hasText: new RegExp(`Appointment session #${sessionId}\\b`) });
  }

  async sessionListStatus(sessionId: string): Promise<string> {
    return cell(this.page.locator('main table').first(), this.sessionListRow(sessionId), 'Status');
  }

  /**
   * The ID of this location's newest session whose Additional Information is
   * `marker`, among the 10 newest sessions; undefined when there is none.
   */
  async findSessionByMarker(marker: string): Promise<string | undefined> {
    await this.openSessionList();
    const ids = await this.page
      .locator('main table tbody tr')
      .filter({ has: this.page.locator(`a[href="${this.location.path}"]`) })
      .evaluateAll((rows) =>
        rows.slice(0, 10).map((r) => /#(\d+)/.exec(r.textContent ?? '')?.[1] ?? ''),
      );
    for (const id of ids.filter(Boolean)) {
      await this.page.goto(`${this.sessionPath(id)}/edit`);
      const info = this.page.locator('input[name="field_additional_information[0][value]"]');
      if ((await info.count()) && (await info.inputValue()) === marker) return id;
    }
    return undefined;
  }

  /** On the Appointment Sessions list, cancels session `sessionId`. */
  async cancelSession(sessionId: string) {
    await this.openSessionList();
    await this.sessionListRow(sessionId).locator('input[type="checkbox"]').check();
    await applyBulk(this.page, 'Cancel Session');
  }
}
