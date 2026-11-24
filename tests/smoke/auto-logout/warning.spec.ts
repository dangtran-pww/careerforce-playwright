import { test, expect, warningThenYes } from '../../helpers/autologout';
import { useRole } from '../../helpers/roles';

// [Smoke] - Auto Logout - Test Plan — AO-4. See
// test-suites/smoke/smoke-auto-logout.md. Desktop only. The admin warning
// cases (was AO-3 and AO-5) are ALO-2 and ALO-3 in
// tests/functional/site-wide/auto-logout.spec.ts.
//
// The page is opened with Playwright's clock installed and paused, and its
// clock is moved forward so the warning shows in seconds. Rules that keep
// the shared session alive (see the plan's Good to know):
// - the logout addresses are blocked on every page (tests/helpers/autologout.ts);
// - the clock never goes past 15:05 after the page loaded, well under the
//   real 15 idle minutes the server checks;
// - nothing on the page is touched before the warning shows, and the
//   dialog's "x" is never clicked.

test.describe('job seeker', () => {
  useRole('jobseeker');

  test('AO-4: job seeker: warning at 10 minutes, Yes keeps the session', async ({
    page,
    logoutRequests,
  }) => {
    await warningThenYes(page, logoutRequests, '/user', async (p) => {
      await expect(p.locator('main, [role="main"]').first()).toBeVisible();
    });
  });
});
