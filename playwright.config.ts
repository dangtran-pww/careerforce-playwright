import { defineConfig, type Project } from '@playwright/test';
import 'dotenv/config';
import { hostResolverRules } from './tests/helpers/blocked-hosts.mjs';
import {
  DESKTOP_ONLY_SMOKE_AREAS,
  DEVICES,
  SKIP_TAG,
  type DeviceName,
} from './tests/helpers/devices.mjs';
import { credentialsFor, currentEnv } from './tests/helpers/environments.mjs';

// How to run:
//   BASE_URL=https://qa.careerforce.link npx playwright test
//   BASE_URL=https://qa.careerforce.link npx playwright test --ui
//   SLOW_MO=500 BASE_URL=https://qa.careerforce.link npx playwright test --headed
//   SCREENSHOT=on BASE_URL=https://qa.careerforce.link npx playwright test
//
// BASE_URL picks the environment (tests/helpers/environments.mts): QA,
// Stage, Production, Sandbox or Local (DDEV). The dashboard (`npm run dashboard`) sets it
// for you from its environment picker.
//
// QA/stage sit behind HTTP Basic Auth in front of Drupal; set
// BASIC_AUTH_USER / BASIC_AUTH_PASSWORD (see .env.example) to get past it,
// or BASIC_AUTH_USER_<ENV> / BASIC_AUTH_PASSWORD_<ENV> for one environment.
//
// Test cases that must never run on production are tagged `@no-prod` (their
// plan says "No" in the case's Prod column). Whether a case is no-prod is
// decided case by case: a test that changes data can still be fine on
// production. When BASE_URL is production, every project leaves `@no-prod`
// tests out, whatever the command.

const env = currentEnv();
const httpCredentials = credentialsFor(env);
const NO_PROD_TAG = /@no-prod/;

// One project per suite and device, named `<suite>-<device>`, e.g.
// smoke-desktop and smoke-mobile. Each device skips the tests tagged for the
// other (`@desktop-only` / `@mobile-only`, see tests/helpers/devices.mts),
// and on production every project also skips `@no-prod` tests.
// `perDevice` adds settings for one device only.
function suite(
  name: string,
  {
    testDir,
    devices = ['desktop', 'mobile'],
    perDevice = {},
  }: {
    testDir: string;
    devices?: DeviceName[];
    perDevice?: Partial<Record<DeviceName, Project>>;
  },
): Project[] {
  return devices.map((device) => ({
    name: `${name}-${device}`,
    testDir,
    grepInvert: env.production
      ? [SKIP_TAG[device], NO_PROD_TAG]
      : SKIP_TAG[device],
    ...perDevice[device],
    use: { ...DEVICES[device], ...perDevice[device]?.use },
  }));
}

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Serial on a shared staging database: parallel tests that share content
  // or users collide and flake. Plans marked `Parallel: yes` (only read the
  // site, Rule 3 in test-suites/README.md) get `--workers` from the
  // dashboard; from a terminal, pass `--workers 4` yourself for those.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL: env.baseURL,
    httpCredentials,
    // A local DDEV site uses DDEV's own (mkcert) certificate.
    ignoreHTTPSErrors: !!env.local,
    trace: 'on-first-retry',
    // SCREENSHOT=on saves a full-page screenshot at the end of every test,
    // passed or failed. Off (failures only) unless set.
    screenshot:
      process.env.SCREENSHOT === 'on'
        ? { mode: 'on', fullPage: true }
        : 'only-on-failure',
    video: 'retain-on-failure',
    // SLOW_MO=500 pauses that many ms after every action, so a --headed run
    // can be followed by eye. Off (0) unless set.
    // --host-resolver-rules makes the tracking hosts and the AWS WAF
    // challenge SDK unreachable for the whole browser (see
    // tests/helpers/blocked-hosts.mts), so the block also covers tabs opened
    // by hand in --headed / --debug / --ui runs, the MCP agents' browser, and
    // useRole's session check, not only pages a test drives.
    launchOptions: {
      slowMo: Number(process.env.SLOW_MO ?? 0),
      args: [`--host-resolver-rules=${hostResolverRules}`],
    },
  },
  projects: [
    // Seed for the Playwright agents (planner/generator/healer): they run
    // tests/seed.spec.ts to open a browser with this config. Listed first
    // because the agents default to the first project. Not a real test.
    // viewport: null lets the page follow the browser window size, so a
    // headed agent session reflows when the window is resized. Playwright
    // rejects deviceScaleFactor with a null viewport, so it is dropped.
    //
    // SEED_STORAGE_STATE logs the agent's browser in: the dashboard's prompt
    // steps (dashboard/server/runs/suite-run.mjs) set it to a role's login file so
    // Claude can check pages as that role.
    {
      name: 'seed',
      testMatch: 'seed.spec.ts',
      use: (({ deviceScaleFactor: _dsf, ...desktopChrome }) => ({
        ...desktopChrome,
        viewport: null,
        storageState: process.env.SEED_STORAGE_STATE || undefined,
      }))(DEVICES.desktop),
    },
    // Smoke suite: every spec from a test-suites/smoke/smoke-*.md, one folder per
    // plan (tests/smoke/<area>/): quick checks to run after each deploy.
    // Most are prod-safe. The ones that aren't are tagged `@no-prod` and are
    // left out on production (see the top of this file). No default login: a spec that
    // needs a role calls `useRole('<role>')` (tests/helpers/roles.ts), which
    // needs `npm run login:manual -- <role> --env <env>` to have been run
    // first. Admin and editor areas run on desktop only
    // (DESKTOP_ONLY_SMOKE_AREAS); on mobile, every test also fails if the
    // page scrolls sideways (`noHorizontalScroll` in tests/helpers/fixtures.ts).
    ...suite('smoke', {
      testDir: './tests/smoke',
      perDevice: {
        mobile: {
          testIgnore: DESKTOP_ONLY_SMOKE_AREAS.map((a) => `**/smoke/${a}/**`),
        },
      },
    }),
    // Functional suites (test-suites/README.md → Functional plans): in-depth
    // tests of one big feature area, one folder per feature
    // (tests/functional/<feature>/), e.g. job-search, resume-builder,
    // jobseeker-registration. Too long for a post-deploy run. Like smoke,
    // tests that must stay off production are tagged `@no-prod`.
    ...suite('functional', { testDir: './tests/functional' }),
  ],
});
