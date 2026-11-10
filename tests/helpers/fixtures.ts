import { test as base, expect } from '@playwright/test';

import { isTracking, isWafChallenge } from './blocked-hosts.mjs';

// Keeps test runs out of the site's analytics and ad reporting, and stops the
// AWS WAF challenge script. See ./blocked-hosts.mts for what is blocked and why.
// The browser itself is also told these hosts don't exist (launchOptions in
// playwright.config.ts); this request-level block adds the tracking paths on
// www.google.com and www.linkedin.com, which a host-level block can't match.
//
// Every spec imports `test` and `expect` from here, not '@playwright/test'.

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
