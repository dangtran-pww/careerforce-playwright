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
    // Phase 1 smoke suite (tests/smoke/**): fully anonymous, read-only, and
    // prod-safe. No storageState, no dependency on a login setup project —
    // it must be runnable with none of that auth infra in place.
    // See test-plans/phase1-read-only-smoke-test-plan.md.
    {
      name: 'smoke',
      testDir: './tests/smoke',
      use: { ...devices['Desktop Chrome'] },
    },
    // Logged-in tests reuse a session saved by hand: run `npm run
    // login:manual` once, complete the real login (SSO today) in the
    // browser window that opens, then close it. No `setup` project/
    // dependency here — login isn't automated while auth is SSO. See
    // tests/auth.setup.ts for the old drush-based flow, kept for reference.
    {
      name: 'chromium',
      testIgnore: '**/smoke/**',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/editor.json',
      },
    },
  ],
});
