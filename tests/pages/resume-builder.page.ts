import { expect, type FrameLocator, type Locator, type Page } from '@playwright/test';

// The job seeker's Resume Builder (cf_resume module):
//
// - My Resume Center, /user/<uid>/my-resumes (/user/my-resumes redirects
//   there): the master resume (one per account), targeted resumes (up to
//   five) and uploaded files (up to five), each with a "Manage <name>" menu.
// - A resume's review page, /resume/<id>, with the preview in an iframe
//   (/resume/<id>/preview), and its steps /resume/<id>/<step>
//   (contact_information, summary, skills, experience, education), each
//   saved with "Save and continue".
// - Delete pages: /resume/<id>/delete and /media/<mid>/delete-uploaded-resume.
//   From My Resume Center they open in a dialog; opened directly they're a
//   page with the same confirm button.

export type ResumeSection = 'Master Resume' | 'Targeted Resumes' | 'Uploaded Resumes';

/** The id in a /resume/<id>... or /media/<id>/... path or URL. */
export function idFrom(url: string, kind: 'resume' | 'media' = 'resume'): string | undefined {
  return url.match(new RegExp(`/${kind}/(\\d+)`))?.[1];
}

export class ResumeCenter {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** Opens My Resume Center and returns the job seeker's uid. */
  async open(): Promise<string> {
    await this.page.goto('/user/my-resumes');
    await expect(this.page.getByRole('heading', { name: 'My Resume Center', level: 1 })).toBeVisible();
    const uid = new URL(this.page.url()).pathname.match(/^\/user\/(\d+)\/my-resumes/)?.[1];
    if (!uid) throw new Error(`/user/my-resumes went to ${this.page.url()}`);
    return uid;
  }

  /** One of the page's three sections, from its h3 to the next one. */
  section(name: ResumeSection): Locator {
    return this.page
      .locator('main')
      .locator('xpath=.//*[h3]')
      .filter({ has: this.page.getByRole('heading', { name, level: 3, exact: true }) })
      .last();
  }

  /** A resume's or file's link in a section. */
  item(section: ResumeSection, name: string): Locator {
    return this.section(section).getByRole('link', { name, exact: true });
  }

  /** Links of every item listed in a section. */
  items(section: ResumeSection): Locator {
    return this.section(section).locator('a[href^="/resume/"], a[href^="/media/"]');
  }

  /** The master resume's id, if the account has one. */
  async masterId(): Promise<string | undefined> {
    const link = this.items('Master Resume').first();
    if (!(await link.count())) return undefined;
    return idFrom((await link.getAttribute('href')) ?? '');
  }

  /** "+ Build your master resume", then "Build a resume". Returns the new id. */
  async buildMasterResume(): Promise<string> {
    await this.page.getByRole('button', { name: 'Build your master resume' }).click();
    await this.page.getByRole('button', { name: 'Build a resume', exact: true }).click();
    await this.page.waitForURL(/\/resume\/\d+\/contact_information/);
    return idFrom(this.page.url())!;
  }

  /** Uploads a file through the "Upload a resume" dialog. */
  async upload(file: { name: string; mimeType: string; buffer: Buffer }) {
    await this.page.getByRole('button', { name: 'Upload a resume' }).click();
    const dialog = this.page.getByRole('dialog', { name: 'Add Resume: Uploaded' });
    await expect(dialog).toBeVisible();
    await dialog.locator('input[type="file"]').setInputFiles(file);
    // The file uploads by AJAX as soon as it's chosen; its name then shows
    // in the dialog.
    await expect(dialog.getByRole('link', { name: file.name })).toBeVisible();
    await dialog.locator('.ui-dialog-buttonpane').getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden();
  }
}

/** Confirms a delete page opened directly. Does nothing if it's gone (404). */
export async function deleteByUrl(page: Page, path: string) {
  const response = await page.goto(path);
  if (response?.status() === 404 || response?.status() === 403) return;
  await page
    .locator('main form')
    .getByRole('button', { name: /^(Yes, delete|Delete)/ })
    .click();
  await page.waitForURL((url) => !url.pathname.startsWith(path));
}

/** A resume's step forms and its review page. */
export class ResumeEditor {
  readonly page: Page;
  readonly id: string;

  constructor(page: Page, id: string) {
    this.page = page;
    this.id = id;
  }

  /** The step's form (the one with "Save and continue"). */
  get form(): Locator {
    return this.page
      .locator('main form')
      .filter({ has: this.page.getByRole('button', { name: 'Save and continue' }) })
      .first();
  }

  async openStep(step: 'contact_information' | 'summary' | 'experience') {
    await this.page.goto(`/resume/${this.id}/${step}`);
    await expect(this.form).toBeVisible();
  }

  /** Saves the step and waits to leave it. */
  async saveAndContinue() {
    const from = this.page.url();
    await this.form.getByRole('button', { name: 'Save and continue' }).click();
    await this.page.waitForURL((url) => url.href !== from);
    await expect(this.page.locator('.messages--error, [data-drupal-messages] [role="alert"]')).toHaveCount(0);
  }

  async fillContact(contact: { first: string; last: string; city: string; state: string }) {
    await this.form.getByRole('textbox', { name: 'First name' }).fill(contact.first);
    await this.form.getByRole('textbox', { name: 'Last name' }).fill(contact.last);
    await this.form.getByRole('textbox', { name: 'City' }).fill(contact.city);
    await this.form.getByRole('combobox', { name: 'State' }).selectOption({ label: contact.state });
  }

  get summary(): Locator {
    return this.form.getByRole('textbox', { name: 'Summary statement' });
  }

  /** The experience form's fields; `n` is 0 for the first experience. */
  experience(n = 0) {
    const field = (name: string) => this.form.getByRole('textbox', { name, exact: true }).nth(n);
    return {
      company: field('Company'),
      location: field('Location'),
      title: field('Job title'),
      startMonth: this.form.getByRole('combobox', { name: 'Start month' }).nth(n),
      startYear: this.form.getByRole('combobox', { name: 'Start year' }).nth(n),
      current: this.form.getByRole('checkbox', { name: 'This is my current job' }).nth(n),
    };
  }

  /** The textbox of duty `n` (1-based, as in its label). */
  duty(n: number): Locator {
    return this.form.getByRole('textbox', { name: `Job duties / accomplishments (value ${n})` });
  }

  /** Every duty textbox of the form. */
  get duties(): Locator {
    return this.form.getByRole('textbox', { name: /^Job duties \/ accomplishments \(value \d+\)$/ });
  }

  async addDuty() {
    const count = await this.duties.count();
    await this.form.getByRole('button', { name: 'Add a job duty/accomplishment' }).click();
    await expect(this.duties).toHaveCount(count + 1);
  }

  /** Clicks the "Remove" button next to duty `n`. */
  async removeDuty(n: number) {
    const value = await this.duty(n).inputValue();
    // The innermost element holding both this duty and a Remove button (a
    // row of the multi-value table). `has` locators are relative, so this
    // one starts from the page, not the form.
    const wrapper = this.form
      .locator('tr, div')
      .filter({
        has: this.page.getByRole('textbox', { name: `Job duties / accomplishments (value ${n})` }),
      })
      .filter({ has: this.page.getByRole('button', { name: 'Remove', exact: true }) })
      .last();
    await wrapper.getByRole('button', { name: 'Remove', exact: true }).click();
    // The rows are rebuilt by AJAX, so read their values again until it's gone.
    await expect
      .poll(() => this.duties.evaluateAll((els) => els.map((el) => (el as HTMLTextAreaElement).value)))
      .not.toContain(value);
  }

  /** Removes the experience whose "Remove <title> <company> …" button matches. */
  async removeExperience(title: string) {
    const remove = this.form.getByRole('button', { name: new RegExp(`^Remove ${escape(title)}\\b`) });
    await remove.click();
    await expect(remove).toHaveCount(0);
  }

  /** The review page's preview iframe. */
  async openPreview(): Promise<FrameLocator> {
    await this.page.goto(`/resume/${this.id}`);
    const frame = this.page.frameLocator('main iframe');
    await expect(frame.locator('article')).toBeVisible();
    return frame;
  }
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
