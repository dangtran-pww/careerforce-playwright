import {
  test,
  expect,
  expectIntendedSettings,
  readSettings,
} from '../../helpers/autologout';
import { useRole } from '../../helpers/roles';

// [Smoke] - Auto Logout - Test Plan — AO-1 and AO-2. See
// test-suites/smoke/smoke-auto-logout.md. Desktop only.
//
// Only reads drupalSettings.autologout from each page and leaves it for
// about:blank straight away. The logout addresses are blocked on every page
// (tests/helpers/autologout.ts), so the shared sessions can't be ended.

test.describe('AO-1: admin pages carry the 11 + 4 minute settings', () => {
  useRole('admin');

  test('AO-1: admin pages carry the 11 + 4 minute settings', async ({
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
});

test.describe('AO-2: job seeker pages carry the same settings', () => {
  useRole('jobseeker');

  test('AO-2: job seeker pages carry the same settings', async ({
    page,
    logoutRequests,
  }) => {
    await test.step('1. Dashboard', async () => {
      const { settings, pathname } = await readSettings(page, '/user');
      expectIntendedSettings(settings, pathname);
    });

    await test.step('2. Job Search', async () => {
      const { settings } = await readSettings(page, '/job-search');
      expectIntendedSettings(settings, '/job-search');
    });

    expect(logoutRequests, 'requests to a logout address').toEqual([]);
  });
});
