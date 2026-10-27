import { test, expect } from '@playwright/test';

// Read-only critical-path checks. These are the safest first tests and the
// only kind suitable for a post-deploy check on production (pointed at prod,
// they must not create, edit, or delete anything).

test.describe('critical-path smoke', () => {
  test('homepage loads for an anonymous visitor', async ({ page }) => {
    await page.goto('/');
    // Replace with a heading or landmark that is always on your homepage.
    await expect(page.locator('main')).toBeVisible();
  });

  test('login page loads', async ({ page }) => {
    await page.goto('/user/login');
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });

  test('editor can reach the content admin list', async ({ page }) => {
    // This test uses the saved editor session from auth.setup.ts.
    await page.goto('/admin/content');
    await expect(page.getByRole('heading', { name: 'Content' })).toBeVisible();
  });
});
