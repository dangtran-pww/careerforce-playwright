import { expect, type Locator, type Page } from '@playwright/test';

// The admin side of events: the catalog item form and list, the session
// ("Schedule <item> session") form with its recurrence widget, and the
// Event Sessions list. Field names are from the happenings and rrule
// modules (see test-suites/smoke/smoke-events.md → What the site has).

export const CATALOG_LIST = '/admin/content/events/event-catalog-item';
export const CATALOG_ADD = '/admin/content/add/event-catalog-item';
export const SESSION_LIST = '/admin/content/events/event-session';

export type CatalogItem = {
  name: string;
  description: string;
  service: string;
  sponsor: string;
  topic: string;
  eventType: string;
};

export type Session = {
  /** YYYY-MM-DD, a weekday. */
  date: string;
  /** "10:00 AM", as the Start Time and End Time options read. */
  startTime: string;
  endTime: string;
  /** YYYY-MM-DD. */
  until: string;
  serviceLocation: string;
  phone: string;
  seats: string;
};

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export function saveButton(page: Page): Locator {
  return page
    .locator('#edit-actions, .form-actions')
    .getByRole('button', { name: 'Save', exact: true })
    .first();
}

export class CatalogItemForm {
  constructor(readonly page: Page) {}

  async create(item: CatalogItem) {
    const page = this.page;
    await page.goto(CATALOG_ADD);
    await page.locator('input[name="label[0][value]"]').fill(item.name);
    await page.getByRole('checkbox', { name: item.service, exact: true }).check();
    await page.locator('select[name="field_event_sponsors"]').selectOption({ label: item.sponsor });
    await page.getByRole('checkbox', { name: item.topic, exact: true }).check();
    await page.locator('select[name="field_event_types"]').selectOption({ label: item.eventType });
    await fillFormatted(page, 'description[0][value]', item.description);
    await page.locator('select[name="status[0][value]"]').selectOption({ label: 'Active' });
    await saveButton(page).click();
  }

  async setStatus(id: string, status: 'Active' | 'Inactive') {
    await this.page.goto(`/events/event-catalog-item/${id}/edit`);
    await this.page.locator('select[name="status[0][value]"]').selectOption({ label: status });
    await saveButton(this.page).click();
  }
}

// A formatted text field: CKEditor 5 when the text format has an editor,
// else the plain textarea.
async function fillFormatted(page: Page, name: string, text: string) {
  const textarea = page.locator(`textarea[name="${name}"]`);
  const editor = page
    .locator(`.js-form-item:has(textarea[name="${name}"]) .ck-editor__editable`)
    .first();
  if (await editor.isVisible().catch(() => false)) {
    await editor.click();
    await page.keyboard.type(text);
  } else {
    await textarea.fill(text);
  }
}

export class CatalogList {
  constructor(readonly page: Page) {}

  async open(name: string) {
    await this.page.goto(`${CATALOG_LIST}?n=${encodeURIComponent(name)}`);
  }

  rows(name: string): Locator {
    return this.page.locator('main table tbody tr').filter({ hasText: name });
  }

  scheduleLink(row: Locator): Locator {
    return row.locator('a[href*="/schedule"]').filter({ hasText: 'Schedule' });
  }
}

export class SessionForm {
  readonly page: Page;
  readonly preview: Locator;
  readonly previewDialog: Locator;

  constructor(page: Page) {
    this.page = page;
    this.preview = page.getByRole('button', { name: 'Preview Occurrence Dates' });
    this.previewDialog = page.locator('.ui-dialog:has(.rrule-preview-dates-modal), .rrule-preview-dates-modal').first();
  }

  async open(catalogId: string) {
    await this.page.goto(`/happenings/catalog-item/${catalogId}/schedule`);
  }

  /** Fills the date, times and the weekly recurrence (Monday to Friday). */
  async fillWhen(s: Session) {
    const page = this.page;
    await page.locator('input[name="field_rrule[0][date]"]').fill(s.date);
    await page.locator('select[name="field_rrule[0][start_time]"]').selectOption({ label: s.startTime });
    await page.locator('select[name="field_rrule[0][end_time]"]').selectOption({ label: s.endTime });
    await page.locator('input[name="field_rrule[0][recur_toggle]"]').check();
    await page.locator('input[name="field_rrule[0][rule_recurring][frequency_length]"]').fill('1');
    await page
      .locator('select[name="field_rrule[0][rule_recurring][frequency_type]"]')
      .selectOption('WEEKLY');
    await page.locator('input[name="field_rrule[0][rule_recurring][limit_until]"]').fill(s.until);
    for (const day of ['MO', 'TU', 'WE', 'TH', 'FR']) {
      await page
        .locator(`input[name="field_rrule[0][rule_recurring][rule_frequency_advanced][by_day][${day}]"]`)
        .check();
    }
  }

  /** Opens "Preview Occurrence Dates" and returns its lines. */
  async previewDates(): Promise<string[]> {
    await this.preview.click();
    const items = this.previewDialog.locator('li');
    await expect(items.first()).toBeVisible();
    const lines = (await items.allTextContents()).map((t) => t.replace(/\s+/g, ' ').trim());
    await this.page.locator('.ui-dialog-titlebar-close').first().click();
    await expect(this.previewDialog).toBeHidden();
    return lines;
  }

  /** Fills the rest of the session: location, format, people, seats, Active. */
  async fillDetails(s: Session) {
    const page = this.page;
    const location = page.locator('input[name="field_locations_primary[target_id]"]');
    await location.fill(s.serviceLocation);
    await page
      .locator('ul.ui-autocomplete:visible li')
      .filter({ hasText: s.serviceLocation })
      .first()
      .click();
    await expect(location).toHaveValue(new RegExp(`^${s.serviceLocation} \\(\\d+\\)$`));
    // Facilitator, Moderator and Meeting Location reload for the location.
    const facilitator = page.locator('select[name="field_facilitators"]');
    await expect(facilitator.locator('option:not([value=""]):not([value="_none"])').first()).toBeAttached();

    await page.locator('input[name="field_event_format[in_person]"]').check();
    const meeting = page.locator('select[name="field_locations_alternate[selection]"]');
    await expect(meeting.locator('option:checked')).toHaveText('Same as Service Location');
    await page.locator('input[name="field_phones[0][value]"]').fill(s.phone);

    if (!(await selectedValue(facilitator))) {
      const first = await facilitator
        .locator('option:not([value=""]):not([value="_none"])')
        .first()
        .getAttribute('value');
      await facilitator.selectOption(first!);
    }
    await page.locator('input[name="field_seats_available[0][value]"]').fill(s.seats);
    await page.locator('select[name="moderation_state[0][state]"]').selectOption('published'); // "Active"
  }
}

async function selectedValue(select: Locator): Promise<string> {
  const value = await select.inputValue();
  return value === '_none' ? '' : value;
}

export class SessionList {
  constructor(readonly page: Page) {}

  async open(name: string) {
    await this.page.goto(`${SESSION_LIST}?label=${encodeURIComponent(name)}`);
  }

  rows(name: string): Locator {
    return this.page.locator('main table tbody tr').filter({ hasText: name });
  }

  /** The text of a column of a row, by its header. */
  async cell(row: Locator, header: string): Promise<string> {
    const table = this.page.locator('main table').first();
    const headers = (await table.locator('thead th').allTextContents()).map((t) => t.replace(/\s+/g, ' ').trim());
    const index = headers.findIndex((h) => h === header);
    expect(index, `Column "${header}" in ${headers.join(' | ')}`).toBeGreaterThanOrEqual(0);
    return ((await row.locator('td').nth(index).textContent()) ?? '').replace(/\s+/g, ' ').trim();
  }

  /** Ticks the row and runs a bulk action ("Cancel Session"). */
  async bulk(row: Locator, action: string) {
    await row.locator('input.js-vbo-checkbox, input[type="checkbox"]').first().check();
    await this.page.locator('select[name="action"]').selectOption({ label: action });
    await this.page.getByRole('button', { name: 'Apply to selected items' }).first().click();
  }
}

/** The occurrence table on a session's page. */
export function sessionOccurrenceRows(page: Page): Locator {
  return page.locator('.view-display-id-block_occurrences_for_one_session tbody tr');
}
