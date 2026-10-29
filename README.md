# CareerForce Drupal Playwright

A small, working starter for end-to-end tests on a Drupal site. It is built
for staging first: log in once (by hand), reuse the session, create test data
through the API, and test the real editor journey through the browser.

## What is inside

```
playwright.config.ts        # setup + smoke + Chromium projects, serial to start
scripts/save-auth.ts        # headed browser: you complete SSO, session is saved
eslint.config.mjs           # minimal linting: Playwright rules + TypeScript
.prettierrc.json            # formatting (single quotes, trailing commas)
tests/
  auth.setup.ts             # verifies saved storageState before editor tests run
  helpers/test-data.ts      # create/delete articles via JSON:API, delete by nid
  smoke.spec.ts             # read-only critical-path checks (safe starting point)
  article.spec.ts           # API-created article is visible in the browser
  editor-create.spec.ts     # editor creates an article through the UI, then cleanup
  pages/                    # Page objects for the CareerForce smoke suite below
  smoke/                    # Phase 1 read-only smoke suite — fully anonymous,
                             # prod-safe, no login required. See
                             # docs/specs/phase1-read-only-smoke-test-plan.md.
```

## Quick start

```bash
npm install
npx playwright install chromium

# Phase 1 smoke suite — fully anonymous, prod-safe, no login required:
cp .env.example .env   # fill in BASIC_AUTH_USER/PASSWORD for QA's Basic Auth gate
npx playwright test --project=smoke

# Editor / destructive tests need a saved session (manual SSO — not automatable):
cp .env.example .env   # if you have not already
npm run auth           # complete SSO in the headed browser; saves playwright/.auth/editor.json

# Point at staging, not production, for the create/delete tests.
BASE_URL=https://qa.careerforce.link npx playwright test

# Best way to watch and debug a test:
BASE_URL=https://qa.careerforce.link npx playwright test --ui
```

`npm run auth` requires a human at the keyboard. It is meant for local (or
manual) use before running editor tests. CI will fail the setup project until
you add a different way to supply `playwright/.auth/editor.json` (for example
a protected secret), or restrict CI to the anonymous smoke project only.

## Linting and typecheck (optional, recommended)

```bash
npm run lint        # ESLint: Playwright rules + TypeScript recommendations
npm run lint:fix    # fix what can be fixed automatically
npm run typecheck   # tsc --noEmit
npm run format      # Prettier (TypeScript and Markdown files)
```

Linting is a review aid, not a test runner: `npx playwright test` still
works even if lint is unhappy. The rules kept on purpose are the ones that
catch flaky-test patterns: no `waitForTimeout`, no `page.pause` left in
committed code, web-first assertions preferred, and no focused/skipped
tests left behind. No heavy style preset is included.

## Before the first run, adapt these 5 things

1. **BASE_URL** — your staging URL. Keep destructive tests on staging only.
2. **Test user** — use a dedicated editor account on staging (via SSO). Do not
   reuse a real person's account. It needs permission to create/publish
   articles and to use JSON:API.
3. **Saved session** — run `npm run auth` when `playwright/.auth/editor.json`
   is missing or tests report an expired session. Re-run after SSO/session
   timeouts.
4. **Content type** — the examples use `node--article` with a `body` field.
   Change the type and fields in `tests/helpers/test-data.ts` and
   `tests/editor-create.spec.ts` to match the real content type you want to
   smoke-test first.
5. **Labels** — if your site's Title field, Save button, or search form uses
   different labels, update the `getByLabel` / `getByRole` calls. Prefer role
   and label locators over CSS classes: Drupal theme classes change often.

## Rules baked into this starter

- **Login once, reuse the session.** Tests do not log in through the UI
  every time. You run `npm run auth` locally to save
  `playwright/.auth/editor.json` (gitignored). `auth.setup.ts` only checks
  that file still works before editor tests run.
- **API for setup, browser for the journey.** Test data is created and
  deleted via JSON:API (with a CSRF token from `/session/token`). The
  browser is used for what you are actually testing: viewing, editing,
  searching, and the editor create flow.
- **Every test cleans up after itself.** Created nodes are deleted in a
  `finally` block, even if an assertion fails, and titles are unique
  (`Playwright test <timestamp>`) so tests do not collide.
- **No sleeps, no `networkidle`.** Drupal's BigPipe and AJAX make both
  flaky. Wait for the specific element you need with a web-first assertion
  such as `await expect(locator).toBeVisible()`.
- **Start serial.** `fullyParallel: false` and one worker protect a shared
  staging database. Turn parallel on only once each test owns its own data.

## Adding the next test (one per sprint feature)

1. Write the manual steps first (Given / When / Then, role, expected result).
2. Copy the closest existing spec, change only the journey.
3. Create its data with `createTestArticle` (or a new helper), clean up in
   `finally`, and assert what a user can see — not database values.
4. Run it green on staging before adding another test. A small trusted
   suite beats a large flaky one.

## Troubleshooting

- **Setup fails with “run npm run auth”:** run `npm run auth`, complete SSO in
  the browser, and confirm `/admin/content` loads as an editor.
- **Setup fails with “session expired”:** run `npm run auth` again.
- **JSON:API 403/404:** the JSON:API module must be enabled on staging and
  the test role must have the matching node permissions.
- **CKEditor step fails:** click the `.ck-editor__editable` area before
  typing; do not try to fill a hidden textarea.
- **A test passes locally but flakes in CI:** look at the trace
  (`npx playwright show-report`), not just the error — it shows exactly
  what was on screen when it failed.
