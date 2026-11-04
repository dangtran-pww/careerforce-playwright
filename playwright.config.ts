import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';

// How to run:
//   BASE_URL=https://qa.careerforce.link npx playwright test
//   BASE_URL=https://qa.careerforce.link npx playwright test --ui
//   SLOW_MO=500 BASE_URL=https://qa.careerforce.link npx playwright test --headed
//   SCREENSHOT=on BASE_URL=https://qa.careerforce.link npx playwright test
//
// QA/stage sit behind HTTP Basic Auth in front of Drupal; set
// BASIC_AUTH_USER / BASIC_AUTH_PASSWORD (see .env.example) to get past it.
//
// Destructive tests (create/edit/delete) must point at staging, never production.
// Read-only smoke tests are the only ones suitable for a post-deploy prod check.

const httpCredentials = process.env.BASIC_AUTH_USER
  ? {
      username: process.env.BASIC_AUTH_USER,
      password: process.env.BASIC_AUTH_PASSWORD ?? '',
    }
  : undefined;

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
    baseURL: process.env.BASE_URL ?? 'https://qa.careerforce.link',
    httpCredentials,
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
    launchOptions: {
      slowMo: Number(process.env.SLOW_MO ?? 0),
    },
  },
  projects: [
    // Seed for the Playwright agents (planner/generator/healer): they run
    // tests/seed.spec.ts to open a browser with this config. Listed first
    // because the agents default to the first project. Not a real test.
    {
      name: 'seed',
      testMatch: 'seed.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    // Post-deploy smoke suite: every spec from a test-plans/smoke-*.md,
    // one folder per plan (tests/smoke/<area>/). Must stay read-only and
    // prod-safe. No default storageState — specs that need a role set it via
    // `test.use({ storageState: 'playwright/.auth/<role>.json' })`, which needs
    // `npm run login:manual -- <role>` to have been run first.
    {
      name: 'smoke',
      testDir: './tests/smoke',
      grepInvert: /@mobile-only/,
      use: { ...devices['Desktop Chrome'] },
    },
    // Mobile smoke: the anonymous smoke plan again on a phone, to check the
    // public pages work and lay out at a small screen size. Tag a test
    // `@desktop-only` to keep it out of this, or `@mobile-only` to keep it
    // out of `smoke`. Every test here also fails if the page scrolls
    // sideways (see `noHorizontalScroll` in tests/helpers/fixtures.ts).
    {
      name: 'smoke-mobile',
      testDir: './tests/smoke/anonymous',
      grepInvert: /@desktop-only/,
      use: { ...devices['Pixel 7'] },
    },
    // Accessibility (test-plans/accessibility-public.md): axe-core WCAG 2.2 AA
    // scans of the public pages, on desktop and again on a phone (mobile
    // layouts have their own contrast, tap target and menu problems).
    // Read-only and prod-safe, but not part of the smoke run: run with
    // `npm run test:a11y`. Same @mobile-only / @desktop-only tags as smoke;
    // the phone run also gets the noHorizontalScroll check.
    {
      name: 'accessibility',
      testDir: './tests/accessibility',
      grepInvert: /@mobile-only/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'accessibility-mobile',
      testDir: './tests/accessibility',
      grepInvert: /@desktop-only/,
      use: { ...devices['Pixel 7'] },
    },
    // Stage plans (test-plans/README.md → Stage plans): specs that create,
    // edit, delete, or otherwise change site state. QA/stage only — never
    // point this project at production. Login is per spec, as in smoke.
    {
      name: 'stage',
      testDir: './tests/stage',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
