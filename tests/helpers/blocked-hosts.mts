// The hosts every browser this project opens must not reach. One list,
// shared by:
//   - playwright.config.ts: browser-level block (--host-resolver-rules) for
//     every browser the test runner launches, including tabs opened by hand
//     in --headed / --debug / --ui runs and the MCP agents' browser;
//   - tests/helpers/fixtures.ts: request-level block (context.route) in tests;
//   - scripts/login-manual.mjs and scripts/open-browser.mjs: browsers started
//     outside a test run. (Node runs this .mts file directly.)
//
// Tracking: the site loads Google Analytics, Google Ads conversion tags, and
// LinkedIn Insight through Google Tag Manager, so every visit from these
// browsers would otherwise count as real traffic (and as ad conversions) on
// whichever environment it hits. Blocking the GTM loader stops all of those
// tags; the collectors are also listed in case one is ever loaded outside
// GTM. HP-3 still passes: it reads the GTM container ID from the page HTML,
// which this doesn't touch.
export const TRACKING_DOMAINS = [
  'googletagmanager.com',
  'google-analytics.com',
  'analytics.google.com',
  'doubleclick.net',
  'snap.licdn.com',
  'px.ads.linkedin.com',
];

// Tracking paths on hosts that can't be blocked whole (www.google.com also
// serves the Google sign-in). Only a request-level block (context.route) can
// match these; the browser-level block can't, but blocking GTM covers them.
export const TRACKING_PATHS: Record<string, RegExp> = {
  'www.google.com': /^\/(ccm|rmkt|pagead)\//,
  'www.linkedin.com': /^\/px\//,
};

// The site's custom aws_waf module adds the AWS WAF challenge SDK
// (https://<id>.<region>.sdk.awswaf.com/.../challenge.js) to every page. In a
// Playwright browser its bot check fails and shows a human-verification
// screen, so the SDK and its token calls (all on awswaf.com) are blocked.
//
// This only stops the client-side script. If a WAF rule on the server side
// challenges or blocks a request, blocking the script won't help: the test
// traffic has to be allowed in the WAF itself (e.g. by IP or a secret header).
export const WAF_DOMAINS = ['awswaf.com'];

export const BLOCKED_DOMAINS = [...TRACKING_DOMAINS, ...WAF_DOMAINS];

// Chromium flag value that makes the browser treat every blocked domain (and
// its subdomains) as nonexistent, in every tab and window. Chromium only.
export const hostResolverRules = BLOCKED_DOMAINS.flatMap((domain) => [
  `MAP ${domain} ~NOTFOUND`,
  `MAP *.${domain} ~NOTFOUND`,
]).join(', ');

function onDomain(hostname: string, domains: string[]): boolean {
  return domains.some((d) => hostname === d || hostname.endsWith(`.${d}`));
}

export function isTracking(url: URL): boolean {
  return (
    onDomain(url.hostname, TRACKING_DOMAINS) ||
    (TRACKING_PATHS[url.hostname]?.test(url.pathname) ?? false)
  );
}

export function isWafChallenge(url: URL): boolean {
  return onDomain(url.hostname, WAF_DOMAINS);
}
