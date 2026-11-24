import {
  test,
  expect,
  expectIntendedSettings,
  readSettings,
} from '../../helpers/autologout';
import { useRole } from '../../helpers/roles';

// [Smoke] - Auto Logout - Test Plan — AO-2. See
// test-suites/smoke/smoke-auto-logout.md. Desktop only. The admin pages'
// settings (was AO-1) are ALO-1 in tests/functional/site-wide/auto-logout.spec.ts.
//
// Only reads drupalSettings.autologout from the dashboard and leaves it for
// about:blank straight away. The logout addresses are blocked on every page
// (tests/helpers/autologout.ts), so the shared session can't be ended.

test.describe('AO-2: the job seeker dashboard carries the logout settings', () => {
  useRole('jobseeker');

  test('AO-2: the job seeker dashboard carries the logout settings', async ({
    page,
    logoutRequests,
  }) => {
    const { settings, pathname } = await readSettings(page, '/user');
    expectIntendedSettings(settings, pathname);

    expect(logoutRequests, 'requests to a logout address').toEqual([]);
  });
});
