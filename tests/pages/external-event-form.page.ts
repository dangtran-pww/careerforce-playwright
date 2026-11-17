import { expect, type Locator, type Page } from '@playwright/test';

// "Submit an Event" (/form/external-event): the public webform employers
// use to send an external event for staff review. See
// test-suites/smoke/smoke-external-events.md.

export const EXTERNAL_EVENT_FORM_PATH = '/form/external-event';

export type ExternalEventSubmission = {
  eventName: string;
  hostedBy: string;
  /** YYYY-MM-DD */
  date: string;
  /** e.g. "10:00 AM" */
  startTime: string;
  endTime: string;
  /** Option label, e.g. "Job Fair or Networking Event". */
  eventType: string;
  description: string;
  link: string;
  phone: string;
  street: string;
  city: string;
  zip: string;
  submitterName: string;
  submitterEmail: string;
};

export class ExternalEventForm {
  readonly page: Page;
  readonly heading: Locator;
  readonly eventName: Locator;
  readonly hostedBy: Locator;
  readonly date: Locator;
  readonly startTime: Locator;
  readonly endTime: Locator;
  readonly eventType: Locator;
  readonly descriptionEditor: Locator;
  readonly link: Locator;
  readonly phone: Locator;
  readonly inPerson: Locator;
  readonly online: Locator;
  readonly street: Locator;
  readonly city: Locator;
  readonly state: Locator;
  readonly zip: Locator;
  readonly submitterName: Locator;
  readonly submitterEmail: Locator;
  readonly captcha: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { level: 1 });
    this.eventName = page.locator('input[name="event_name"]');
    this.hostedBy = page.locator('input[name="hosted_by"]');
    this.date = page.locator('input[name="event_date"]');
    this.startTime = page.locator('input[name="start_time"]');
    this.endTime = page.locator('input[name="end_time"]');
    this.eventType = page.locator('select[name="event_type"]');
    // The form's only CKEditor.
    this.descriptionEditor = page.locator('main .ck-editor__editable').first();
    this.link = page.locator('input[name="link_to_event[url]"]');
    this.phone = page.locator('input[name="accommodation_phone_number"]');
    this.inPerson = page.locator('input[name="event_format[in_person]"]');
    this.online = page.locator('input[name="event_format[virtual]"]');
    this.street = page.locator('input[name="address[address]"]');
    this.city = page.locator('input[name="address[city]"]');
    this.state = page.locator('select[name="address[state_province]"]');
    this.zip = page.locator('input[name="address[postal_code]"]');
    this.submitterName = page.locator('input[name="submitter_name"]');
    this.submitterEmail = page.locator('input[name="submitter_email"]');
    this.captcha = page.locator('[data-drupal-selector="edit-captcha"]');
    this.submitButton = page.locator('main button[name="op"][value="Submit"]');
  }

  async goto() {
    await this.page.goto(EXTERNAL_EVENT_FORM_PATH);
    await expect(this.heading).toHaveText('Submit an Event');
  }

  /** Fills "Event Information" and ticks In Person (step 1 of XS-1). */
  async fillEventInformation(data: ExternalEventSubmission) {
    await this.eventName.fill(data.eventName);
    await this.hostedBy.fill(data.hostedBy);
    await this.date.fill(data.date);
    await this.startTime.fill(data.startTime);
    await this.startTime.press('Tab');
    await this.endTime.fill(data.endTime);
    await this.endTime.press('Tab');
    await this.eventType.selectOption({ label: data.eventType });
    await this.descriptionEditor.click();
    await this.page.keyboard.type(data.description);
    await this.link.fill(data.link);
    await this.phone.fill(data.phone);
    await this.inPerson.check();
  }

  /** Fills the address and "Submitter Details" (step 2 of XS-1). */
  async fillAddressAndSubmitter(data: ExternalEventSubmission) {
    await this.street.fill(data.street);
    await this.city.fill(data.city);
    await this.zip.fill(data.zip);
    await this.submitterName.fill(data.submitterName);
    await this.submitterEmail.fill(data.submitterEmail);
  }

  /**
   * Ticks "I'm not a robot". QA and Stage use Google's reCAPTCHA test keys,
   * so it passes straight away; a real key may answer with an image
   * challenge instead, and then this fails.
   */
  async tickCaptcha() {
    const anchor = this.page
      .frameLocator('iframe[title="reCAPTCHA"]')
      .locator('#recaptcha-anchor');
    await anchor.click();
    await expect(
      anchor,
      'reCAPTCHA was not passed. If an image challenge showed, the environment is not using Google\'s reCAPTCHA test keys.',
    ).toHaveAttribute('aria-checked', 'true', { timeout: 15_000 });
  }
}
