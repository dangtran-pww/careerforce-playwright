import { test, expect } from '../../helpers/fixtures';
import { LoginPage } from '../../pages/login.page';

// [Smoke] - Anonymous - Test Plan, HP-2.
// See test-plans/smoke-anonymous.md.
//
// Given: an anonymous visitor
// When: they open the login page
// Then: they see the three ways to log in:
//       - Job Seekers: the "Log In or Register with LoginMN" hand-off button
//       - Partners: an email/password form, behind a closed accordion
//       - DEED staff: a "Log In" button, behind a second closed accordion
// The accordions are only opened, never submitted: nothing is logged in.

test('HP-2: login page offers Job Seeker, partner, and DEED staff login', async ({
  page,
}) => {
  const login = new LoginPage(page);
  await login.goto();

  await test.step('Job Seekers section', async () => {
    await expect(login.jobSeekerHeading).toBeVisible();
    expect(await login.jobSeekerBenefits.count()).toBeGreaterThan(0);
    await expect(login.loginMNButton).toBeVisible();
    await expect(login.dataPrivacyNotice).toBeVisible();
    await expect(login.dataPrivacyLink).toHaveAttribute(
      'href',
      'https://mn.gov/deed/about/what-guides-us/data-practices/',
    );
  });

  await test.step('Partner section', async () => {
    await expect(login.partnerToggle).toHaveText(
      'CareerForce partner organization or a training program provider',
    );
    await expect(login.partnerEmailInput).toBeHidden();
    await login.partnerToggle.click();
    await expect(login.partnerLoginHeading).toBeVisible();
    await expect(login.partnerEmailInput).toBeVisible();
    await expect(login.partnerPasswordInput).toBeVisible();
    await expect(login.partnerForgotPasswordLink).toHaveAttribute('href', '/user/password');
    await expect(login.partnerSubmitButton).toBeVisible();
    await expect(login.partnerRequestAccountLink).toHaveAttribute(
      'href',
      '/user/register-partner',
    );
  });

  await test.step('DEED Staff Member section', async () => {
    await expect(login.staffToggle).toHaveText('DEED Staff Member');
    await expect(login.staffLoginButton).toBeHidden();
    await login.staffToggle.click();
    await expect(login.staffLoginButton).toBeVisible();
  });
});
