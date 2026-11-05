# Test plans

This folder holds written test plans, not runnable tests.

Playwright runs the code in `tests/` (`testDir: './tests'` in
`playwright.config.ts`), so nothing in this folder is executed. These plans
are the human-readable source that test scripts are generated from, and the
record of what is already covered.

## Before you run any plan

Every plan's "Running it" section assumes you've done the steps below. They
apply to all plans, so they live here and not in each plan.

### One-time setup

You only need to do this once per computer. Open a terminal in this project's
folder and run:

```bash
npm install                      # downloads the test tools
npx playwright install chromium  # downloads the browser the tests drive
cp .env.example .env             # creates your local settings file
```

The `.env` file holds the username/password for the "Sign in" pop-up that
protects QA and Stage. It comes pre-filled. If a run fails with a 401 /
"Unauthorized" error, ask the team for the current values.

### Environments

Each plan's run commands start with `BASE_URL=...`, which tells the tests
which website to visit. It has to come first, on the same line as the rest of
the command.

| Environment | `BASE_URL` | What can run there |
|---|---|---|
| QA | `https://qa.careerforce.link` | every plan |
| Stage | `https://stage.careerforce.link` | every plan |
| Production | `https://careerforce.mn.gov` | smoke plans only (read-only) |

Never run a stage plan against Production. Stage plans create and delete
content.

### Logging in (only for plans that say so)

Some plans test pages that need a logged-in user. The plan names the role it
needs, such as `admin` or `jobseeker`. Before running it, log in once by hand:

```bash
npm run login:manual -- admin
```

A Chrome window opens. Log in, then go back to the terminal and press Enter.
The session is saved, so you only repeat this when it expires (the tests will
fail with a storage state / ENOENT error).

### Watching a run

Add `--ui` to the end of any run command to see the browser click through each
check. A window opens. Press the ▶ (play) button to start, then click any test
to replay it step by step.

### Screenshots of every test

By default, screenshots are only saved for tests that fail. To save a
full-page screenshot of every test, passed or failed, put `SCREENSHOT=on` in
front of any run command:

```bash
SCREENSHOT=on BASE_URL=https://qa.careerforce.link npx playwright test tests/smoke/anonymous
```

Then open the report with `npx playwright show-report` and click a test to see
its screenshot under Attachments. The image files are also saved in the
`test-results/` folder. Full-page screenshots make the run slightly slower.

### When something fails

The terminal lists which test failed by its ID (for example, `HP-1`). Match
the ID to the plan's test cases table to see what it checks, then open the
visual report:

```bash
npx playwright show-report
```

The report opens in your browser. For each failed test it shows a screenshot
and a video of what was on screen when it went wrong. Share those with the dev
team.

## Status on every plan

Every plan in this folder must start with a status and, when it exists, a
link to its test script. Do not delete a plan when it is implemented —
update its status instead, so this folder stays a catalogue of both what is
waiting and what is covered.

The status answers one question: does the test file currently match this
plan? If not, what kind of work is needed to make it match again?

- `ready to generate` — no test script exists yet. The plan is ready for
  Claude or a developer to turn into a test script. Adding cases to a plan
  in this status changes nothing — it stays ready to generate.

  ```md
  Status: ready to generate
  Implemented test: —
  ```

- `partially implemented` — some cases in the plan are implemented, and new
  cases have been added that are waiting to be generated. List only the
  pending cases, so the generator generates those and does not regenerate
  the cases that are already done.

  ```md
  Status: partially implemented
  Implemented test: tests/smoke/anonymous/listings.spec.ts
  Pending cases: LV-4, LV-5 — ready to generate
  ```

- `needs update` — cases that are already implemented have changed, so
  their test file no longer matches the plan. List exactly which cases
  changed and what changed, and update the existing test file — do not
  create a duplicate file. If a plan has both new cases and updated cases,
  use this status and separate the two lists in the pending note.

  ```md
  Status: needs update
  Implemented test: tests/smoke/anonymous/home.spec.ts
  Updated cases: HP-1 — homepage headings changed from 8 to 7
  Pending cases: HP-5 — ready to generate
  ```

  Exception: if a change is only wording in the plan — a typo or a
  clearer description, with no change to steps, data, or expected
  results — the test does not need to change, and the status stays
  `implemented`.

- `implemented` — the test script exists, has been verified, and matches
  every case in the plan. List its path so anyone can find the code from
  the plan. After pending cases are generated, or updated cases are
  updated, the status returns to `implemented` (or stays
  `partially implemented` / `needs update` if work still remains).

## Writing a new plan

Use the plain-language case form: one journey per plan, the role, the
starting URL, GIVEN / WHEN / THEN with a visible result, any unique test
data needed, and cleanup. Keep it in plain language — no code is needed
here. See the phase-1 plan below for a worked example.

## Smoke plans

Smoke tests run after every deploy, including on production. A smoke run
means every case in every `smoke-*.md`, and one command runs them
all:

```bash
npm run test:smoke                              # all smoke plans
npx playwright test tests/smoke/admin-reports   # one plan
npx playwright test --project=smoke-mobile      # smoke-anonymous on a phone
```

The mobile run is separate. `npm run test:smoke` is desktop only. See
[smoke-anonymous.md → Mobile](smoke-anonymous.md#mobile).

Conventions:

- **Naming:** `test-plans/smoke-<area>.md` ↔ `tests/smoke/<area>/`.
  Every spec from a smoke plan lives under `tests/smoke/`, and nothing else
  does. The `smoke` Playwright project runs that folder.
- **Read-only and prod-safe:** no creating, editing, or deleting. Tests that
  write data belong outside `tests/smoke/`.
- **Login is per spec, not per project:** a plan that needs a logged-in role
  sets `test.use({ storageState: 'playwright/.auth/<role>.json' })` on each
  `describe` block. Run `npm run login:manual -- <role>` first.

Adding a new smoke plan:

1. Write `test-plans/smoke-<area>.md` with `Status: ready to generate`.
2. Generate its specs into `tests/smoke/<area>/`, with
   `tests/seed.spec.ts` as the seed.
3. Update the status and the list below. No config change is needed.

## Stage plans

Stage plans are Phase 2 of `docs/deed-smoke-test-plan.md`: interactive
flows that create, edit, or delete data. They need no test inbox and no
LoginMN.

```bash
npx playwright test --project=stage                # all stage plans
npx playwright test tests/stage/content-lifecycle  # one plan
```

Conventions:

- **Naming:** `test-plans/smoke-<area>.md` ↔ `tests/stage/<area>/`.
  A `stage` Playwright project runs that folder.
- **Clean up in `finally`:** every test deletes or reverts what it created,
  even when an assertion fails. Created content is titled
  `Playwright test <timestamp>`.
- **Serial:** tests share accounts (especially the job seeker), so keep
  `workers: 1`.
- **Synthetic data only:** fixture files live in `tests/fixtures/`; no real
  names, contact details, DOBs, or SSNs.
- **Login is per spec:** same as smoke — `test.use({ storageState })` with
  the `jobseeker`, `content-manager`, or `admin` session from
  `npm run login:manual -- <role>`.

The `stage` project was added with the first
stage spec (`tests/stage/admin-maintenance/`). `tests/fixtures/` is
added with the first stage spec that needs fixture files.

## Functional plans

Deeper checks of one feature, as an anonymous visitor: more cases and more
searches than a smoke test. They are read-only and prod-safe, but they make
too many requests for the post-deploy smoke run.

```bash
npx playwright test --project=job-search          # Job Search functional plans
npx playwright test tests/functional/job-search   # one feature
```

Conventions:

- **Naming:** one plan per feature, `test-plans/<area>.md` ↔
  `tests/functional/<area>/`, e.g. `job-search.md` ↔
  `tests/functional/job-search/`. Each part of the feature is its own spec
  file in that folder, e.g. `search.spec.ts`.
- **Tags and projects:** wrap every functional suite in a `test.describe` tagged
  with its feature, e.g. `{ tag: '@job-search' }`. Each feature has its own
  Playwright project (e.g. `job-search`) that runs only that tag.
- **Known bugs are `test.fail`.** A case that checks a known bug is marked as
  expected to fail, with the bug in a comment, so the run stays green. Once the
  bug is fixed, the run reports "expected to fail, but passed".

## Accessibility plan

`accessibility-public.md` ↔ `tests/accessibility/`, run by the `accessibility`
(desktop) and `accessibility-mobile` (phone) Playwright projects. It scans
the public pages with axe-core against WCAG 2.2 AA. It is read-only and
prod-safe like a smoke plan, but it isn't part of the smoke run:

```bash
npm run test:a11y      # desktop and phone
npm run a11y:summary   # reports/a11y-<stamp>/summary.md from the last run
```

## Plans

- `accessibility-public.md` — Status: implemented.
  Implemented test: `tests/accessibility/a11y.spec.ts`.
  axe-core WCAG 2.2 AA scans of the public pages, desktop and phone, with
  a summary report. Every violation fails its test (no allowlist).

- `job-search.md` — Status: implemented.
  Implemented test: `tests/functional/job-search/search.spec.ts`.
  Job Search part 1, search: form, keyword and location, location formats,
  distance, empty and occupation searches, bad input, location suggestions.
  3 known bugs are marked `test.fail`.

- `smoke-anonymous.md` — Status: implemented.
  Implemented tests: `tests/smoke/anonymous/*.spec.ts`.
- `smoke-admin-reports.md` — Status: implemented.
  Implemented test: `tests/smoke/admin-reports/admin-reports.spec.ts`.
- `smoke-admin-maintenance.md` — Status: partially implemented (AM-1,
  AM-2 not yet verified). Implemented tests:
  `tests/stage/admin-maintenance/*.spec.ts`.
  Permissions rebuild, search-api rebuild tracking and reindex, and
  search checks (site, events, appointments, similar events, occupations).
- `smoke-content-lifecycle.md` — Status: ready to generate.
  Publish/unpublish, revisions, translation.
- `smoke-ckeditor.md` — Status: ready to generate.
- `smoke-media.md` — Status: ready to generate.
- `smoke-block-placement.md` — Status: ready to generate.
- `smoke-job-search.md` — Status: ready to generate.
  Filters, saved searches, dashboard management.
- `smoke-jobseeker-tools.md` — Status: ready to generate.
  Skills Matcher / Interest Profiler / Employment Readiness as a job seeker.
- `smoke-resume-builder.md` — Status: ready to generate.
- `smoke-profile.md` — Status: ready to generate.
  Job seeker and admin profile edits.
