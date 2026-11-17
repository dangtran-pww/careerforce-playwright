import { test, expect } from '../../helpers/fixtures';
import { useRole } from '../../helpers/roles';
import { uniqueToken } from '../../helpers/test-data';
import { rolePage } from '../../helpers/visitor';
import { ResumeCenter, ResumeEditor, deleteByUrl } from '../../pages/resume-builder.page';

// [Smoke] - Resume Builder - Test Plan, RB-1 to RB-5. See
// test-suites/smoke/smoke-resume-builder.md.
//
// One master resume per account: RB-1 deletes the job seeker's existing
// master resume, then builds a new one. RB-2 and RB-3 add and edit an
// experience on it, RB-4 and RB-5 make and change a targeted copy. afterAll
// deletes the master and targeted resumes these tests made, even when a case
// failed. Targeted resumes and uploads made elsewhere are left alone. QA and
// Stage only. All content is synthetic.

useRole('jobseeker');

const token = uniqueToken();
const CONTACT = { first: 'Pat', last: `Example ${token}`, city: 'Saint Paul', state: 'Minnesota' };
const SUMMARY = `Playwright test ${token} master summary: a made-up job seeker for automated checks.`;
const TAILORED_SUMMARY = `Playwright test ${token} targeted summary for a made-up opening.`;
const TAILORED_TITLE = `Playwright test ${token} targeted`;
const JOB = {
  company: 'Playwright Test Co',
  location: 'Saint Paul, MN',
  title: `Synthetic Analyst ${token}`,
  newTitle: `Senior Synthetic Analyst ${token}`,
};
const DUTY_1 = `Reviewed made-up reports for test ${token}.`;
const DUTY_1_EDITED = `Reviewed and summarized made-up reports for test ${token}.`;
const DUTY_2 = `Filed synthetic tickets for test ${token}.`;

const created: { master?: string; tailored?: string } = {};

function master(page: import('@playwright/test').Page): ResumeEditor {
  expect(created.master, 'RB-1 built the master resume').toBeTruthy();
  return new ResumeEditor(page, created.master!);
}

function tailored(page: import('@playwright/test').Page): ResumeEditor {
  expect(created.tailored, 'RB-4 created the targeted resume').toBeTruthy();
  return new ResumeEditor(page, created.tailored!);
}

test.describe('resume builder', { tag: ['@no-prod', '@desktop-only'] }, () => {
  test.describe.configure({ mode: 'serial' });

  test.afterAll(async ({ browser }, testInfo) => {
    const page = await rolePage(browser, testInfo, 'jobseeker');
    try {
      for (const id of [created.tailored, created.master]) {
        if (id) await deleteByUrl(page, `/resume/${id}/delete`);
      }
    } finally {
      await page.context().close();
    }
  });

  test('RB-1: Create a master resume', async ({ page }) => {
    const center = new ResumeCenter(page);
    await center.open();

    // Only one master resume per account: delete the one already there.
    const existing = await center.masterId();
    if (existing) {
      await deleteByUrl(page, `/resume/${existing}/delete`);
      await center.open();
      expect(await center.masterId(), 'the old master resume is gone').toBeUndefined();
    }

    // 1. Build a master resume: contact information, then the summary.
    created.master = await center.buildMasterResume();
    const resume = master(page);
    await resume.fillContact(CONTACT);
    await resume.saveAndContinue();
    await resume.openStep('summary');
    await resume.summary.fill(SUMMARY);
    await resume.saveAndContinue();

    // 2. It's listed on My Resume Center, and its preview shows the summary.
    await center.open();
    expect(await center.masterId()).toBe(created.master);
    const preview = await resume.openPreview();
    await expect(preview.getByText(SUMMARY)).toBeVisible();
    await expect(preview.getByText(`${CONTACT.first} ${CONTACT.last}`)).toBeVisible();
  });

  test('RB-2: Add an experience with duties', async ({ page }) => {
    const resume = master(page);

    // 1. Add a job with two duties and save.
    await resume.openStep('experience');
    const job = resume.experience(0);
    await job.company.fill(JOB.company);
    await job.location.fill(JOB.location);
    await job.title.fill(JOB.title);
    await job.startMonth.selectOption({ label: 'Mar' });
    await job.startYear.selectOption({ label: '2021' });
    await job.current.check();
    await resume.duty(1).fill(DUTY_1);
    if (!(await resume.duty(2).count())) await resume.addDuty();
    await resume.duty(2).fill(DUTY_2);
    await resume.saveAndContinue();

    // 2. The preview shows the job and both duties.
    const preview = await resume.openPreview();
    await expect(preview.getByText(JOB.title)).toBeVisible();
    await expect(preview.getByText(JOB.company)).toBeVisible();
    await expect(preview.getByText(DUTY_1)).toBeVisible();
    await expect(preview.getByText(DUTY_2)).toBeVisible();
  });

  test('RB-3: Edit an experience and its duties', async ({ page }) => {
    const resume = master(page);

    // 1. New title, edit duty 1, remove duty 2, save.
    await resume.openStep('experience');
    await expect(resume.experience(0).title).toHaveValue(JOB.title);
    await resume.experience(0).title.fill(JOB.newTitle);
    await expect(resume.duty(1)).toHaveValue(DUTY_1);
    await resume.duty(1).fill(DUTY_1_EDITED);
    await expect(resume.duty(2)).toHaveValue(DUTY_2);
    await resume.removeDuty(2);
    await resume.saveAndContinue();

    // 2. The preview shows the new title and duty; the removed duty is gone.
    const preview = await resume.openPreview();
    await expect(preview.getByText(JOB.newTitle)).toBeVisible();
    await expect(preview.getByText(DUTY_1_EDITED)).toBeVisible();
    await expect(preview.getByText(DUTY_2)).toHaveCount(0);
    await expect(preview.getByText(JOB.title, { exact: true })).toHaveCount(0);
  });

  test('RB-4: Create a tailored resume', async ({ page }) => {
    const resume = master(page);

    // 1. "Build a targeted resume" from the master, with a unique title.
    await page.goto(`/resume/${resume.id}`);
    await page.getByRole('link', { name: /Build a targeted resume/ }).click();
    await expect(page.getByRole('heading', { name: 'Craft your targeted resume in just a few steps!' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Resume Title' }).fill(TAILORED_TITLE);
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await page.waitForURL(/\/resume\/\d+\/contact_information/);
    created.tailored = page.url().match(/\/resume\/(\d+)/)![1];
    expect(created.tailored).not.toBe(resume.id);

    // 2. Leave out the experience.
    const copy = tailored(page);
    await copy.openStep('experience');
    await copy.removeExperience(JOB.newTitle);
    await copy.saveAndContinue();

    // 3. It's listed under Targeted Resumes; its preview has the summary but
    // not the experience.
    const center = new ResumeCenter(page);
    await center.open();
    await expect(center.item('Targeted Resumes', TAILORED_TITLE)).toBeVisible();
    const preview = await copy.openPreview();
    await expect(preview.getByText(SUMMARY)).toBeVisible();
    await expect(preview.getByText(JOB.newTitle)).toHaveCount(0);
    await expect(preview.getByText(DUTY_1_EDITED)).toHaveCount(0);
  });

  test('RB-5: Update a tailored resume', async ({ page }) => {
    const copy = tailored(page);

    // 1. Change the targeted resume's summary.
    await copy.openStep('summary');
    await expect(copy.summary).toHaveValue(SUMMARY);
    await copy.summary.fill(TAILORED_SUMMARY);
    await copy.saveAndContinue();

    // 2. The targeted preview shows it; the master resume is unchanged.
    const preview = await copy.openPreview();
    await expect(preview.getByText(TAILORED_SUMMARY)).toBeVisible();
    await expect(preview.getByText(SUMMARY)).toHaveCount(0);

    const masterPreview = await master(page).openPreview();
    await expect(masterPreview.getByText(SUMMARY)).toBeVisible();
    await expect(masterPreview.getByText(TAILORED_SUMMARY)).toHaveCount(0);
    await expect(masterPreview.getByText(JOB.newTitle)).toBeVisible();
  });
});
