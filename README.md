# CareerForce Playwright 

A small, working starter for end-to-end tests on CareerForce site.

## What is inside

```
playwright.config.ts        # one project per suite and device (smoke-desktop, smoke-mobile, ...)
eslint.config.mjs           # minimal linting: Playwright rules + TypeScript
.prettierrc.json            # formatting (single quotes, trailing commas)
scripts/
  login-manual.mjs          # `npm run login:manual` — opens Playwright's Chromium, un-automated,
                             # for by-hand SSO login, then attaches over CDP to save
                             # storageState (Google blocks sign-in in an automated browser)
  open-browser.mjs          # `npm run browser [-- <role> [path]]` — Playwright's Chromium on the
                             # site for manual checks, tracking blocked in every tab
  trace-steps.mjs           # per-step screenshots from a traced run (/test-plan-report)
  confluence-report.mjs     # uploads a report and its screenshots to Confluence
                             # (/publish-report-confluence)
  lib/site.mjs              # environments and logins, shared by the scripts and the dashboard
dashboard/                  # `npm run dashboard` — local test dashboard (see "Test dashboard")
  server/                   #   Node server and JSON API (Hono): index.mjs starts it,
                             #   app.mjs mounts routes/; catalog/ reads plans and suites,
                             #   runs/ runs them, claude/ asks Claude Code
  src/                      #   React app (Vite + TypeScript); dist/ is its build (gitignored)
.claude/skills/             # Claude Code skills: run-test-case, test-plan-report,
                             # publish-report-confluence (see "Test reports and Confluence")
reports/                    # generated test reports (gitignored)
tests/
  pages/                    # Page objects for the CareerForce smoke suite below
  smoke/                    # Post-deploy smoke suite: read-only, prod-safe.
    anonymous/              #   one folder per test-plans/smoke-<area>.md
    admin-reports/          #   (see test-plans/README.md, "Smoke plans")
  functional/               # deeper read-only checks of one feature, one folder per
    job-search/             #   feature (see test-plans/README.md, "Functional plans")
  helpers/environments.mts  # QA / Stage / Production / Sandbox, and where each
                             # environment's logins are saved
  helpers/devices.mts       # the devices (desktop, mobile) and desktop-only smoke areas
  helpers/roles.ts          # useRole('<role>'): log a spec in and check the session
test-plans/                 # human-readable plans that specs are generated from
test-suites/                # suites for the dashboard: plans + Claude prompts
                             # in one run (see test-suites/README.md)
```

## Quick start

```bash
npm install
npx playwright install chromium

# Smoke suite — every smoke test plan, read-only and prod-safe:
cp .env.example .env   # fill in BASIC_AUTH_USER/PASSWORD for QA's Basic Auth gate
npm run login:manual -- admin   # once per session expiry; admin-reports needs it
                                # (logs in to BASE_URL's environment; add --env stage for Stage)
npm run test:smoke                               # desktop and phone
npx playwright test --project=smoke-desktop      # desktop only

# Logged-in tests: log in by hand once per role (auth is SSO, so this step
# can't be automated — and Google blocks sign-in from Playwright's own
# automated Chromium). This saves the session for later use.
npm run login:manual -- admin   # opens a plain Chromium window — log in; it saves the session itself, then close the window

# Best way to watch and debug a test:
BASE_URL=https://qa.careerforce.link npx playwright test --ui
```

## Testing with more than one role

Different test cases need to be logged in as different roles — each is its
own SSO account, so each gets its own saved session and its own Chromium
profile. CareerForce's roles:

- `partner` (the default)
- `jobseeker`
- `platform-manager`
- `event-manager`
- `content-manager`
- `admin`

```bash
npm run login:manual              # default role (partner), on BASE_URL's environment
npm run login:manual -- admin
npm run login:manual -- admin --env stage   # qa | stage | prod | sandbox | local
```

Cookies belong to one site, so each environment has its own logins:
`playwright/.auth/<env>/<role>.json`, e.g. `playwright/.auth/qa/admin.json`
and `playwright/.auth/stage/admin.json`. Tests pick the file for the
environment `BASE_URL` points at. (Logins saved before this change were at
`playwright/.auth/<role>.json`; move them into the folder of the environment
they were saved for, e.g. `mkdir -p playwright/.auth/qa && mv
playwright/.auth/admin.json playwright/.auth/qa/`.) To look around the site by
hand as a saved role, run `npm run browser -- admin` (or `npm run browser` for
a logged-out window); add `--env stage` for another environment.

Every browser this project opens blocks the site's tracking (GTM, Google
Analytics/Ads, LinkedIn Insight) and the AWS WAF challenge script, in every
tab, so manual and test visits stay out of the analytics. The list lives in
`tests/helpers/blocked-hosts.mts`; add a host there and the test runner, the
fixtures, `login:manual` and `browser` all pick it up. `npx playwright open`
and `codegen` don't read the config, so they don't block anything: use
`npm run browser` instead. No project sets a default `storageState`. A
spec, or a whole `describe` block, that needs a role calls `useRole`
(tests/helpers/roles.ts). It loads that role's saved login for the current
environment and, before the first test, checks with the site that the session
still works. If it doesn't, the tests fail with the `npm run login:manual`
command to fix it. See `tests/smoke/admin-reports/admin-reports.spec.ts` for
a real example:

```ts
import { useRole } from '../../helpers/roles';

test.describe('admin-only settings', () => {
  useRole('admin');

  test('admin can see the settings page', async ({ page }) => {
    // ...
  });
});
```

See [Playwright's multiple-roles guide](https://playwright.dev/docs/auth#multiple-signed-in-roles)
for more on this pattern.

## Desktop and mobile

Each suite runs once per device. `playwright.config.ts` builds the projects
from the suite list and the devices in `tests/helpers/devices.mts`, and names
them `<suite>-<device>`:

| Project | Tests | Devices |
|---|---|---|
| `smoke-desktop`, `smoke-mobile` | `tests/smoke/` | desktop + Pixel 7 (Chromium) |
| `functional-desktop`, `functional-mobile` | `tests/functional/` | desktop + Pixel 7 |
| `stage` | `tests/stage/` | desktop only |

- **Whole areas on desktop only:** admin and editor smoke areas
  (`DESKTOP_ONLY_SMOKE_AREAS` in `tests/helpers/devices.mts`: admin-reports,
  admin-maintenance, block-placement, ckeditor, content-lifecycle, media).
  `smoke-mobile` skips their folders. A new area runs on both devices unless
  you add it to that list.
- **Single tests:** tag a test `@desktop-only` or `@mobile-only` to keep it
  off the other device.
- **Layout check:** on mobile, every test also fails if the page it ends on
  scrolls sideways (`noHorizontalScroll` in `tests/helpers/fixtures.ts`).
- **Page objects:** one per page, for both devices. Where the markup differs
  (the header menu, filter drawers), branch on `isMobile` inside the page
  object.
- **Adding a device:** add it to `DEVICES` in `tests/helpers/devices.mts` and
  to the `devices` of the suites that should run on it in
  `playwright.config.ts`.

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
   `playwright/.auth/<env>/<role>.json` for each role a test needs. The account
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
  by hand into `playwright/.auth/<env>/<role>.json`, which is gitignored.
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

## Test dashboard

```bash
npm run dashboard                 # opens the dashboard in a Playwright Chromium window
npm run dashboard -- --no-open    # server only; open http://localhost:4400 yourself
npm run dashboard:dev             # for working on the dashboard: the page updates
                                  # as you save files in dashboard/src
```

`npm run dashboard` builds the app (a second or two) before it starts.

Closing the dashboard window stops the dashboard (or press Ctrl+C in the
terminal).

A local page for seeing and running the tests:

- **Environment picker** (top right): QA, Stage, Production, Sandbox
  (`https://sandbox.careerforce.link`, or `SANDBOX_URL`), and Local
  (`https://careerforcemn.ddev.site`, or `LOCAL_URL`), which is listed only
  while the DDEV site is running: start it with `ddev start` and reload. Every page and run uses the picked environment; `.env`'s
  `BASE_URL` is only the default. Production shows a red bar. Plans that change
  data can't run on Production. Each run records its environment, and its
  command starts with `BASE_URL=...` so it can be run the same way by hand.
- **Overview:** whether the saved admin session for the picked environment
  (`playwright/.auth/<env>/admin.json`) still logs in. It asks the site, the same way `useRole`
  (`tests/helpers/roles.ts`) does, because Drupal can end a session (autologout after
  inactivity) long before the cookie's expiry date. If the session has
  expired, the page shows the `npm run login:manual -- admin --env <env>`
  command to fix it. Press "Check again" afterwards.
- **Suites:** run several plans and Claude prompts as one run. Suites are
  Markdown files in `test-suites/` (format in `test-suites/README.md`). On a
  suite's page, untick any step and see the logins the chosen steps need. The
  run page shows each step as it goes: a plan's test results, and a prompt's
  verdict, findings and screenshots.
- **Plans:** every plan in `test-plans/`, with its status, cases, the
  roles it logs in as, and its last run. The dashboard reads the status,
  "Implemented test" and "Pending cases" lines and the case tables from each
  plan (`dashboard/server/catalog/plans.mjs`), and asks Playwright (`--list`) which
  projects and tests each plan maps to. A case maps to the tests whose title
  or `describe` starts with its ID. **Reload** asks Playwright again after
  you add or rename tests.
- **Running a plan:** press **Run** on the list to run a plan with its default
  projects, or open the plan to pick projects, tick only some cases (or run
  one case from its row), and show the browser. The page shows the exact
  `npx playwright test` command. Every device project that runs the plan's
  tests is ticked by default (e.g. `smoke-desktop` and `smoke-mobile`). Plans
  whose tests live in `tests/stage/` ask before they run, and are refused
  when `BASE_URL` is production.
- **Runs:** one run at a time (the tests share accounts and a staging
  database). A run's page shows the output live, a **Stop run** button, then
  the passed/failed/flaky/skipped counts, each test's result and error, and
  a link to its Playwright HTML report. Each run keeps its output, JSON and
  HTML reports, and screenshots/videos/traces in
  `reports/dashboard-runs/<id>/` (gitignored). Closing the dashboard stops a
  run in progress.

It uses the Basic Auth values from `.env`, like the tests (and
`BASIC_AUTH_USER_<ENV>` / `BASIC_AUTH_PASSWORD_<ENV>` for one environment), and
only listens on `127.0.0.1`. Set `DASHBOARD_PORT` to use another port. For how
the app is laid out and how to add a page, see the comment at the top of
`dashboard/src/main.tsx`.

## Troubleshooting

- **Screenshots are missing on a Confluence report page:** the page was built
  by hand, not with `/publish-report-confluence` (see "Test reports and
  Confluence"). Publish it again with the skill. Pointing it at the existing
  page updates that page.
- **The Confluence upload fails with `getaddrinfo EAI_AGAIN`:** Node is not
  using the sandbox's network proxy. Run the upload with
  `NODE_USE_ENV_PROXY=1` in front, as the skill does.

- **Logged-in tests fail with a storage state / ENOENT error:** run `npm run
  login:manual -- <role> --env <env>` to (re)create
  `playwright/.auth/<env>/<role>.json` — the session likely never existed yet
  for that environment, or has expired.
- **Google sign-in hangs or refuses to load:** this only happens if a
  Playwright-automated Chromium tries to drive the Google login directly
  (e.g. `playwright codegen`) — Google blocks it as an insecure browser.
  `npm run login:manual` avoids this by opening Playwright's Chromium as a
  plain, non-automated process for the actual login and only attaching
  afterward to read the session.
- **CKEditor step fails:** click the `.ck-editor__editable` area before
  typing; do not try to fill a hidden textarea.
- **A test passes locally but flakes in CI:** look at the trace
  (`npx playwright show-report`), not just the error — it shows exactly
  what was on screen when it failed.
