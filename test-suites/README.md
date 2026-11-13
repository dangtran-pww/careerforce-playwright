# Test suites and plans

This folder holds the test suites and their written test plans. Nothing here
is executed: Playwright runs the code in `tests/` (`testDir: './tests'` in
`playwright.config.ts`). The plans are the human-readable source that test
scripts are generated from, and the record of what is already covered.

## Layout

One folder per suite. A suite's folder holds the suite itself, its plans,
and the prompts its plans' prompt cases use:

```
test-suites/
  README.md                 this file
  smoke/
    suite.md                the suite: name, order and its Plans table
    smoke-public-site.md    a test plan
    smoke-admin-reports.md
    ...
    prompts/
      homepage-compare.md   a prompt case's prompt (Rule 2)
  job-search/
    suite.md
    functional-job-search-search.md
    ...
```

- A plan belongs to one suite and lives in its folder. Its file name without
  `.md` is its slug (`smoke-public-site`), which the dashboard, the suite's
  Plans table and run history use. Slugs are unique across all suites.
- A prompt lives in `prompts/` next to the plans that use it.
- `smoke/` is every smoke plan, QA and Stage only. `job-search/` holds the
  four functional Job Search plans. `events/` holds the
  functional Events plans, and `appointments/` the functional Appointments
  plans. `jobseeker-registration/` and `resume-builder/` are placeholders
  with no plans yet.

## Suites

A suite is one run made of the plans in its folder, started from the test
dashboard (`npm run dashboard` → **Suites**). The plans run one after another
with Playwright, on the environment picked in the dashboard's header. A
plan's prompt cases ([Rule 2](#rule-2-prompt-cases)) run after its tests.

Add a suite by adding a folder with a `suite.md`. The dashboard reads it the
next time the Suites page loads.

### suite.md

```md
# [Suite] - Smoke

One paragraph saying what the suite is for. The dashboard shows it.

**Order:** 1

## Plans

| Plan | Projects |
|---|---|
| smoke-public-site | smoke-desktop, smoke-mobile |
| smoke-admin-reports | (default) |
```

Text between a heading and its table is for people and is ignored.

- **Order:** where the suite sits on the Suites page, lowest first. Suites
  without it come last, by name. Today: Smoke 1, Job Search 2, Job Seeker
  Registration 3, Events 4, Appointments 5, Resume Builder 6.
- **Plans:** the plans the suite runs, in order. `Plan` is the slug of a plan
  in the same folder. `Projects` is a comma-separated list of Playwright
  projects, or `(default)` for the plan's default ones (every device project
  that runs its tests). A plan with no tests yet is listed as "No tests yet"
  and skipped. The dashboard reports a plan in the table that isn't in the
  folder, and a plan in the folder that isn't in the table.

On Production, a suite run skips its no-prod plans (`Prod: No` in the
plan's header, or every case no-prod) and runs the other plans without
their no-prod cases (a `No` in the plan's Prod column, or tests tagged
`@no-prod`). This holds even before the tests exist, because the dashboard
reads the plans. See
[Keeping tests off Production](#keeping-tests-off-production).

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
| Production | `https://careerforce.mn.gov` | every plan and case not marked no-prod |

Never run a no-prod plan or case on Production (see
[Keeping tests off Production](#keeping-tests-off-production)).

The test dashboard (`npm run dashboard`) has an environment picker, so you
don't need `BASE_URL` there. It runs a whole suite, or one plan of it (see
[Suites](#suites)).

### Logging in (only for plans that say so)

Some plans test pages that need a logged-in user. The plan names the role it
needs, such as `admin` or `jobseeker`. Before running it, log in once by hand:

```bash
npm run login:manual -- admin
```

A Chromium window opens. Log in; the session is saved as soon as you are
logged in, then close the window. The session is kept, so you only repeat this when it expires (the tests will
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

Every plan must start with a status and, when it exists, a link to its test
script. Do not delete a plan when it is implemented — update its status
instead, so the suite folders stay a catalogue of both what is waiting and
what is covered.

The status answers one question: does the test file currently match this
plan? If not, what kind of work is needed to make it match again?

A [prompt case](#rule-2-prompt-cases) has no test code. It matches the plan
once its prompt file exists, so adding one doesn't change the plan's status.

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

Put the plan in its suite's folder, `test-suites/<suite>/<plan>.md`, and add
it to that suite's Plans table in `suite.md`. The file name is the plan's
slug: it must be unique across all suites.

Use the plain-language case form: one journey per plan, the role, the
starting URL, GIVEN / WHEN / THEN with a visible result, any unique test
data needed, and cleanup. Keep it in plain language — no code is needed
here.

## Plan writing rules

Every plan follows these rules. Each has a number, and
`npm run check:plans` checks the ones a script can check (see
`scripts/check-plans.mjs`). To add a rule, give it the next number here,
add a line for it under "Test plan rules" in `CLAUDE.md`, and add a check to
the script if it can be checked automatically.

| # | Rule | Checked by script |
|---|---|---|
| 1 | [Steps and Expected result cells](#rule-1-steps-and-expected-result-cells) | Yes |
| 2 | [Prompt cases](#rule-2-prompt-cases) | Yes |
| 3 | [Parallel plans and prompts](#rule-3-parallel-plans-and-prompts) | Yes |
| 4 | [Case IDs](#rule-4-case-ids) | Yes |

### Rule 1: Steps and Expected result cells

A table cell holds one line, so lists are written inline, and the dashboard
shows them as numbered lists. [smoke-job-search.md](smoke/smoke-job-search.md) and
[smoke-public-site.md](smoke/smoke-public-site.md) follow this format.

- **Steps:** one action is plain text. Two or more are numbered `1. … 2. …`.
  Put a precondition or rule for every step before `1.` ("Save a search as
  in SS-1 first.", "Don't log in."). End with `**Cleanup:** …` if needed; it
  shows below the list.
- **Expected result:** one check is plain text. Two or more are numbered
  `**1.** … **2.** …`. When the steps are numbered, expected item N is the
  result of step N. When one step has several checks, number the checks
  instead and say which step they follow ("After step 2, …"). Put anything
  that holds for every step, or a link such as "See [Filters](#filters).",
  before `**1.**`.
- **Numbers run 1, 2, 3 with no gaps.** A skipped or repeated number stops
  the cell showing as a list. Merge a step that has nothing to check into the
  next one.

The script reports number gaps, cells with several sentences and no
numbers, and numbered Steps and Expected results whose counts differ.

### Rule 2: Prompt cases

Some checks need judgement, not a fixed assertion: "review the homepage for
layout problems, side by side with Live, on desktop and on a phone". Write
these as a **prompt case**. It has no test code. Claude opens the site in a
browser, follows a prompt, and gives a verdict (pass, fail or unsure) with
findings and screenshots. HP-5 in [smoke-public-site.md](smoke/smoke-public-site.md)
is an example.

- **The case row:** the Steps cell starts with
  `**Prompt:** [<name>](prompts/<name>.md)`, followed by one sentence saying
  what Claude does. The Expected result says what passes and fails, as for any
  case (Rule 1 applies).
- **The prompt file:** `test-suites/<suite>/prompts/<name>.md`, in the
  plan's own suite, so the link `prompts/<name>.md` works from the plan.
  Prompt file names must be unique across all suites.

  ```md
  # Homepage layout compared with the comparison site

  **Role:** anonymous
  **Compare with:** default
  **Viewports:** desktop 1280x800, phone 390x844
  **Screenshots:** 16

  Notes for people (where the check comes from). Ignored.

  ## Prompt

  Review the homepage (/) for layout and styling problems, ...
  ```

  - `Role`: `anonymous`, or a role with a saved login.
  - `Compare with` (optional; default `none`): `default` compares with the
    environment's own comparison sites, all in one check:

    | Site under test | `default` compares with |
    |---|---|
    | Local, QA, Sandbox | Stage and Production |
    | Stage | Production |
    | Production | the **baseline** |

    The baseline is the screenshots of the last run of the same check
    there. Run the check before a deploy and again after it, and the second
    run reports what the deploy changed. A prompt that needs other sites
    overrides the default: write `baseline`, or one or more environment ids
    (`prod`, or `stage, prod`). The site under test is left out of the list,
    so `stage, prod` on Stage compares with Production only, and on
    Production (nothing left) with the baseline. A run can pick other sites
    too: `--compare` on the command line. A check that compares with another
    site must be anonymous, because a saved login only works on its own
    environment.
  - `Viewports` (optional; default `desktop 1280x800`): the sizes to check,
    as `<name> <width>x<height>`.
  - `Screenshots` (optional): the most Claude may take. The default is 6, or
    16 when comparing. When comparing, the number is for one comparison
    site; with more sites the limit (and the time and turn limits) grow to
    match: half as much again for each extra site (16 → 24 for two).
  - `Parallel` (optional; default `no`): `yes` lets the check run at the
    same time as other work. See [Rule 3](#rule-3-parallel-plans-and-prompts).
  - Everything under `## Prompt` is sent to Claude as written. Write it the
    way you'd ask a tester: what to open, what to look at, and what counts as
    a problem. Content that differs between sites (jobs, events, dates) is
    never a difference.
- **Status:** a prompt case counts as implemented once its prompt file
  exists. The test generator skips it.
- **Running it:** the dashboard runs prompt cases after the plan's tests, or
  one on its own with its Run button. From a terminal:

  ```bash
  npm run prompt -- HP-5 --env qa                 # compares QA with Stage and Production
  npm run prompt -- HP-5 --env qa --compare prod  # compares QA with Production only
  npm run prompt -- HP-5 --env prod               # compares with its last run there
  ```

  Results go to `reports/prompt-runs/`. `claude` must be installed and
  logged in. Claude Code runs headless with only the Playwright MCP's
  browser tools, so it can't run commands or edit files. It is told to stay
  read-only (no forms that change data, no logout), but a browser that can
  click can submit a form, so word admin prompts carefully. Each run costs
  Claude usage. Checks run on Sonnet; set `PROMPT_MODEL` in `.env` (e.g.
  `opus`, `haiku`) for another model. A
  check that compares is stopped after 15 minutes
  (`PROMPT_COMPARE_TIMEOUT_MS`) or 100 turns, and other checks after 6
  minutes (`PROMPT_TIMEOUT_MS`) or 40 turns. Comparing with two sites gets
  half as long again (22.5 minutes, 150 turns).
- **Basic Auth:** the browser sends one set of credentials. Comparing QA with
  Stage works when both use `BASIC_AUTH_USER`. If you set different
  credentials per environment (`BASIC_AUTH_USER_STAGE`), the comparison site
  asks for its own and the check comes back unsure.

The script checks that the Steps cell starts with the link, that the prompt
file exists in the plan's suite and has a `## Prompt` section, and that its Role, Compare with,
Viewports, Screenshots and Parallel can be read.

### Rule 3: Parallel plans and prompts

By default everything in a dashboard run happens one thing at a time: one
plan's tests with one Playwright worker, then its prompt cases one by one,
then the next plan. This is because the tests share accounts and a staging
database. A plan or prompt that is safe to run alongside other work can say
so, and then the run goes faster.

- **A plan:** put `Parallel: yes` in the header, under `Implemented test:`.
  The dashboard then runs the plan's tests with several workers
  (`PARALLEL_WORKERS`, default 4), so its spec files, and its desktop and
  mobile projects, run at the same time. The plan's own Parallel prompt
  cases start at the same time as its tests, and Parallel prompt cases
  from earlier plans can still be running too.
- **A prompt file:** put `**Parallel:** yes` with its other fields. The
  check then runs in the background, up to `PROMPT_CONCURRENCY` (default 3)
  at a time, and the run goes on to the next plan while it runs.
- **Anything not marked Parallel runs on its own.** Before it starts, the
  run waits for every background prompt to finish. This means a plan that
  rebuilds permissions, reindexes search or places a block never overlaps a
  check that might see the effect.

Mark a plan or prompt `yes` only when **all** of these are true:

1. It only reads the site. It doesn't create, change or delete anything,
   not even test data that it cleans up afterwards.
2. Nothing it checks would change if another plan's tests ran at the same
   time. For example, a check that counts a job seeker's saved searches
   doesn't qualify, because a test on another device may be saving one.
3. Its spec files don't depend on running in order. Files that are
   numbered to run in plan order need one worker.

A plan without the line, or with `Parallel: no`, runs as before. A prompt
written to add or remove data stays `no`.

The script reports a `Parallel` value that isn't `yes` or `no`, and a
Parallel plan that is `Prod: No` or has a case marked `No` in its Prod
column, because those change data.

### Rule 4: Case IDs

Every case has an ID that no other case in any plan has. The dashboard, the
terminal and the spec titles (`test('SS-1: …')`) all find a case by its ID
alone, so two cases with one ID would mix up their results.

- **Format:** a prefix of 2 to 4 capital letters, `-`, then a number:
  `SS-1`, `SS-2`. Numbers start at 1 with no leading zero.
- **One plan per prefix:** a plan can use several prefixes (one per area,
  e.g. `JS` and `SS` in smoke-job-search), but no prefix is used by two
  plans. Before picking one for a new plan or area, search `test-suites/`
  for it, e.g. `grep -rn "| ML-" test-suites/`.
- **No repeats in a plan:** a new case gets the next number after the
  highest one with that prefix. When a case is removed, its number isn't
  given to a new case.
- **Renaming an ID:** change it everywhere it's used: the plan's other
  rows and notes, and the spec's test title and comments.

The script reports an ID in the wrong format, an ID used twice in a plan,
and a prefix that another plan also uses. It always compares IDs with every
plan, even when you name only one plan to check.

### Checking a plan

```bash
npm run check:plans                                  # every plan
npm run check:plans -- test-suites/smoke/smoke-public-site.md   # one plan
```

Each problem names the plan, line, case and rule number. Checking every
plan also reports two plans, or two prompts, with the same file name.

## Smoke plans

Every plan in `smoke/` (`smoke-*.md`) is a smoke plan: quick checks to run
after each deploy.
Its tests live in `tests/smoke/<area>/`, and the `smoke-desktop` and
`smoke-mobile` Playwright projects run that folder. Most of them also run on Production after a deploy; the plans and cases
that must not are marked no-prod (see
[Keeping tests off Production](#keeping-tests-off-production)).

The Smoke suite (`smoke/suite.md`) lists every smoke plan. On
Production the dashboard runs it without the no-prod plans and cases.
On QA and Stage, `--grep-invert @no-prod` leaves out every test tagged
`@no-prod`:

```bash
npx playwright test --project=smoke-desktop --project=smoke-mobile  # desktop and phone
npx playwright test --project=smoke-desktop --project=smoke-mobile --grep-invert @no-prod  # prod-safe only
npx playwright test tests/smoke/admin-reports   # one plan
npx playwright test --project=smoke-mobile      # phone only
```

Every smoke plan runs on desktop (`smoke-desktop`) and on a phone
(`smoke-mobile`), except the admin and editor areas, which are desktop only
(`DESKTOP_ONLY_SMOKE_AREAS` in `tests/helpers/devices.mts`). See
[smoke-public-site.md → Mobile](smoke/smoke-public-site.md#mobile) and the README's
"Desktop and mobile" section.

Conventions:

- **Naming:** `test-suites/smoke/smoke-<area>.md` ↔ `tests/smoke/<area>/`.
  Every spec from a smoke plan lives under `tests/smoke/`, and nothing else
  does.
- **Prod-safe unless marked:** a smoke test may run on Production unless
  its plan or case is marked no-prod (see below).
- **Login is per spec, not per project:** a plan that needs a logged-in role
  calls `useRole('<role>')` (from `tests/helpers/roles.ts`, which loads
  `playwright/.auth/<env>/<role>.json` and checks the session still works) in
  each spec or `describe` block. Run `npm run login:manual -- <role>` first.
- **Required login column:** when a plan mixes cases that need a login with
  cases that don't, add a **Required login** column to its case tables, just
  before **Prod**. Put the role each case logs in as (the name used with
  `npm run login:manual`, e.g. `jobseeker`, `admin`, `content-manager`).
  Leave the cell empty for a visitor who isn't logged in.

  | ID | Test | … | Required login | Prod |
  |---|---|---|---|---|
  | JS-1 | Job Search loads | … | | Yes |
  | SS-1 | Save a search | … | `jobseeker` | No: saves a search on the job seeker account |
- **Devices:** a new area runs on desktop and phone. If it's an admin or
  editor area, add it to `DESKTOP_ONLY_SMOKE_AREAS` and put
  `Devices: desktop only` in the plan's header.

Adding a new smoke plan:

1. Write `test-suites/smoke/smoke-<area>.md` with `Status: ready to generate`.
2. Generate its specs into `tests/smoke/<area>/`, with
   `tests/seed.spec.ts` as the seed.
3. Add it to the Plans table in `smoke/suite.md`, then update the status
   and the list below. No config change is needed.

### Keeping tests off Production

Whether a test may run on Production is decided per plan or per case, not
by whether it changes data: a case that creates something and cleans it up
can be fine there. Mark it no-prod when it would, for example:

- change something real visitors see and not fully undo it,
- send email or notifications to real people,
- run a heavy site-wide job (reindex, permissions rebuild, cache clear),
- touch real user accounts.

There are two levels:

- **The whole plan:** put `Prod: No: <reason>` under `Implemented test:`,
  e.g. `Prod: No: rebuilds permissions and reindexes the search indexes.`
  Every case of the plan is then no-prod, and every test of the plan is
  tagged `@no-prod`.
- **One case:** add a **Prod** column to the plan's case table, with `Yes`
  or `No: <reason>` in each row, and tag that case's tests `@no-prod`. A
  plan without the column and without a `Prod:` line runs everything on
  Production.

| ID | Test | … | Prod |
|---|---|---|---|
| SS-1 | Save a search | … | No: saves a search on the job seeker account |
| JS-1 | Job Search loads | … | Yes |

Put the tag on the `test` or on its top-level `test.describe`, e.g.
`test.describe('SS-1: …', { tag: '@no-prod' }, () => { … })`. When
`BASE_URL` is Production, `playwright.config.ts` leaves `@no-prod` tests out
of every project, whatever the command. The dashboard also reads the plan,
so it keeps a no-prod plan or case off Production even before its tests
exist or are tagged (it shows "untagged" in red when the plan says No but a
test isn't tagged). A plain `playwright test` only knows the tag, so the
tag is not optional.

On Production the dashboard refuses a no-prod plan, and runs any other plan
without its no-prod cases. A suite run there skips no-prod plans.

```bash
BASE_URL=https://qa.careerforce.link npx playwright test --project=smoke-desktop --grep @no-prod         # only the no-prod tests
BASE_URL=https://careerforce.mn.gov npx playwright test --project=smoke-desktop                       # Production: @no-prod left out
```

Conventions for tests that create, edit or delete data, on any environment:

- **Desktop only by default:** also tag them `@desktop-only`, unless the
  phone is what's being tested. Each phone run would change the data again.
  Admin and editor areas are already desktop only.
- **Clean up in `finally`:** every test deletes or reverts what it created,
  even when an assertion fails. Created content is titled
  `Playwright test <timestamp>`.
- **Serial:** tests share accounts (especially the job seeker), so keep
  `workers: 1`.
- **Synthetic data only:** fixture files live in `tests/fixtures/`; no real
  names, contact details, DOBs, or SSNs.
- **Login is per spec:** same as smoke — `useRole('<role>')` with
  the `jobseeker`, `content-manager`, or `admin` session from
  `npm run login:manual -- <role>`.

`tests/fixtures/` is added with the first data-changing spec that needs
fixture files.

## Functional plans

In-depth tests of one big feature area, such as Job Search, Resume Builder or
Job Seeker Registration: many more cases than its smoke plan. Too long for the
post-deploy run, so they run on their own.

```bash
npx playwright test --project=functional-desktop --project=functional-mobile   # all functional plans
npx playwright test tests/functional/job-search --project=functional-desktop   # one feature, desktop
```

Conventions:

- **Naming:** one suite per feature, `test-suites/<feature>/`, with its plan
  `functional-<feature>.md` ↔ `tests/functional/<feature>/`. Each part of the feature is its own spec
  file in that folder, e.g. `search.spec.ts`, `saved-searches.spec.ts`.
  A feature too big for one plan is split into parts,
  `test-suites/<feature>/functional-<feature>-<part>.md`, all sharing
  `tests/functional/<feature>/`; each part names its own spec files under
  `Implemented test:` so no two parts claim the same tests.
- **Projects:** `functional-desktop` and `functional-mobile` run
  `tests/functional/`.
- **Production:** the same rules as smoke, see
  [Keeping tests off Production](#keeping-tests-off-production): a
  `Prod: No` line or Prod column, the `@no-prod` tag, and cleanup in
  `finally` for tests that write.
- **Tests report bugs.** A case that checks a known bug expects the correct
  behaviour and fails until the bug is fixed; the plan links the ticket. No
  `test.fail`, no known-issue allowlists and no "Known issues" sections.

## Plans

Every plan, by suite folder.

- `smoke/smoke-public-site.md` — Status: implemented.
  Implemented tests: `tests/smoke/anonymous/*.spec.ts`.
- `smoke/smoke-admin-reports.md` — Status: implemented.
  Implemented test: `tests/smoke/admin-reports/admin-reports.spec.ts`.
- `smoke/smoke-admin-maintenance.md` — Status: needs update (AM-2: the
  rebuild-tracking confirm page is `/rebuild-tracker`; AM-1 not yet run).
  Implemented tests:
  `tests/smoke/admin-maintenance/*.spec.ts`. No-prod plan.
  Permissions rebuild, search-api rebuild tracking and reindex, and
  search checks (site, events, appointments, similar events, occupations).
- `smoke/smoke-content-lifecycle.md` — Status: implemented.
  Implemented tests: `tests/smoke/content-lifecycle/*.spec.ts`. No-prod plan.
  Publish/unpublish, revisions, translation.
- `smoke/smoke-ckeditor.md` — Status: implemented.
  Implemented tests: `tests/smoke/ckeditor/*.spec.ts`. No-prod plan.
- `smoke/smoke-media.md` — Status: ready to generate.
- `smoke/smoke-block-placement.md` — Status: implemented.
  Implemented test: `tests/smoke/block-placement/*.spec.ts`. No-prod plan.
- `smoke/smoke-job-search.md` — Status: partially implemented (SS-1 to SS-3 and
  MD-1 to MD-6 generated but not yet verified against a live site). Implemented tests:
  `tests/smoke/job-search/*.spec.ts`. Search and results, filters and sort
  (read-only, in the smoke run), plus saved searches and My Job Search on the
  dashboard as a job seeker (no-prod cases: tagged `@no-prod`, QA and Stage
  only).
- `smoke/smoke-jobseeker-tools.md` — Status: partially implemented.
  Implemented test: `tests/smoke/jobseeker-tools/visitor.spec.ts` (JT-6 to
  JT-8, the visitor checks moved from smoke-public-site). Skills Matcher /
  Interest Profiler / Employment Readiness as a job seeker are pending
  (no-prod cases, QA and Stage only).
- `smoke/smoke-resume-builder.md` — Status: ready to generate.
- `smoke/smoke-profile.md` — Status: ready to generate.
  Job seeker and admin profile edits.
- `smoke/smoke-events.md` — Status: ready to generate. Events, one pass
  each: the 45-day window and event cards as a visitor (prod-safe); an
  admin schedules a short session, a job seeker registers and cancels, and
  attendance creates a service record (no-prod cases, `admin` and
  `jobseeker` logins).
- `smoke/smoke-appointments.md` — Status: ready to generate. Appointments,
  one pass each: the search lists times and nothing past 8 days as a visitor
  (prod-safe); an admin creates a short session at Aitkin, a job seeker books
  and cancels, an admin adds and cancels an attendee, marks one attended
  (service record) and cancels a slot (no-prod cases, `admin` and
  `jobseeker` logins).
- `smoke/smoke-auto-logout.md` — Status: ready to generate. The
  inactivity logout (MNDEED-8448): the 11-minute warning and 15-minute
  logout settings as `admin` and `jobseeker`, the warning via the page
  clock with the logout requests blocked, and the visitor's inactivity
  message (prod-safe). The real 15-minute logout stays manual. Desktop
  only.
- `job-search/functional-job-search-search.md` — Status: implemented.
  Implemented test: `tests/functional/job-search/search.spec.ts`.
  Job Search part 1: keyword, location formats, distance, empty, SOC and
  hostile input, location suggestions. Prod-safe.
- `job-search/functional-job-search-sort-filters-paging.md` — Status: implemented.
  Implemented tests: `tests/functional/job-search/sort-filters.spec.ts`,
  `paging-url-state.spec.ts`. Part 2: sort orders, Company and City filters
  (incl. the company cache check), paging, the address, Back/Forward, deep
  links. Prod-safe.
- `job-search/functional-job-search-posting-accessibility.md` — Status: implemented.
  Implemented tests: `tests/functional/job-search/posting.spec.ts`,
  `responsive.spec.ts`, `accessibility.spec.ts`. Part 3: one job on its own,
  Share, apply link, bad job IDs, the visitor's login dialog, phone width,
  keyboard, names and headings. Prod-safe.
- `job-search/functional-job-search-logged-in.md` — Status: partially implemented
  (every case generated; only PV-5 verified against a live site). Implemented
  tests: `tests/functional/job-search/logged-in/*.spec.ts`. Part 4: a
  logged-in job seeker's bookmarks, saved searches, Jobs for me, career goals
  and region, the log-in hand-off, and privacy. No-prod cases (all but PV-4,
  PV-5), `jobseeker` login.
- `events/functional-events-search-detail.md` — Status: ready to generate.
  Events part 1 of 5: the Events search (keyword, filters, sort, paging,
  the address, bad and hostile values), what the search leaves out,
  external events, the occurrence page, homepage and location page events
  (incl. MNDEED-9620), phone width and accessibility. Prod-safe, visitor
  only.
- `events/functional-events-scheduling.md` — Status: ready to generate.
  Events part 2 of 5: catalog items, the session form and its date widget
  and preview, occurrence generation and the Until date, overrides, Draft /
  Active / Cancelled, the location Event Scheduler, alternate locations,
  private events, deleting and cancelling, and who can schedule. No-prod
  plan, desktop only, `admin` and `jobseeker` logins (other roles' cases
  wait for their logins).
- `appointments/functional-appointments-search.md` — Status: ready to
  generate. Appointments part 1 of 4: the public appointment search (first
  load, the week strip and the 8-day window, weekend dates, the formats,
  location, distance and suggestions, the filters and the day kept
  together, Reset, empty days), what the search hides, bad values in the
  address, where a time leads for a visitor, the links to the search, phone
  width and accessibility. Prod-safe, visitor only.
