import { type Locator, type Page } from '@playwright/test';

// /user/login here is not a username/password form — Drupal hands login off
// to LoginMN (the state's shared identity provider). Confirmed by inspecting
// the QA login page directly; a generic Drupal starter would assume
// getByLabel('Username'), which does not apply to this site.
export class LoginPage {
  readonly page: Page;
  readonly loginMNButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.loginMNButton = page.getByRole('button', {
      name: 'Log In or Register with LoginMN',
    });
  }

  async goto() {
    await this.page.goto('/user/login');
  }
}
