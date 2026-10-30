import { test, expect } from '../../helpers/fixtures';
import { LoginPage } from '../../pages/login.page';

// [Smoke] - Anonymous - Test Plan, HP-2.
// See test-plans/smoke-anonymous.md.
//
// Given: an anonymous visitor
// When: they open the login page
// Then: they see the "Log In or Register with LoginMN" hand-off button
//       (this site has no inline username/password form of its own)

test('HP-2: login page offers Log In or Register with LoginMN', async ({ page }) => {
  const login = new LoginPage(page);
  await login.goto();
  await expect(login.loginMNButton).toBeVisible();
});
