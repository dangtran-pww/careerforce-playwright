import { existsSync } from 'node:fs';

import { request } from '@playwright/test';

import { test, expect } from './fixtures';
import {
  authFile,
  currentEnv,
  loginCommand,
  ROLE_DRUPAL_ROLES,
  ROLE_PROFILE_TYPES,
  ROLES_CHECKED_ON_ACCOUNT_SETTINGS,
  roleAvailableOn,
  roleEnvironments,
} from './environments.mjs';
import { accountInfo, accountRoles } from '../../scripts/lib/account.mjs';

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
// Roles with a profile type (ROLE_PROFILE_TYPES: jobseeker, partner) also
// check drupalSettings.user.profile_type, and admin checks that it can open
// the status report, so a session saved with the wrong account fails too.
// Manager roles (ROLE_DRUPAL_ROLES) must have their Drupal role. Platform
// managers can see theirs, checked, on their own /user/<uid>/account-settings
// (ROLES_CHECKED_ON_ACCOUNT_SETTINGS). The others can't see their own roles,
// so that check reads the People list with the saved admin, platform manager or account manager
// login (an account manager's own first), and fails if none of them works.

const checked = new Set<string>();

export function useRole(role: string): void {
  // A role that only exists on some environments (e.g. staff: local only)
  // leaves its tests out elsewhere, like @no-prod tests on production.
  if (!roleAvailableOn(role)) {
    test.skip(
      true,
      `The ${role} role only exists on: ${roleEnvironments(role)!.join(', ')}.`,
    );
    return;
  }
  const file = authFile(role);
  const hint = `Run \`${loginCommand(role, currentEnv())}\` and try again.`;

  // A missing file would fail every test with a bare ENOENT; let the check
  // below say what to do instead.
  test.use({ storageState: existsSync(file) ? file : undefined });

  // `page` can't be used in beforeAll (it's made per test), so this opens
  // its own context with the project's site, Basic Auth and the saved login.
  test.beforeAll(async ({ browser }, testInfo) => {
    if (checked.has(role)) return;
    expect(
      existsSync(file),
      `No saved ${role} session at ${file}. ${hint}`,
    ).toBe(true);

    const { baseURL, httpCredentials, ignoreHTTPSErrors } =
      testInfo.project.use;
    const context = await browser.newContext({
      baseURL,
      httpCredentials,
      ignoreHTTPSErrors,
      storageState: file,
    });
    try {
      const page = await context.newPage();
      await page.goto('/user');
      expect(
        new URL(page.url()).pathname,
        `The saved ${role} session has expired or was logged out. ${hint}`,
      ).not.toBe('/user/login');

      const profileType = ROLE_PROFILE_TYPES[role];
      if (profileType) {
        const actual = await page.evaluate(
          () =>
            (
              window as unknown as {
                drupalSettings?: { user?: { profile_type?: string | null } };
              }
            ).drupalSettings?.user?.profile_type,
        );
        expect(
          actual,
          `Logged in, but not as ${role === 'jobseeker' ? 'a job seeker' : `a ${role}`} (drupalSettings.user.profile_type is ${JSON.stringify(actual)}). ${hint}`,
        ).toBe(profileType);
      }

      const drupalRole = ROLE_DRUPAL_ROLES[role];
      if (drupalRole && ROLES_CHECKED_ON_ACCOUNT_SETTINGS.includes(role)) {
        // The account's own settings page shows its roles as checkboxes.
        const uid = await page.evaluate(
          () =>
            (
              window as unknown as {
                drupalSettings?: { user?: { uid?: string | number } };
              }
            ).drupalSettings?.user?.uid,
        );
        const settingsPage = `/user/${uid}/account-settings`;
        const response = await page.goto(settingsPage);
        expect(
          response?.ok(),
          `Logged in as ${role}, but ${settingsPage} isn't available (HTTP ${response?.status()}). ${hint}`,
        ).toBe(true);
        await expect(
          page.getByRole('checkbox', { name: drupalRole, exact: true }),
          `Logged in, but the ${drupalRole} role isn't checked on ${settingsPage}. ${hint}`,
        ).toBeChecked();
      } else if (drupalRole)
        await expectDrupalRole(role, drupalRole, file, hint, {
          baseURL,
          httpCredentials,
          ignoreHTTPSErrors,
        });

      if (role === 'admin') {
        await page.goto('/admin/reports/status');
        await expect(
          page.getByRole('heading', { name: 'Status report' }),
          `Logged in, but not as an admin (no access to the status report). ${hint}`,
        ).toBeVisible();
      }
    } finally {
      await context.close();
    }
    checked.add(role);
  });
}

// Fails unless the account behind `file` (a saved session) has the Drupal
// role `drupalRole`, as the People list shows it to the saved admin,
// platform manager or account manager login (accountRoles).
async function expectDrupalRole(
  role: string,
  drupalRole: string,
  file: string,
  hint: string,
  site: Pick<
    Parameters<typeof request.newContext>[0] & {},
    'baseURL' | 'httpCredentials' | 'ignoreHTTPSErrors'
  >,
): Promise<void> {
  const env = currentEnv();
  const ctx = await request.newContext({ ...site, storageState: file });
  try {
    const { email = '' } = await accountInfo(ctx);
    expect(
      email,
      `Logged in as ${role}, but couldn't read the account's email to check its roles.`,
    ).toBeTruthy();
    const { roles, detailsNote } = await accountRoles(email, role, env, ctx);
    expect(
      roles,
      `Can't check that the ${role} account (${email}) has the ${drupalRole} role: ${detailsNote} Run \`${loginCommand('admin', env)}\` or \`${loginCommand('platform-manager', env)}\` and try again.`,
    ).toBeDefined();
    expect(
      roles,
      `Logged in, but ${email} doesn't have the ${drupalRole} role. ${hint}`,
    ).toContain(drupalRole);
  } finally {
    await ctx.dispose();
  }
}
