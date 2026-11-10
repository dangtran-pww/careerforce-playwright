// Opens Playwright's Chromium on the site for poking around by hand, with
// tracking and the AWS WAF challenge blocked (tests/helpers/blocked-hosts.mts)
// in every tab and window, like the test runs. Use this instead of
// `npx playwright open` / `codegen`, which don't read playwright.config.ts
// and so don't block anything.
//
// Run: npm run browser                 (logged out)
//      npm run browser -- admin        (with playwright/.auth/<env>/admin.json)
//      npm run browser -- admin /admin/reports
//      npm run browser -- admin --env stage
// The environment defaults to the one BASE_URL points at.
//
// This is an automated browser (navigator.webdriver = true), so Google's SSO
// sign-in won't work in it. To log in, use `npm run login:manual -- <role>`,
// then open this with that role.
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import {
  authFile,
  credentialsFor,
  defaultEnv,
  environmentById,
  loginCommand,
} from './lib/site.mjs';
import {
  hostResolverRules,
  isTracking,
  isWafChallenge,
} from '../tests/helpers/blocked-hosts.mts';

const args = process.argv.slice(2);
const envFlag = args.indexOf('--env');
const envId = envFlag >= 0 ? args.splice(envFlag, 2)[1] : null;
const env = envId ? environmentById(envId) : defaultEnv;
if (!env) {
  console.error(`Unknown environment "${envId}".`);
  process.exit(1);
}
const baseURL = env.baseURL;
const [role, path = '/'] = args;

let storageState;
if (role) {
  if (!/^[a-z0-9_-]+$/i.test(role)) {
    console.error(`Invalid role "${role}": use letters, numbers, "-" or "_".`);
    process.exit(1);
  }
  storageState = authFile(role, env);
  if (!existsSync(storageState)) {
    console.error(
      `No saved session at ${storageState}. Run \`${loginCommand(role, env)}\` first.`,
    );
    process.exit(1);
  }
}

const browser = await chromium.launch({
  headless: false,
  args: [`--host-resolver-rules=${hostResolverRules}`],
});
const context = await browser.newContext({
  baseURL,
  httpCredentials: credentialsFor(env),
  storageState,
  viewport: null,
});
// The browser-level block can't match paths; this adds the tracking paths on
// www.google.com and www.linkedin.com, for every tab in this window.
await context.route(
  (url) => isTracking(url) || isWafChallenge(url),
  (route) => route.abort(),
);

const page = await context.newPage();
await page.goto(path);
console.log(
  `Browser open on ${new URL(path, baseURL)}${role ? ` as ${role}` : ''}. ` +
    'Tracking is blocked in every tab. Close the window or press Ctrl+C to quit.',
);

process.on('SIGINT', () => browser.close());
await new Promise((resolve) => browser.on('disconnected', resolve));
