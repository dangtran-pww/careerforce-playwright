import { test as base, expect } from '@playwright/test';

// Keeps test runs out of the site's analytics and ad reporting. The site
// loads Google Analytics, Google Ads conversion tags, and LinkedIn Insight
// through Google Tag Manager, so every test visit would otherwise count as
// real traffic (and as ad conversions) on whichever environment it hits.
//
// Blocking the GTM loader stops all of those tags; the collectors are also
// listed in case one is ever loaded outside GTM. HP-3 still passes: it reads
// the GTM container ID from the page HTML, which this doesn't touch.
//
// Every spec imports `test` and `expect` from here, not '@playwright/test'.
const TRACKING_HOSTS = [
  /(^|\.)googletagmanager\.com$/,
  /(^|\.)google-analytics\.com$/,
  /^analytics\.google\.com$/,
  /(^|\.)doubleclick\.net$/,
  /^snap\.licdn\.com$/,
  /^px\.ads\.linkedin\.com$/,
];
const TRACKING_PATHS: Record<string, RegExp> = {
  'www.google.com': /^\/(ccm|rmkt|pagead)\//,
  'www.linkedin.com': /^\/px\//,
};

function isTracking(url: URL): boolean {
  return (
    TRACKING_HOSTS.some((host) => host.test(url.hostname)) ||
    (TRACKING_PATHS[url.hostname]?.test(url.pathname) ?? false)
  );
}

// The site's custom aws_waf module adds the AWS WAF challenge SDK
// (https://<id>.<region>.sdk.awswaf.com/.../challenge.js) to every page. In a
// Playwright browser its bot check fails and shows a human-verification
// screen, so the tests block the SDK and its token calls (all on awswaf.com).
//
// This only stops the client-side script. If a WAF rule on the server side
// challenges or blocks a request, blocking the script won't help: the test
// traffic has to be allowed in the WAF itself (e.g. by IP or a secret header).
function isWafChallenge(url: URL): boolean {
  return /(^|\.)awswaf\.com$/.test(url.hostname);
}

// The widest element sticking out past the right edge of the screen, as a
// short CSS-like description, so a layout failure says what to look at.
function widestOverflow(): string | undefined {
  const viewportWidth = document.documentElement.clientWidth;
  let widest: { el: Element; right: number } | undefined;
  for (const el of Array.from(document.body.querySelectorAll('*'))) {
    const right = el.getBoundingClientRect().right;
    if (right > viewportWidth + 1 && (!widest || right > widest.right)) {
      widest = { el, right };
    }
  }
  if (!widest) return undefined;
  const { el, right } = widest;
  const id = el.id ? `#${el.id}` : '';
  const classes = Array.from(el.classList).map((c) => `.${c}`).join('');
  return `<${el.tagName.toLowerCase()}${id}${classes}> reaches ${Math.round(right)}px`;
}

export const test = base.extend<{
  blockTracking: void;
  blockWafChallenge: void;
  noHorizontalScroll: void;
}>({
  blockTracking: [
    async ({ context }, use) => {
      await context.route(isTracking, (route) => route.abort());
      await use();
    },
    { auto: true },
  ],
  blockWafChallenge: [
    async ({ context }, use) => {
      await context.route(isWafChallenge, (route) => route.abort());
      await use();
    },
    { auto: true },
  ],
  // Mobile layout check: on a phone (the mobile smoke projects), the page a
  // test ends on must fit the screen width, with no sideways scrolling.
  // Skipped when the test has already failed, so it doesn't hide the real
  // error.
  noHorizontalScroll: [
    async ({ page, isMobile }, use, testInfo) => {
      await use();
      if (!isMobile || testInfo.status !== testInfo.expectedStatus) return;
      const { scrollWidth, viewportWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      }));
      const culprit =
        scrollWidth > viewportWidth ? await page.evaluate(widestOverflow) : '';
      expect(
        scrollWidth,
        `Page scrolls sideways on mobile (${page.url()}): ` +
          `content is ${scrollWidth}px wide on a ${viewportWidth}px screen. ` +
          `Widest element: ${culprit ?? 'unknown'}`,
      ).toBeLessThanOrEqual(viewportWidth);
    },
    { auto: true },
  ],
});

export { expect };
