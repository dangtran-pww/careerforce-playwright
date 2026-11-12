import type { Page, Response } from '@playwright/test';

import {
  test as base,
  expect,
  expectNoHorizontalScroll,
} from '../../helpers/fixtures';

// The checks every Job Search functional plan lists under "Checked in every
// case" (test-suites/job-search/functional-job-search-*.md). Every spec in
// tests/functional/job-search/ imports `test` and `expect` from here, so
// they run after each test without the test asking:
//
//   - No JavaScript error: no uncaught error on any page the test opened
//     (every tab of the test's browser context, not only `page`).
//   - No failed request to the site itself: no 4xx or 5xx answer from the
//     CareerForce host. Other hosts are not checked.
//   - No raw error on the page: no "The website encountered an unexpected
//     error", no PHP or Drupal error message, no stack trace, in any page
//     the site sent.
//
// A case that expects a refusal (a bad job ID, a request without its
// security token) says so with `siteHealth.allowStatus(...)`, and only that
// answer is let through.
//
// The checks are soft and run after the test body, so a site problem is
// reported next to the test's own result instead of hiding it.

// Drupal's error page, and PHP/Drupal error messages as Drupal prints them:
// "Warning: Undefined array key 1 in foo() (line 12 of modules/x.module)."
const RAW_ERRORS: RegExp[] = [
  /The website encountered an unexpected error/i,
  /\b(?:Fatal error|Parse error|Warning|Notice|Deprecated(?: function)?|User (?:error|warning)|TypeError|Error|Exception)\b[^<\n]{0,400}\(line \d+ of [^)]+\)/,
  /\b(?:Fatal error|Parse error|Warning|Notice)\b:[^<\n]{0,400} in \/[^<\n]+\.(?:php|module|inc) on line \d+/,
  /Stack trace:/,
  /Uncaught (?:PHP )?Exception/,
];

export type SiteProblem = { kind: string; detail: string };

export class SiteHealth {
  private readonly siteHost: string;
  private readonly problems: SiteProblem[] = [];
  private readonly pending: Promise<void>[] = [];
  private readonly allowed: Array<(url: URL, status: number) => boolean> = [];

  constructor(baseURL: string) {
    this.siteHost = new URL(baseURL).host;
  }

  // Let a 4xx/5xx answer through for this test only. `path` is matched
  // against the start of the request's path, e.g. '/careerforce/ajax/job-post/add/'.
  allowStatus(path: string | RegExp, statuses: number[] = []) {
    this.allowed.push(
      (url, status) =>
        (typeof path === 'string'
          ? url.pathname.startsWith(path)
          : path.test(url.pathname + url.search)) &&
        (statuses.length === 0 || statuses.includes(status)),
    );
  }

  watch(page: Page) {
    page.on('pageerror', (error) =>
      this.problems.push({
        kind: 'JavaScript error',
        detail: `${error.message} (on ${page.url()})`,
      }),
    );
    page.on('response', (response) => this.onResponse(response));
  }

  private onResponse(response: Response) {
    const url = new URL(response.url());
    if (url.host !== this.siteHost) return;
    const status = response.status();
    if (status >= 400 && !this.allowed.some((allow) => allow(url, status))) {
      this.problems.push({
        kind: 'Failed request',
        detail: `${status} ${response.request().method()} ${url.pathname}${url.search}`,
      });
    }
    const type = response.headers()['content-type'] ?? '';
    const isPage =
      response.request().resourceType() === 'document' ||
      (response.request().resourceType() === 'xhr' && type.includes('html')) ||
      type.includes('json');
    if (!isPage || status === 204 || (status >= 300 && status < 400)) return;
    this.pending.push(
      response
        .text()
        .then((body) => {
          for (const pattern of RAW_ERRORS) {
            const match = body.match(pattern);
            if (match) {
              this.problems.push({
                kind: 'Raw error on the page',
                detail: `${match[0].slice(0, 300)} (in ${url.pathname}${url.search})`,
              });
              return;
            }
          }
        })
        // The page moved on before its body was read; nothing to check.
        .catch(() => undefined),
    );
  }

  async results(): Promise<SiteProblem[]> {
    await Promise.all(this.pending);
    return this.problems;
  }
}

export const test = base.extend<{ siteHealth: SiteHealth }>({
  siteHealth: [
    async ({ context, baseURL, page, isMobile }, use, testInfo) => {
      const health = new SiteHealth(baseURL ?? 'https://qa.careerforce.link');
      for (const open of context.pages()) health.watch(open);
      context.on('page', (opened) => health.watch(opened));
      await use(health);
      // The phone's sideways-scroll check first: the base fixture skips it
      // once a test has failed, and the checks below can fail it.
      if (
        isMobile &&
        !page.isClosed() &&
        testInfo.status === testInfo.expectedStatus
      ) {
        await expectNoHorizontalScroll(page);
      }
      const problems = await health.results();
      // Listed once, so the report shows them even when the test failed.
      if (problems.length > 0) {
        await testInfo.attach('site problems', {
          body: problems.map((p) => `${p.kind}: ${p.detail}`).join('\n'),
          contentType: 'text/plain',
        });
      }
      for (const kind of [
        'JavaScript error',
        'Failed request',
        'Raw error on the page',
      ]) {
        expect
          .soft(
            problems.filter((p) => p.kind === kind).map((p) => p.detail),
            `Checked in every case: ${kind.toLowerCase()}s`,
          )
          .toEqual([]);
      }
    },
    { auto: true },
  ],
});

export { expect };
