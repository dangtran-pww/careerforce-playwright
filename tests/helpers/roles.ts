import { existsSync } from 'node:fs';

import { test, expect } from './fixtures';
import { authFile, currentEnv, loginCommand } from './environments.mjs';

// Runs the tests of the current file (or describe block) logged in as
// `role`, with that role's saved session for this environment
// (playwright/.auth/<env>/<role>.json). Call it at the top of a spec or
// inside a `test.describe`:
//
//   useRole('admin');
//
// Before the first test, it checks once per worker that the session still
// logs in, so an expired session fails with one clear "run npm run
// login:manual -- <role>" message instead of every test failing on the login
// page. It can't log in for you: login is SSO, which blocks a Playwright
// browser (see scripts/login-manual.mjs).
//
// Looking at the cookie's expiry date isn't enough. Drupal also ends a
// session server-side, e.g. when the same account logs in somewhere else, so
// this asks the site: a logged-out visit to /user goes to /user/login.

const checked = new Set<string>();

export function useRole(role: string): void {
  const file = authFile(role);
  const hint = `Run \`${loginCommand(role, currentEnv())}\` and try again.`;

  // A missing file would fail every test with a bare ENOENT; let the check
  // below say what to do instead.
  test.use({ storageState: existsSync(file) ? file : undefined });

  test.beforeAll(async ({ page }) => {
    if (checked.has(role)) return;
    expect(existsSync(file), `No saved ${role} session at ${file}. ${hint}`).toBe(true);

    await page.goto('/user');
    expect(
      new URL(page.url()).pathname,
      `The saved ${role} session has expired or was logged out. ${hint}`,
    ).not.toBe('/user/login');

    if (role === 'admin') {
      await page.goto('/admin/reports/status');
      await expect(
        page.getByRole('heading', { name: 'Status report' }),
        `Logged in, but not as an admin (no access to the status report). ${hint}`,
      ).toBeVisible();
    }
    checked.add(role);
  });
}
