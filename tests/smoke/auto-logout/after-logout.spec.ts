import { test, expect } from '../../helpers/fixtures';
import { statusMessages } from '../../pages/node-form.page';

// [Smoke] - Auto Logout - Test Plan — AO-6. See
// test-suites/smoke/smoke-auto-logout.md. Desktop only.
//
// A visitor (not logged in) gets no autologout timer, and the address a
// logged-out page goes to shows the inactivity message.

const INACTIVITY_MESSAGE = 'You have been logged out due to inactivity.';

test('AO-6: visitors: the inactivity message, and no timer', async ({ page }) => {
  await test.step('1. Login page: no timer, no message', async () => {
    await page.goto('/user/login');
    const settings = await page.evaluate(
      () =>
        (window as unknown as { drupalSettings?: { autologout?: unknown } })
          .drupalSettings?.autologout,
    );
    expect(settings, 'drupalSettings.autologout').toBeUndefined();
    await expect(page.getByText(INACTIVITY_MESSAGE)).toHaveCount(0);
  });

  await test.step('2. After a logout: the inactivity message', async () => {
    await page.goto('/user/login?destination=/user&autologout_timeout=1');
    await expect(statusMessages(page)).toContainText(INACTIVITY_MESSAGE);
    expect(new URL(page.url()).pathname).toBe('/user/login');
  });
});
