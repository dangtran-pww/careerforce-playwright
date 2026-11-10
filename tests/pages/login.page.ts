import { type Locator, type Page } from '@playwright/test';

// /user/login here is not a single username/password form. It has three
// sections, one per kind of user:
// - Job Seekers: always shown. Drupal hands login off to LoginMN (the
//   state's shared identity provider) — no username/password boxes here.
// - Partners and training providers: a native <details> accordion, closed
//   on load, holding Drupal's own email/password form (with a reCAPTCHA).
// - DEED Staff Member: a second closed <details>, with a staff SSO "Log In"
//   button. QA and stage also add a "PWW Staff Log In" button there;
//   production doesn't.
// The page has several "Log In" texts (header, partner form heading, staff
// button), so each section's controls are scoped to that section's root.
export class LoginPage {
  readonly page: Page;
  readonly jobSeekerSection: Locator;
  readonly jobSeekerHeading: Locator;
  readonly jobSeekerBenefits: Locator;
  readonly loginMNButton: Locator;
  readonly dataPrivacyNotice: Locator;
  readonly dataPrivacyLink: Locator;
  readonly partnerSection: Locator;
  readonly partnerToggle: Locator;
  readonly partnerLoginHeading: Locator;
  readonly partnerEmailInput: Locator;
  readonly partnerPasswordInput: Locator;
  readonly partnerForgotPasswordLink: Locator;
  readonly partnerSubmitButton: Locator;
  readonly partnerRequestAccountLink: Locator;
  readonly staffSection: Locator;
  readonly staffToggle: Locator;
  readonly staffLoginButton: Locator;
  readonly pwwStaffLoginButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.jobSeekerSection = page.locator('.login-landing-page-jobseeker-section');
    this.jobSeekerHeading = this.jobSeekerSection.getByRole('heading', {
      name: 'Job Seekers',
    });
    this.jobSeekerBenefits = this.jobSeekerSection.getByRole('listitem');
    this.loginMNButton = this.jobSeekerSection.getByRole('button', {
      name: 'Log In or Register with LoginMN',
    });
    this.dataPrivacyNotice = this.jobSeekerSection.getByText('Data Privacy Notice');
    this.dataPrivacyLink = this.jobSeekerSection.getByRole('link', {
      name: "Learn more about DEED's data privacy policies",
    });

    this.partnerSection = page.locator('details.login-landing-page-partner-section');
    this.partnerToggle = this.partnerSection.locator('summary');
    this.partnerLoginHeading = this.partnerSection.getByRole('heading', {
      name: 'Log In',
      exact: true,
    });
    this.partnerEmailInput = this.partnerSection.getByRole('textbox', {
      name: 'Email address',
    });
    this.partnerPasswordInput = this.partnerSection.getByRole('textbox', {
      name: 'Password',
    });
    this.partnerForgotPasswordLink = this.partnerSection.getByRole('link', {
      name: 'Forgot your password?',
    });
    this.partnerSubmitButton = this.partnerSection.getByRole('button', {
      name: 'Submit',
    });
    this.partnerRequestAccountLink = this.partnerSection.getByRole('link', {
      name: 'Request one today',
    });

    this.staffSection = page.locator('details.login-landing-page-staff-section');
    this.staffToggle = this.staffSection.locator('summary');
    this.staffLoginButton = this.staffSection.getByRole('button', {
      name: 'Log In',
      exact: true,
    });
    this.pwwStaffLoginButton = this.staffSection.getByRole('button', {
      name: 'PWW Staff Log In',
    });
  }

  async goto() {
    await this.page.goto('/user/login');
  }
}
