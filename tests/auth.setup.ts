import { test as setup, expect } from '@playwright/test';
import { execSync } from 'node:child_process';

const authFile = 'playwright/.auth/editor.json';

// Not currently wired into playwright.config.ts: auth is moving to SSO,
// which can't be automated with real credentials, so the session is
// captured by hand instead (see scripts/login-manual.mjs / `npm run
// login:manual`). Kept here for a future environment with Drush access, or
// as a reference for the UI-login fallback below.

setup('authenticate as editor', async ({ page }) => {
  const baseURL = process.env.BASE_URL ?? 'https://staging.example.com';
  const drush = process.env.DRUSH_CMD ?? 'drush';

  // Drupal-friendly login: a one-time link, no password typed in the form.
  // If Drush runs inside DDEV/Lando, set DRUSH_CMD="ddev drush".
  const loginUrl = execSync(
    `${drush} uli --name=test-editor --uri=${baseURL} --no-browser`,
    { encoding: 'utf-8' },
  ).trim();

  await page.goto(loginUrl);

  // Prove we are really logged in as an editor, not just on a page.
  await page.goto('/admin/content');
  await expect(page.getByRole('heading', { name: 'Content' })).toBeVisible();

  await page.context().storageState({ path: authFile });
});

/*
 * UI-login fallback — use this instead of the `drush uli` block above only
 * if Drush is not available where Playwright runs. Credentials come from
 * environment variables and must never be committed.
 *
 *   await page.goto('/user/login');
 *   await page.getByLabel('Username').fill(process.env.TEST_EDITOR_USER!);
 *   await page.getByLabel('Password').fill(process.env.TEST_EDITOR_PASSWORD!);
 *   await page.getByRole('button', { name: 'Log in' }).click();
 *   await page.goto('/admin/content');
 *   await expect(page.getByRole('heading', { name: 'Content' })).toBeVisible();
 */
