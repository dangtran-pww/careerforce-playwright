import type { Locator, Page } from '@playwright/test';

import { test as base, expect } from './fixtures';

// Helpers for the auto logout smoke plan (test-suites/smoke/smoke-auto-logout.md).
//
// The `admin` and `jobseeker` sessions are shared by every logged-in plan and
// can only be renewed by hand (SSO), so nothing here may end them:
// - `test` below blocks the two logout addresses on every page of the test.
//   The request is aborted before it leaves the browser and recorded in
//   `logoutRequests`. An aborted request has no HTTP status, so the module's
//   script doesn't follow it to the login page either.
// - The warning is reached with Playwright's clock, so hardly any real time
//   passes and the server's own 15-minute check never fires.

/** The addresses the autologout script calls to end the session. */
const LOGOUT_PATHS = ['/autologout_ajax_logout', '/autologout_alt_logout'];

export type LogoutRequest = { method: string; path: string };

/** The settings the autologout module puts in `drupalSettings.autologout`. */
export type AutologoutSettings = {
  timeout: number;
  timeout_padding: number;
  title: string;
  message: string;
  yes_button: string;
  no_button: string;
  no_dialog: boolean;
  disable_buttons: boolean;
  refresh_only: boolean;
  redirect_url: string;
  [key: string]: unknown;
};

/** The intended settings: warning at 11 minutes, logout 4 minutes later. */
export const EXPECTED_SETTINGS = {
  timeout: 11 * 60_000,
  timeout_padding: 4 * 60_000,
  no_dialog: false,
  disable_buttons: false,
  refresh_only: false,
  title: 'CareerForce Alert',
  yes_button: 'Yes',
  no_button: 'No',
};

export const WARNING_TITLE = 'CareerForce Alert';
export const WARNING_MESSAGE =
  'We are about to log you out for inactivity. If we do, you will lose any unsaved work. Do you need more time?';

export const test = base.extend<{ logoutRequests: LogoutRequest[] }>({
  logoutRequests: [
    async ({ context }, use) => {
      const requests: LogoutRequest[] = [];
      const isLogout = (url: URL) => LOGOUT_PATHS.includes(url.pathname);
      await context.route(isLogout, async (route) => {
        const request = route.request();
        requests.push({
          method: request.method(),
          path: new URL(request.url()).pathname,
        });
        await route.abort();
      });
      await use(requests);
    },
    { auto: true },
  ],
});

export { expect };

/**
 * Reads `drupalSettings.autologout` from the page, then leaves it for
 * about:blank so its timer doesn't keep running.
 */
export async function readSettings(
  page: Page,
  path: string,
): Promise<{ settings: AutologoutSettings | undefined; pathname: string }> {
  await page.goto(path);
  const pathname = new URL(page.url()).pathname;
  expect(pathname, `${path} opens (not the login page)`).not.toBe('/user/login');
  const settings = await page.evaluate(
    () =>
      (window as unknown as { drupalSettings?: { autologout?: unknown } })
        .drupalSettings?.autologout as AutologoutSettings | undefined,
  );
  await page.goto('about:blank');
  return { settings, pathname };
}

/** Checks the settings every logged-in page should carry. */
export function expectIntendedSettings(
  settings: AutologoutSettings | undefined,
  where: string,
) {
  expect(settings, `${where} has drupalSettings.autologout`).toBeDefined();
  expect(settings, `autologout settings on ${where}`).toMatchObject(
    EXPECTED_SETTINGS,
  );
  const redirect = new URL(settings!.redirect_url, 'https://example.test');
  expect(redirect.pathname, `redirect_url on ${where}`).toBe('/user/login');
  expect(
    redirect.searchParams.get('autologout_timeout'),
    `redirect_url on ${where} has autologout_timeout=1`,
  ).toBe('1');
  return redirect;
}

/** The warning dialog. */
export function warningDialog(page: Page): Locator {
  return page.getByRole('dialog', { name: WARNING_TITLE });
}

/**
 * Opens `path` with Playwright's clock installed, and pauses the clock right
 * after the page has loaded. Nothing on the page is touched, so the script
 * sees no activity. Returns an `advance` that moves the page's clock forward
 * and then waits for the autologout requests that fired to finish.
 */
export async function openWithClock(page: Page, path: string) {
  await page.clock.install();
  await page.goto(path);
  expect(
    new URL(page.url()).pathname,
    `${path} opens (not the login page)`,
  ).not.toBe('/user/login');
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 1);

  // jQuery counts its requests in flight and lowers the count only after
  // their callbacks ran, so 0 means the script has seen every response
  // (and has shown the dialog, if it was going to).
  async function settle() {
    await expect
      .poll(
        () =>
          page.evaluate(
            () => (window as unknown as { jQuery: { active: number } }).jQuery.active,
          ),
        { message: 'autologout requests finish' },
      )
      .toBe(0);
  }

  return {
    /** Moves the page's clock forward and waits for the requests it caused. */
    async advance(ms: number) {
      await page.clock.runFor(ms);
      await settle();
      // A response can schedule the next step (e.g. the logout after the
      // time-left check), so run the clock a tick and wait once more.
      await page.clock.runFor(1);
      await settle();
    },
    settle,
  };
}

export const minutes = (m: number, s = 0) => (m * 60 + s) * 1000;
