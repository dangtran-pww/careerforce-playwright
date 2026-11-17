import { expect, type Locator, type Page } from '@playwright/test';

// The "Create appointment" form (appointments_session add form), reached from
// a location's Appointments tab. There is no title or end time: each slot is
// 30 minutes. The recurrence widget (field_rrule) shows Repeats every, Until
// and the Advanced days of the week only once "This is a recurring
// appointment" is ticked. See test-suites/smoke/smoke-appointments.md →
// "What the site has".

export type SessionData = {
  /** First day, YYYY-MM-DD. */
  date: string;
  /** Start Time option value, 24-hour, e.g. `15:00` for "3:00 PM". */
  startTime: string;
  /** Last day of the recurrence, YYYY-MM-DD. */
  until: string;
  /** Online: Video Link (required when Online is offered). */
  videoLink: string;
  additionalInformation: string;
  accommodationPhone: string;
};

export class AppointmentSessionForm {
  readonly page: Page;
  readonly date: Locator;
  readonly startTime: Locator;
  readonly recurring: Locator;
  readonly repeatsEvery: Locator;
  readonly repeatsUnit: Locator;
  readonly until: Locator;
  readonly serviceLocation: Locator;
  readonly meetingLocation: Locator;
  readonly videoLink: Locator;
  readonly additionalInformation: Locator;
  readonly accommodationPhone: Locator;
  readonly staffMember: Locator;
  readonly status: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    const rrule = 'field_rrule[0]';
    this.date = page.locator(`input[name="${rrule}[date]"]`);
    this.startTime = page.locator(`select[name="${rrule}[start_time]"]`);
    this.recurring = page.locator(`input[name="${rrule}[recur_toggle]"]`);
    this.repeatsEvery = page.locator(`input[name="${rrule}[rule_recurring][frequency_length]"]`);
    this.repeatsUnit = page.locator(`select[name="${rrule}[rule_recurring][frequency_type]"]`);
    this.until = page.locator(`input[name="${rrule}[rule_recurring][limit_until]"]`);
    this.serviceLocation = page.locator('input[name="location[0][target_id]"]');
    this.meetingLocation = page.locator('select[name="field_meeting_location[selection]"]');
    this.videoLink = page.locator('input[name="field_urls_video[0][uri]"]');
    this.additionalInformation = page.locator(
      'input[name="field_additional_information[0][value]"]',
    );
    this.accommodationPhone = page.locator('input[name="field_phones[0][value]"]');
    this.staffMember = page.locator('select[name="field_staff_member"]');
    this.status = page.locator('select[name="moderation_state[0][state]"]');
    this.saveButton = page.locator('main form').getByRole('button', { name: 'Save', exact: true });
  }

  format(value: 'online' | 'phone' | 'in_person'): Locator {
    return this.page.locator(`input[name="format[${value}]"]`);
  }

  weekday(code: 'MO' | 'TU' | 'WE' | 'TH' | 'FR'): Locator {
    return this.page.locator(
      `input[name="field_rrule[0][rule_recurring][rule_frequency_advanced][by_day][${code}]"]`,
    );
  }

  /**
   * Fills in a weekly Monday-to-Friday session with every format, the
   * service location as meeting place, the first staff member offered and
   * status Active. Returns the staff member's name.
   */
  async fill(data: SessionData): Promise<string> {
    await this.date.fill(data.date);
    await this.startTime.selectOption(data.startTime);

    await this.recurring.check();
    await expect(this.repeatsEvery).toBeVisible();
    await this.repeatsEvery.fill('1');
    await this.repeatsUnit.selectOption('WEEKLY');
    await this.until.fill(data.until);
    // The days of the week sit in a collapsed "Advanced" section.
    if (!(await this.weekday('MO').isVisible())) {
      await this.page.locator('main form').getByText('Advanced', { exact: true }).first().click();
    }
    for (const day of ['MO', 'TU', 'WE', 'TH', 'FR'] as const) {
      await this.weekday(day).check();
    }

    for (const f of ['online', 'phone', 'in_person'] as const) {
      await this.format(f).check();
    }
    await expect(this.meetingLocation).toBeVisible();
    await this.meetingLocation.selectOption('_none'); // "Same as Service Location"
    await expect(this.videoLink).toBeVisible();
    await this.videoLink.fill(data.videoLink);
    await expect(this.additionalInformation).toBeVisible();
    await this.additionalInformation.fill(data.additionalInformation);
    await this.accommodationPhone.fill(data.accommodationPhone);

    const staff = this.staffMember.locator('option:not([value="_none"]):not([value=""])').first();
    const staffId = await staff.getAttribute('value');
    const staffName = ((await staff.textContent()) ?? '').trim();
    await this.staffMember.selectOption(staffId!);

    await this.status.selectOption('published'); // "Active"
    return staffName;
  }

  /** Saves and returns the new session's ID, from the address it lands on. */
  async save(): Promise<string> {
    await this.saveButton.click();
    // Saving runs a batch job (/batch) that creates the slots, then lands on
    // the session page.
    await this.page.waitForURL(/\/location-appointments\/\d+\/?$/, { timeout: 120_000 });
    const match = /\/location-appointments\/(\d+)\/?$/.exec(new URL(this.page.url()).pathname);
    expect(match, `session page address after Save (${this.page.url()})`).toBeTruthy();
    return match![1];
  }
}
