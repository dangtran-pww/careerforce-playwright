import { test, expect } from '../../helpers/fixtures';
import { useRole } from '../../helpers/roles';
import { rolePage } from '../../helpers/visitor';
import { currentUid } from '../../pages/my-events.page';
import { expectNoErrors } from '../../pages/node-form.page';
import { displayedPhone, ProfilePage, SECTIONS } from '../../pages/profile.page';

// [Smoke] - Profile - Test Plan, PF-4 and PF-5: an admin (standing in for
// customer support) finds the job seeker test account, views its profile and
// edits it. See test-suites/smoke/smoke-profile.md.
//
// QA and Stage only: it edits the job seeker test account, and puts the
// field back in `finally`. The test's own page is the admin; the job seeker
// gets a page of their own, which is also how the test finds the account.

useRole('admin');

test.describe('profile: an admin views and edits a job seeker', { tag: ['@no-prod', '@desktop-only'] }, () => {
  test('PF-4: Admin views another user\'s profile', async ({ page, browser }, testInfo) => {
    const seeker = await rolePage(browser, testInfo, 'jobseeker');
    let uid = '';
    let email = '';
    try {
      uid = await currentUid(seeker);
      // My Profile shows the email (managed by LoginMN, so read-only).
      await seeker.goto(`/user/${uid}/edit`);
      email = await seeker.locator('main').getByLabel('Email', { exact: true }).inputValue();
    } finally {
      await seeker.context().close();
    }
    expect(email, `email of the jobseeker account (user ${uid})`).toContain('@');

    await test.step('1. People: filter by the job seeker\'s email', async () => {
      await page.goto('/admin/people');
      await page.getByLabel('Name or email address contains').fill(email);
      await page.getByRole('button', { name: 'Filter', exact: true }).click();
      await expect(page.getByRole('link', { name: email, exact: true })).toHaveCount(1);
    });

    await test.step('2. open their profile', async () => {
      await page.getByRole('link', { name: email, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/user/${uid}$`));
      await expect(page.getByRole('heading', { level: 1, name: 'View Profile' })).toBeVisible();
      const main = page.locator('main');
      await expect(main.getByText(`User ID: ${uid}`)).toBeVisible();
      for (const name of ['Account Information', ...Object.values(SECTIONS)]) {
        await expect(main.getByRole('heading', { level: 2, name, exact: true })).toBeVisible();
      }
      await expectNoErrors(page);
    });
  });

  test('PF-5: Admin edits another user\'s profile', async ({ page, browser }, testInfo) => {
    const admin = new ProfilePage(page);
    const seekerPage = await rolePage(browser, testInfo, 'jobseeker');
    const seeker = new ProfilePage(seekerPage);
    try {
      const uid = await currentUid(seekerPage);
      await admin.openSection(uid, 'demographic');
      const original = await admin.alternatePhone.inputValue();
      const value = original === '651-555-0105' ? '651-555-0106' : '651-555-0105';

      try {
        await test.step('1. as admin, change the alternate phone and save', async () => {
          await admin.alternatePhone.fill(value);
          await admin.save(uid);
          await expectNoErrors(page);
          await expect(page.getByRole('heading', { level: 1, name: 'View Profile' })).toBeVisible();
          await expect(admin.viewSection(SECTIONS.demographic)).toContainText(
            displayedPhone(value),
          );
        });

        await test.step('2. the job seeker sees the same value', async () => {
          await seeker.openSection(uid, 'demographic');
          await expect(seeker.alternatePhone).toHaveValue(value);
        });
      } finally {
        await admin.setAlternatePhone(uid, original);
      }
    } finally {
      await seekerPage.context().close();
    }
  });
});
