import { expect, type Locator, type Page } from '@playwright/test';

import { expectNoErrors } from './node-form.page';

// One appointment slot (an appointments_occurrence): the job seeker's
// booking form (/appointments/<id>/booking) and success page, and the slot
// page with its actions for staff and the registrant: Add attendee, Cancel
// registration, Resend Confirmation, Mark Attended (the Add Service Record
// form) and Undo Attendance. See test-suites/smoke/smoke-appointments.md →
// "What the site has".

export type BookingFormat = 'Online' | 'Phone' | 'In Person';

/** The status message after an action. */
export function statusMessage(page: Page): Locator {
  return page.locator('.messages--status, [data-drupal-messages] [role="status"]').first();
}

export class BookingPage {
  readonly page: Page;
  readonly main: Locator;
  readonly phone: Locator;
  readonly completeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.main = page.getByRole('main');
    this.phone = this.main.locator('input[name="phone"]');
    this.completeButton = this.main.getByRole('button', { name: 'Complete Booking' });
  }

  format(name: BookingFormat): Locator {
    return this.main.getByRole('radio', { name, exact: true });
  }

  topic(name: string): Locator {
    return this.main.getByRole('checkbox', { name, exact: true });
  }

  async book(options: { format: BookingFormat; phone?: string; topics?: string[] }) {
    await this.format(options.format).check();
    if (options.phone) await this.phone.fill(options.phone);
    for (const t of options.topics ?? []) await this.topic(t).check();
    await this.completeButton.click();
    await this.page.waitForURL(/\/appointments\/\d+\/booking-success$/);
    await expectNoErrors(this.page);
  }
}

export class SlotPage {
  readonly page: Page;
  readonly main: Locator;
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.main = page.getByRole('main');
    this.heading = this.main.getByRole('heading', { level: 1 });
  }

  async goto(path: string) {
    await this.page.goto(path);
    await expectNoErrors(this.page);
  }

  action(name: string): Locator {
    return this.main.getByRole('link', { name, exact: true });
  }

  // Add attendee ------------------------------------------------------------

  /**
   * On the Add Attendee form: picks the user from the suggestions for
   * `search`, chooses the format and clicks Register.
   */
  async addAttendee(search: string, format: BookingFormat, phone?: string) {
    const user = this.main.getByLabel('First name, last name or email');
    await user.pressSequentially(search, { delay: 30 });
    const suggestion = this.page.locator('ul.ui-autocomplete li').filter({ visible: true }).first();
    await expect(suggestion).toBeVisible({ timeout: 15_000 });
    await suggestion.click();
    await expect(user).toHaveValue(/\(\d+\)$/);
    await this.main.getByRole('radio', { name: format, exact: true }).check();
    if (phone) await this.main.getByLabel('What phone number can we reach you at?').fill(phone);
    await this.main.getByRole('button', { name: 'Register' }).click();
    await this.page.waitForURL((url) => !url.pathname.endsWith('/add-attendee'));
    await expectNoErrors(this.page);
  }

  // Cancel registration ---------------------------------------------------

  // "Cancel registration" opens the confirmation in a modal dialog (outside
  // <main>); opened at its own address it is a page.
  cancelDialog(): Locator {
    return this.page
      .getByRole('dialog')
      .filter({ hasText: 'Cancel Appointment' })
      .or(this.main.filter({ hasText: 'Are you sure you would like to cancel your appointment?' }))
      .first();
  }

  confirmCancelButton(): Locator {
    return this.cancelDialog().getByRole('button', { name: 'Yes, cancel my registration' });
  }

  keepButton(): Locator {
    return this.cancelDialog()
      .getByRole('button', { name: 'No, keep my registration' })
      .or(this.cancelDialog().getByRole('link', { name: 'No, keep my registration' }));
  }

  /** From the slot page: Cancel registration, then "Yes, cancel my registration". */
  async cancelRegistration() {
    await this.action('Cancel registration').click();
    await expect(this.confirmCancelButton()).toBeVisible();
    await this.confirmCancelButton().click();
    await expect(statusMessage(this.page)).toContainText(
      'Your appointment registration has been cancelled.',
    );
    await expectNoErrors(this.page);
  }

  // Mark Attended ------------------------------------------------------------

  async undoAttendance() {
    // The link asks "Are you sure you want to undo attendance for this
    // appointment?" in a browser confirm, which Playwright would dismiss.
    this.page.once('dialog', (dialog) => void dialog.accept());
    await this.action('Undo Attendance').click();
    await expect(statusMessage(this.page)).toContainText(
      'Attendance has been undone and the registrant is now Registered. Service record deleted.',
    );
    await expectNoErrors(this.page);
  }
}

/** The Add Service Record form that "Mark Attended" opens. */
export class ServiceRecordForm {
  readonly page: Page;
  readonly main: Locator;
  readonly dateOfService: Locator;
  readonly serviceLocation: Locator;
  readonly format: Locator;
  readonly staffMember: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.main = page.getByRole('main');
    this.dateOfService = this.main.locator('input[name^="field_date_of_service[0][value]"]').first();
    this.serviceLocation = this.main.locator('input[name^="field_service_location"]').first();
    this.format = this.main.locator('select[name^="field_format"]').first();
    this.staffMember = this.main.locator('select[name^="field_staff_member"]').first();
    this.saveButton = this.main.getByRole('button', { name: 'Save', exact: true });
  }

  service(name: string): Locator {
    return this.main.getByRole('checkbox', { name, exact: true });
  }
}
