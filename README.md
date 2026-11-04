# CareerForce Drupal Playwright 

A small, working starter for end-to-end tests on a Drupal site. It is built
for staging first: log in once, reuse the session, create test data as
needed, and test real user journeys through the browser.

## What is inside

```
playwright.config.ts        # `smoke` project, serial to start
eslint.config.mjs           # minimal linting: Playwright rules + TypeScript
.prettierrc.json            # formatting (single quotes, trailing commas)
scripts/
  login-manual.mjs          # `npm run login:manual` — launches real Chrome for by-hand SSO
                             # login, then attaches over CDP to save storageState (Google
                             # blocks sign-in from Playwright's own automated Chromium)
  trace-steps.mjs           # per-step screenshots from a traced run (/test-plan-report)
  confluence-report.mjs     # uploads a report and its screenshots to Confluence
                             # (/publish-report-confluence)
.claude/skills/             # Claude Code skills: run-test-case, test-plan-report,
                             # publish-report-confluence (see "Test reports and Confluence")
reports/                    # generated test reports (gitignored)
tests/
  pages/                    # Page objects for the CareerForce smoke suite below
  smoke/                    # Post-deploy smoke suite: read-only, prod-safe.
    anonymous/              #   one folder per test-plans/smoke-<area>.md
    admin-reports/          #   (see test-plans/README.md, "Smoke plans")
  accessibility/            # axe-core WCAG 2.2 AA scans of the public pages
                             # (see "Accessibility"); not part of the smoke run
test-plans/                 # human-readable plans that specs are generated from
```

## Quick start

```bash
npm install
npx playwright install chromium

# Smoke suite — every smoke test plan, read-only and prod-safe:
cp .env.example .env   # fill in BASIC_AUTH_USER/PASSWORD for QA's Basic Auth gate
npm run login:manual -- admin   # once per session expiry; admin-reports needs it
npm run test:smoke
npm run test:smoke:mobile       # smoke-anonymous on an Android phone

# Logged-in tests: log in by hand once per role (auth is SSO, so this step
# can't be automated — and Google blocks sign-in from Playwright's own
# automated Chromium). This saves the session for later use.
npm run login:manual -- admin   # opens a plain Chrome window — log in, then press Enter in the terminal

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
and so on. The `smoke` project doesn't set a default
`storageState`. A test, or a whole `describe` block, that needs a role picks
it with `test.use`. See `tests/smoke/admin-reports/admin-reports.spec.ts`
for a real example:

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

## Before the first run, adapt these 3 things

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
3. **Labels** — if your site's Title field, Save button, or search form uses
   different labels, update the `getByLabel` / `getByRole` calls. Prefer role
   and label locators over CSS classes: Drupal theme classes change often.

## Rules baked into this starter

- **Login once, reuse the session.** Tests do not log in through the UI
  every time. `npm run login:manual -- <role>` captures each role's session
  by hand into `playwright/.auth/<role>.json`, which is gitignored.
- **Create and clean up through the UI (for now).** Tests that need data
  create it and delete it again through Drupal's own forms, in a `finally`
  block — no JSON:API dependency currently. Reintroduce a
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

## Accessibility

`tests/accessibility/` scans the public pages with
[axe-core](https://github.com/dequelabs/axe-core) against WCAG 2.2 A/AA, on
desktop (`accessibility` project) and on a phone (`accessibility-mobile`).
It's read-only and prod-safe but separate from the smoke run. The plan is
[test-plans/accessibility-public.md](test-plans/accessibility-public.md).

```bash
BASE_URL=https://qa.careerforce.link npm run test:a11y   # scan (desktop + phone)
npm run a11y:summary                                      # reports/a11y-<stamp>/summary.md
```

A test fails on any violation. Nothing is allowlisted, so every problem
found is reported, including the ones the site already has. The summary report counts
violations per page and impact, and shows the change since the previous
summary. Automated scans catch roughly a third of WCAG problems, so keyboard
and screen reader checks are still manual.

## Test reports and Confluence

Two Claude Code skills turn a test plan run into a report that QA, project
managers, and the client can read:

1. `/test-plan-report <plan>` runs every case of an `implemented` plan with
   tracing on, and writes `reports/<plan>-<stamp>/report.md`. The report
   explains each step in plain language, with a screenshot of the page after
   it.
2. `/publish-report-confluence <report-dir> <confluence-url>` publishes that
   report as a new Confluence page under the page or space you give. It
   uploads every screenshot and then reads the live page back to confirm that
   each one is shown.

**Always publish with the skill.** Don't paste the report into Confluence or
write the page HTML by hand (or ask Claude to). Confluence silently drops an
image that sits inside a numbered list item. The report puts each screenshot
inside its numbered step, so a hand-made page loses images with no error. The
first smoke-anonymous page lost 13 of its 24 screenshots this way.
`scripts/confluence-report.mjs` ends the list before each image and resumes the
numbering after it. It refuses to build the page if any image is missing or
not uploaded. After publishing, the skill counts the images on the live page.

## Troubleshooting

- **Screenshots are missing on a Confluence report page:** the page was built
  by hand, not with `/publish-report-confluence` (see "Test reports and
  Confluence"). Publish it again with the skill. Pointing it at the existing
  page updates that page.
- **The Confluence upload fails with `getaddrinfo EAI_AGAIN`:** Node is not
  using the sandbox's network proxy. Run the upload with
  `NODE_USE_ENV_PROXY=1` in front, as the skill does.

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
