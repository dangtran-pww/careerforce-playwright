import type { Browser, Page, TestInfo } from '@playwright/test';

import { authFile } from './environments.mjs';
import { isTracking, isWafChallenge } from './blocked-hosts.mjs';

// Extra browser contexts for specs that check one thing as two people (an
// admin edits, a visitor looks). They get the project's site and Basic
// Auth, and the same request blocks as the test's own page
// (tests/helpers/fixtures.ts). The caller closes the context.

async function newSitePage(
  browser: Browser,
  testInfo: TestInfo,
  storageState?: string,
): Promise<Page> {
  const { baseURL, httpCredentials, ignoreHTTPSErrors } = testInfo.project.use;
  const context = await browser.newContext({
    baseURL,
    httpCredentials,
    ignoreHTTPSErrors,
    storageState,
  });
  await context.route(isTracking, (route) => route.abort());
  await context.route(isWafChallenge, (route) => route.abort());
  return context.newPage();
}

/** A page in a fresh, logged-out browser context. */
export function visitorPage(
  browser: Browser,
  testInfo: TestInfo,
): Promise<Page> {
  return newSitePage(browser, testInfo);
}

/**
 * A page logged in as `role`, for cleanup in afterAll, where the `page`
 * fixture isn't available.
 */
export function rolePage(
  browser: Browser,
  testInfo: TestInfo,
  role: string,
): Promise<Page> {
  return newSitePage(browser, testInfo, authFile(role));
}
