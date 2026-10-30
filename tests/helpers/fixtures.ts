import { test as base } from '@playwright/test';

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

export const test = base.extend<{ blockTracking: void }>({
  blockTracking: [
    async ({ context }, use) => {
      await context.route(isTracking, (route) => route.abort());
      await use();
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
