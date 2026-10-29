import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';

// How to run:
//   BASE_URL=https://qa.careerforce.link npx playwright test
//   BASE_URL=https://qa.careerforce.link npx playwright test --ui
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
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
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
    // Post-deploy smoke suite: every spec from a test-plans/smoke-*-test-plan.md,
    // one folder per plan (tests/smoke/<area>/). Must stay read-only and
    // prod-safe. No default storageState — specs that need a role set it via
    // `test.use({ storageState: 'playwright/.auth/<role>.json' })`, which needs
    // `npm run login:manual -- <role>` to have been run first.
    {
      name: 'smoke',
      testDir: './tests/smoke',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
