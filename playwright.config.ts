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

// One project per device (`desktop`, `mobile`), each running every suite
// under tests/: the smoke suite in tests/smoke/<area>/ and the functional
// suites in tests/functional/<feature>/. A path picks the suite
// (`npx playwright test tests/smoke`). Each device skips the tests tagged
// for the other (`@desktop-only` / `@mobile-only`, see
// tests/helpers/devices.mts), and on production every project also skips
// `@no-prod` tests. The agents' seed specs are never part of a run.
// The phone also skips the desktop-only smoke areas (admin and editor
// screens, DESKTOP_ONLY_SMOKE_AREAS).
function device(name: DeviceName): Project {
  return {
    name,
    testDir: './tests',
    testIgnore: [
      '**/seed.spec.ts',
      ...(name === 'mobile'
        ? DESKTOP_ONLY_SMOKE_AREAS.map((a) => `**/smoke/${a}/**`)
        : []),
    ],
    grepInvert: env.production
      ? [SKIP_TAG[name], NO_PROD_TAG]
      : SKIP_TAG[name],
    use: DEVICES[name],
  };
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
  // One folder per environment (test-results/qa/, playwright-report/stage/),
  // so terminal runs on two environments at once don't empty or overwrite
  // each other's screenshots, traces and report. Open a report with
  // `npx playwright show-report playwright-report/<env>`. The dashboard
  // passes its own --output and --reporter, which override these.
  outputDir: `test-results/${env.id}`,
  reporter: process.env.CI
    ? 'github'
    : [['html', { outputFolder: `playwright-report/${env.id}` }]],
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
    // checks (dashboard/server/runs/prompt.mjs) set it to a role's login file so
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
    // The device projects. Both run both suites, picked by path:
    // - tests/smoke/<area>/: every spec from a test-suites/smoke/smoke-*.md,
    //   one folder per plan: quick checks to run after each deploy
    //   (`npx playwright test tests/smoke`).
    // - tests/functional/<feature>/: in-depth tests of one big feature area
    //   (test-suites/README.md → Functional plans), e.g. job-search. Too long
    //   for a post-deploy run.
    // No default login: a spec that needs a role calls `useRole('<role>')`
    // (tests/helpers/roles.ts), which needs
    // `npm run login:manual -- <role> --env <env>` to have been run first. On
    // mobile, every test also fails if the page scrolls sideways
    // (`noHorizontalScroll` in tests/helpers/fixtures.ts).
    device('desktop'),
    device('mobile'),
  ],
});
