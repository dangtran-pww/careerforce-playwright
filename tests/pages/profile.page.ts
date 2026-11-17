import { expect, type Locator, type Page } from '@playwright/test';

import { statusMessages } from './node-form.page';

// A job seeker's profile (the career_seeker profile). Each section is its own
// form with its own Save, at /user/<uid>/profile/<section>; Account
// Information is /user/<uid>/edit. The same forms serve the job seeker ("My
// Profile") and an admin ("Edit Profile"). Saving goes to /user/<uid>: the
// job seeker's Dashboard, or the admin's "View Profile" page, which shows
// every section's values.

export const PROFILE_SAVED = 'The profile has been saved.';

export const SECTIONS = {
  demographic: 'Demographic Information',
  education_and_employment: 'Education and Employment',
  equal_opportunity: 'Equal Opportunity',
  military: 'Military and Veterans',
  income: 'Income and Public Assistance',
} as const;

export type Section = keyof typeof SECTIONS;

export const VETERAN_QUESTION =
  'Are you a veteran, current U.S. military service member, or eligible military spouse?';
export const CAREGIVER_QUESTION = 'Are you a caregiver for a U.S. Veteran?';

export class ProfilePage {
  readonly page: Page;
  readonly main: Locator;
  readonly saveButton: Locator;
  readonly alternatePhone: Locator;

  constructor(page: Page) {
    this.page = page;
    this.main = page.locator('main');
    // The header's site search is a form too; Save is the section's.
    this.saveButton = this.main.getByRole('button', { name: 'Save', exact: true });
    this.alternatePhone = this.main.getByLabel('Alternate Phone Number');
    // Leaving a form with unsaved changes asks "Leave site?"; a test that
    // stops mid-edit must still be able to go and restore the profile.
    page.on('dialog', (dialog) =>
      dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss(),
    );
  }

  async openSection(uid: string, section: Section) {
    await this.page.goto(`/user/${uid}/profile/${section}`);
    await expect(
      this.main.getByRole('heading', { level: 2, name: SECTIONS[section], exact: true }),
    ).toBeVisible();
  }

  /** The Yes/No radios of one question, found by the question's text. */
  question(text: string): Locator {
    // .last(): the innermost fieldset, if a field group wraps several questions.
    return this.main.locator('fieldset').filter({ hasText: text }).last();
  }

  /** The label of the checked radio of a question, or '' if none is. */
  async checkedAnswer(text: string): Promise<string> {
    const checked = this.question(text).locator('input[type="radio"]:checked');
    if ((await checked.count()) === 0) return '';
    const id = await checked.getAttribute('id');
    return (await this.main.locator(`label[for="${id}"]`).innerText()).trim();
  }

  async answer(text: string, label: string) {
    await this.question(text).getByRole('radio', { name: label, exact: true }).check();
  }

  /** Saves the section and checks it went back to /user/<uid> with the message. */
  async save(uid: string) {
    await this.saveButton.click();
    await expect(this.page).toHaveURL(new RegExp(`/user/${uid}$`));
    await expect(statusMessages(this.page)).toContainText(PROFILE_SAVED);
  }

  /** Opens a section, sets the alternate phone and saves it. */
  async setAlternatePhone(uid: string, value: string) {
    await this.openSection(uid, 'demographic');
    await this.alternatePhone.fill(value);
    await this.save(uid);
  }

  /** Opens a section, answers a question and saves it. */
  async setAnswer(uid: string, section: Section, text: string, label: string) {
    await this.openSection(uid, section);
    await this.answer(text, label);
    await this.save(uid);
  }

  // Admin's View Profile (/user/<uid>).

  /** A section of View Profile, by its heading. */
  viewSection(name: string): Locator {
    return this.main
      .locator('div')
      .filter({ has: this.page.getByRole('heading', { level: 2, name, exact: true }) })
      .last();
  }
}

/** "651-555-0101" as View Profile shows it: "(651) 555-0101". */
export function displayedPhone(value: string): string {
  const [area, prefix, line] = value.split('-');
  return `(${area}) ${prefix}-${line}`;
}
