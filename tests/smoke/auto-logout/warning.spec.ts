import type { Page } from '@playwright/test';

import {
  test,
  expect,
  minutes,
  openWithClock,
  warningDialog,
  WARNING_MESSAGE,
  type LogoutRequest,
} from '../../helpers/autologout';
import { useRole } from '../../helpers/roles';

// [Smoke] - Auto Logout - Test Plan — AO-3 to AO-5. See
// test-suites/smoke/smoke-auto-logout.md. Desktop only.
//
// Each page is opened with Playwright's clock installed and paused, and its
// clock is moved forward so the warning shows in seconds. Rules that keep
// the shared sessions alive (see the plan's Scope):
// - the logout addresses are blocked on every page (tests/helpers/autologout.ts);
// - the clock never goes past 15:05 after the page loaded, well under the
//   real 15 idle minutes the server checks;
// - nothing on the page is touched before the warning shows, and the
//   dialog's "x" is never clicked.

/** AO-3 and AO-4: warning at 11 minutes, and "Yes" keeps the session. */
async function warningThenYes(
  page: Page,
  logoutRequests: LogoutRequest[],
  path: string,
  pageLoaded: (page: Page) => Promise<void>,
) {
  const dialog = warningDialog(page);
  const clock = await openWithClock(page, path);

  await test.step('1. No warning at 10:50', async () => {
    await clock.advance(minutes(10, 50));
    await expect(dialog).toBeHidden();
    expect(logoutRequests, 'requests to a logout address').toEqual([]);
  });

  await test.step('2. Warning at 11:05', async () => {
    await clock.advance(minutes(0, 15));
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(WARNING_MESSAGE);
    await expect(dialog.getByRole('button', { name: 'Yes', exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'No', exact: true })).toBeVisible();
    expect(logoutRequests, 'requests to a logout address').toEqual([]);
  });

  await test.step('3. "Yes" closes the warning and refreshes the session', async () => {
    const refreshed = page.waitForResponse((response) =>
      new URL(response.url()).pathname === '/autologout_ajax_set_last',
    );
    await dialog.getByRole('button', { name: 'Yes', exact: true }).click();
    expect((await refreshed).status(), '/autologout_ajax_set_last').toBe(200);
    await expect(dialog).toBeHidden();
    expect(logoutRequests, 'requests to a logout address').toEqual([]);
  });

  await test.step('4. Still logged in after a reload', async () => {
    await page.reload();
    expect(new URL(page.url()).pathname, 'not the login page').not.toBe('/user/login');
    await pageLoaded(page);
    expect(logoutRequests, 'requests to a logout address').toEqual([]);
  });
}

const statusReportShows = async (page: Page) => {
  await expect(page.getByRole('heading', { name: 'Status report' })).toBeVisible();
};

test.describe('admin', () => {
  useRole('admin');

  test('AO-3: admin: warning at 11 minutes, Yes keeps the session', async ({
    page,
    logoutRequests,
  }) => {
    await warningThenYes(page, logoutRequests, '/admin/reports/status', statusReportShows);
  });

  test('AO-5: No, or no answer, asks to log out', async ({
    page,
    context,
    logoutRequests,
  }) => {
    await test.step('1. "No" asks to log out', async () => {
      const dialog = warningDialog(page);
      const clock = await openWithClock(page, '/admin/reports/status');
      await clock.advance(minutes(11, 5));
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'No', exact: true }).click();
      await clock.settle();
      await expect(dialog).toBeHidden();
      // The module sends this POST twice: once from the button and once from
      // the dialog's close handler (drupal/autologout's autologout.js).
      expect(logoutRequests.length, 'logout requests').toBeGreaterThan(0);
      expect(logoutRequests).toContainEqual({
        method: 'POST',
        path: '/autologout_ajax_logout',
      });
      await page.close();
    });

    await test.step('2. No answer for 4 minutes asks to log out', async () => {
      logoutRequests.length = 0;
      const second = await context.newPage();
      const dialog = warningDialog(second);
      const clock = await openWithClock(second, '/admin/reports/status');
      await clock.advance(minutes(11, 5));
      await expect(dialog).toBeVisible();
      expect(logoutRequests, 'no logout while the warning waits').toEqual([]);
      await clock.advance(minutes(4));
      // No check on the dialog here: with the logout blocked, the script
      // shows the warning again (autologout.js chains every time-left
      // callback), where a real logout would have left the page.
      expect(logoutRequests).toEqual([
        { method: 'POST', path: '/autologout_ajax_logout' },
      ]);
      await second.close();
    });

    await test.step('3. The session is still valid', async () => {
      const third = await context.newPage();
      await third.goto('/admin/reports/status');
      expect(new URL(third.url()).pathname, 'not the login page').not.toBe('/user/login');
      await statusReportShows(third);
    });
  });
});

test.describe('job seeker', () => {
  useRole('jobseeker');

  test('AO-4: job seeker: warning at 11 minutes, Yes keeps the session', async ({
    page,
    logoutRequests,
  }) => {
    await warningThenYes(page, logoutRequests, '/user', async (p) => {
      await expect(p.locator('main, [role="main"]').first()).toBeVisible();
    });
  });
});
