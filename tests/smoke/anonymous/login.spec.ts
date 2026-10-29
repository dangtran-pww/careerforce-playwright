import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/login.page';

// [Smoke] - Anonymous - Test Plan, HP-2.
// See test-plans/smoke-anonymous-test-plan.md.
//
// Given: an anonymous visitor
// When: they open the login page
// Then: they see the "Log In or Register with LoginMN" hand-off button
//       (this site has no inline username/password form of its own)

test('login page offers Log In or Register with LoginMN', async ({ page }) => {
  const login = new LoginPage(page);
  await login.goto();
  await expect(login.loginMNButton).toBeVisible();
});
