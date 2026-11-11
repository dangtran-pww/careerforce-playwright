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
// Destructive tests (create/edit/delete) must point at staging, never production.
// Read-only smoke tests are the only ones suitable for a post-deploy prod check.

const env = currentEnv();
const httpCredentials = credentialsFor(env);

// One project per suite and device, named `<suite>-<device>`, e.g.
// smoke-desktop and smoke-mobile. Each device skips the tests tagged for the
// other (`@desktop-only` / `@mobile-only`, see tests/helpers/devices.mts).
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
    grepInvert: SKIP_TAG[device],
    ...perDevice[device],
    use: { ...DEVICES[device], ...perDevice[device]?.use },
  }));
}

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Start serial on a shared staging database. Parallel tests that share
  // content or users will collide and flake. Enable parallel only once every
  // test creates its own unique content and users.
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
    // Smoke suite: every spec from a test-plans/smoke-*.md, one folder per
    // plan (tests/smoke/<area>/). Read-only and prod-safe. No default login:
    // a spec that needs a role calls `useRole('<role>')`
    // (tests/helpers/roles.ts), which needs
    // `npm run login:manual -- <role> --env <env>` to have been run first.
    // Admin and editor areas run on desktop only (DESKTOP_ONLY_SMOKE_AREAS);
    // on mobile, every test also fails if the page scrolls sideways
    // (`noHorizontalScroll` in tests/helpers/fixtures.ts).
    ...suite('smoke', {
      testDir: './tests/smoke',
      perDevice: {
        mobile: {
          testIgnore: DESKTOP_ONLY_SMOKE_AREAS.map((a) => `**/smoke/${a}/**`),
        },
      },
    }),
    // Functional plans (test-plans/README.md → Functional plans): deeper,
    // read-only checks of one feature, one folder per feature
    // (tests/functional/<feature>/). Prod-safe like smoke, but too many
    // requests for a post-deploy run. Run one feature by its folder:
    // `npx playwright test tests/functional/job-search --project=functional-desktop`.
    ...suite('functional', { testDir: './tests/functional' }),
    // Stage plans (test-plans/README.md → Stage plans): specs that create,
    // edit, delete, or otherwise change site state. QA/stage only — never
    // point this project at production. Desktop only. Login is per spec, as
    // in smoke.
    {
      name: 'stage',
      testDir: './tests/stage',
      use: DEVICES.desktop,
    },
  ],
});
