import { defineConfig, devices } from '@playwright/test';
import { getBaseURL, getHttpCredentials } from './tests/helpers/playwright-env';

// How to run:
//   npm run auth   # once per machine / when the session expires (manual SSO)
//   BASE_URL=https://qa.careerforce.link npx playwright test
//   BASE_URL=https://qa.careerforce.link npx playwright test --ui
//
// QA/stage sit behind HTTP Basic Auth in front of Drupal; set
// BASIC_AUTH_USER / BASIC_AUTH_PASSWORD (see .env.example) to get past it.
//
// Destructive tests (create/edit/delete) must point at staging, never production.
// Read-only smoke tests are the only ones suitable for a post-deploy prod check.

const httpCredentials = getHttpCredentials();

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
    baseURL: getBaseURL(),
    httpCredentials,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    // Verifies the session saved by `npm run auth`. See tests/auth.setup.ts.
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    // Phase 1 smoke suite (tests/smoke/**): fully anonymous, read-only, and
    // prod-safe. No storageState, no dependency on the login setup project —
    // it must be runnable with none of that auth infra in place.
    // See test-plans/phase1-read-only-smoke-test-plan.md.
    {
      name: 'smoke',
      testDir: './tests/smoke',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      testIgnore: '**/smoke/**',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/editor.json',
      },
    },
  ],
});
