import type { Page } from '@playwright/test';

// The plain fixtures, not ../../helpers/autologout's `test`: that one blocks
// the logout addresses, and this case needs the real logout.
import { test, expect } from '../../helpers/fixtures';
import { WARNING_MESSAGE, warningDialog } from '../../helpers/autologout';
import { currentEnv } from '../../helpers/environments.mjs';
import {
  formAccount,
  formAccountVars,
  loginWithPartnerForm,
} from '../../helpers/form-login';
import { statusMessages } from '../../pages/node-form.page';

// [Smoke] - Auto Logout - Test Plan — AO-7. See
// test-suites/smoke/smoke-auto-logout.md. Desktop only, not on Production.
//
// Logs a dedicated partner account in through the /user/login form, leaves
// /user alone with the real clock, and waits out the real logout. It uses no
// saved session, so the shared admin and job seeker sessions are never
// touched. Nothing on the page is touched between loading /user (T0) and
// the logout, so the script and the server see no activity.

const INACTIVITY_MESSAGE = 'You have been logged out due to inactivity.';
const ACCOUNT_PREFIX = 'AUTO_LOGOUT';

// Where a logged-in partner can land: the account's page, or its partner
// profile form while the profile isn't complete. Either means the login worked.
const ACCOUNT_PAGE = /^\/user\/\d+(\/partner)?$/;

const minutes = (m: number, s = 0) => (m * 60 + s) * 1000;

/** Waits, with the real clock, until `ms` after T0. */
async function waitUntil(page: Page, t0: number, ms: number) {
  const left = t0 + ms - Date.now();
  // Waiting out real time is what this case checks: nothing on the page
  // changes until the warning, and touching the page would reset the timer.
  // eslint-disable-next-line playwright/no-wait-for-timeout
  if (left > 0) await page.waitForTimeout(left);
}

/** Milliseconds from now until `ms` after T0 (at least 1 second). */
const until = (t0: number, ms: number) => Math.max(1_000, t0 + ms - Date.now());

test.describe('real logout', { tag: ['@no-prod', '@desktop-only'] }, () => {
  test('AO-7: a page left alone really logs out at 15 minutes', async ({ page }) => {
    test.setTimeout(minutes(20));

    const env = currentEnv();
    const vars = formAccountVars(ACCOUNT_PREFIX, env);
    const account = formAccount(ACCOUNT_PREFIX, env);
    // A precondition, not a site problem: the account isn't set up here.
    // eslint-disable-next-line playwright/no-skipped-test
    test.skip(
      !account,
      `The auto logout account isn't set up for ${env.name} (${vars.user}, ${vars.password}).`,
    );

    let userPath = '';
    await test.step('1. Log in through the partner login form', async () => {
      const result = await loginWithPartnerForm(page, account!);
      // eslint-disable-next-line playwright/no-skipped-test
      test.skip(
        result === 'unrecognized',
        `The auto logout account doesn't exist on ${env.name}, or its password in .env is wrong.`,
      );
      expect(new URL(page.url()).pathname, 'logged in: /user/<ID> or /user/<ID>/partner').toMatch(ACCOUNT_PAGE);
    });

    let t0 = 0;
    await test.step('2. Open /user (T0)', async () => {
      await page.goto('/user');
      t0 = Date.now();
      userPath = new URL(page.url()).pathname;
      expect(userPath, 'logged in: /user/<ID> or /user/<ID>/partner').toMatch(ACCOUNT_PAGE);
      const settings = await page.evaluate(
        () =>
          (window as unknown as { drupalSettings?: { autologout?: { redirect_url?: string } } })
            .drupalSettings?.autologout,
      );
      expect(settings, 'drupalSettings.autologout').toBeDefined();
      const redirect = new URL(settings!.redirect_url ?? '', 'https://example.test');
      expect(redirect.searchParams.get('autologout_timeout'), 'redirect_url has autologout_timeout=1').toBe('1');
    });

    const dialog = warningDialog(page);

    await test.step('3. No warning before T0 + 9:30', async () => {
      await waitUntil(page, t0, minutes(9, 30));
      await expect.soft(dialog, 'no warning before 9:30').toBeHidden({ timeout: 1_000 });
    });

    await test.step('4. The warning shows by T0 + 10:30', async () => {
      await expect.soft(dialog, 'the warning by 10:30').toBeVisible({
        timeout: until(t0, minutes(10, 30)),
      });
      await expect.soft(dialog).toContainText(WARNING_MESSAGE, { timeout: 1_000 });
      await expect.soft(dialog.getByRole('button', { name: 'Yes', exact: true })).toBeVisible({ timeout: 1_000 });
      await expect.soft(dialog.getByRole('button', { name: 'No', exact: true })).toBeVisible({ timeout: 1_000 });
    });

    await test.step('5. Still logged in at T0 + 14:30', async () => {
      await waitUntil(page, t0, minutes(14, 30));
      expect(new URL(page.url()).pathname, 'not logged out yet').toBe(userPath);
      await expect.soft(dialog, 'the warning is still open').toBeVisible({ timeout: 1_000 });
    });

    await test.step('6. Logged out by T0 + 15:45', async () => {
      await page.waitForURL(
        (url) =>
          url.pathname === '/user/login' &&
          url.searchParams.get('autologout_timeout') === '1',
        { timeout: until(t0, minutes(15, 45)) },
      );
      await expect(statusMessages(page)).toContainText(INACTIVITY_MESSAGE);
    });

    await test.step('7. The session ended on the server', async () => {
      await page.goto('/user');
      expect(new URL(page.url()).pathname, 'the login page').toBe('/user/login');
      await expect(page).toHaveTitle(/Log In or Register/);
    });
  });
});
