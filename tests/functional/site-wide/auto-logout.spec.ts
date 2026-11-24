import type { Page } from '@playwright/test';

import {
  test,
  expect,
  expectIntendedSettings,
  minutes,
  openWithClock,
  readSettings,
  warningDialog,
  warningThenYes,
} from '../../helpers/autologout';
import { useRole } from '../../helpers/roles';

// spec: test-suites/site-wide/functional-site-wide-auto-logout.md (ALO-1 to
// ALO-3, moved from AO-1, AO-3 and AO-5 in the Auto Logout smoke plan).
// Desktop only.
//
// Every case keeps the shared admin session alive (see the plan's Good to
// know): the logout addresses are blocked on every page
// (tests/helpers/autologout.ts), the warning is reached with Playwright's
// clock, which never goes past 15:05 after the page loaded, nothing on the
// page is touched before the warning shows, and the dialog's "x" is never
// clicked.

const statusReportShows = async (page: Page) => {
  await expect(page.getByRole('heading', { name: 'Status report' })).toBeVisible();
};

test.describe('admin auto logout', { tag: ['@desktop-only'] }, () => {
  useRole('admin');

  test('ALO-1: admin pages carry the 10 + 5 minute settings', async ({
    page,
    logoutRequests,
  }) => {
    await test.step('1. Status report', async () => {
      const { settings } = await readSettings(page, '/admin/reports/status');
      expectIntendedSettings(settings, '/admin/reports/status');
    });

    await test.step('2. Account page', async () => {
      const { settings, pathname } = await readSettings(page, '/user');
      const redirect = expectIntendedSettings(settings, pathname);
      expect(pathname, 'the account page is /user/<ID>').toMatch(/^\/user\/\d+$/);
      expect(redirect.searchParams.get('destination')).toBe(pathname);
    });

    expect(logoutRequests, 'requests to a logout address').toEqual([]);
  });

  test('ALO-2: admin: warning at 10 minutes, Yes keeps the session', async ({
    page,
    logoutRequests,
  }) => {
    await warningThenYes(page, logoutRequests, '/admin/reports/status', statusReportShows);
  });

  test('ALO-3: No, or no answer, asks to log out', async ({
    page,
    context,
    logoutRequests,
  }) => {
    await test.step('1. "No" asks to log out', async () => {
      const dialog = warningDialog(page);
      const clock = await openWithClock(page, '/admin/reports/status');
      await clock.advance(minutes(10, 5));
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

    await test.step('2. No answer for 5 minutes asks to log out', async () => {
      logoutRequests.length = 0;
      const second = await context.newPage();
      const dialog = warningDialog(second);
      const clock = await openWithClock(second, '/admin/reports/status');
      await clock.advance(minutes(10, 5));
      await expect(dialog).toBeVisible();
      expect(logoutRequests, 'no logout while the warning waits').toEqual([]);
      await clock.advance(minutes(5));
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
