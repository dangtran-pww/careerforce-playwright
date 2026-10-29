# CareerForce Drupal Playwright 

A small, working starter for end-to-end tests on a Drupal site. It is built
for staging first: log in once, reuse the session, create test data as
needed, and test real user journeys through the browser.

## What is inside

```
playwright.config.ts        # smoke project (anonymous), serial to start
eslint.config.mjs           # minimal linting: Playwright rules + TypeScript
.prettierrc.json            # formatting (single quotes, trailing commas)
scripts/
  login-manual.mjs          # `npm run login:manual` — launches real Chrome for by-hand SSO
                             # login, then attaches over CDP to save storageState (Google
                             # blocks sign-in from Playwright's own automated Chromium)
tests/
  admin.spec.ts             # admin creates/publishes an article through the UI,
                             # cleans up via Drupal's own delete form
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

# Logged-in tests: log in by hand once per role (auth is SSO, so this step
# can't be automated — and Google blocks sign-in from Playwright's own
# automated Chromium). This saves the session for later use.
npm run login:manual -- admin   # opens a plain Chrome window — log in, then press Enter in the terminal

# No project currently runs logged-in tests (tests/admin.spec.ts) — see
# "Testing with more than one role" below for how to wire one up once
# you're ready to use it.

# Best way to watch and debug a test:
BASE_URL=https://qa.careerforce.link npx playwright test --ui
```

## Testing with more than one role

Different test cases need to be logged in as different roles — each is its
own SSO account, so each gets its own saved session and its own Chrome
profile. CareerForce's roles:

- `partner` (the default)
- `jobseeker`
- `platform-manager`
- `event-manager`
- `content-manager`
- `admin`

```bash
npm run login:manual              # default role (partner)
npm run login:manual -- admin
```

This saves `playwright/.auth/partner.json`, `playwright/.auth/admin.json`,
and so on. There's currently no Playwright project wired up to run
logged-in tests against these sessions (see `playwright.config.ts` — only
the anonymous `smoke` project exists today); add one with a default
`storageState` (e.g. `playwright/.auth/partner.json`) when you're ready to
run `tests/admin.spec.ts` or similar. A test (or a whole `describe` block)
that needs a different role than its project's default overrides it with
`test.use` — see `tests/admin.spec.ts` for a real example:

```ts
test.describe('admin-only settings', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('admin can see the settings page', async ({ page }) => {
    // ...
  });
});
```

See [Playwright's multiple-roles guide](https://playwright.dev/docs/auth#multiple-signed-in-roles)
for more on this pattern.

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

## Before the first run, adapt these 4 things

1. **BASE_URL** — your staging URL. Keep destructive tests on staging only.
2. **Logged-in session** — auth is SSO, which Playwright can't drive with
   real credentials, so run `npm run login:manual -- <role>` by hand (see
   "Quick start" and "Testing with more than one role") to produce
   `playwright/.auth/<role>.json` for each role a test needs. The account
   you log in as needs whatever permissions that role's journeys require.
   Sessions aren't automated and aren't committed — they'll need refreshing
   locally whenever they expire, and CI will need its own strategy (a
   service account, a CI-friendly SSO flow, or a session injected as a
   secret) before these tests can run unattended.
3. **Content type** — `tests/admin.spec.ts` uses `node--article` with a
   `body` field. Change the type and fields there to match the real content
   type you want to smoke-test first.
4. **Labels** — if your site's Title field, Save button, or search form uses
   different labels, update the `getByLabel` / `getByRole` calls. Prefer role
   and label locators over CSS classes: Drupal theme classes change often.

## Rules baked into this starter

- **Login once, reuse the session.** Tests do not log in through the UI
  every time. `npm run login:manual -- <role>` captures each role's session
  by hand into `playwright/.auth/<role>.json`, which is gitignored.
- **Create and clean up through the UI (for now).** `admin.spec.ts` creates
  its test article and deletes it again through Drupal's own forms, in a
  `finally` block — no JSON:API dependency currently. Reintroduce a
  JSON:API helper if a role needs faster setup later (see
  `docs/deed-smoke-test-plan.md`).
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
3. Create its data through the UI (or build a JSON:API helper again if a
   role needs faster setup), clean up in `finally`, and assert what a user
   can see — not database values.
4. Run it green on staging before adding another test. A small trusted
   suite beats a large flaky one.

## Troubleshooting

- **Logged-in tests fail with a storage state / ENOENT error:** run `npm run
  login:manual -- <role>` to (re)create `playwright/.auth/<role>.json` — the
  session likely never existed yet or has expired.
- **Google sign-in hangs or refuses to load:** this only happens if a
  Playwright-automated Chromium tries to drive the Google login directly
  (e.g. `playwright codegen`) — Google blocks it as an insecure browser.
  `npm run login:manual` avoids this by opening a real, non-automated Chrome
  for the actual login and only attaching afterward to read the session.
- **CKEditor step fails:** click the `.ck-editor__editable` area before
  typing; do not try to fill a hidden textarea.
- **A test passes locally but flakes in CI:** look at the trace
  (`npx playwright show-report`), not just the error — it shows exactly
  what was on screen when it failed.
