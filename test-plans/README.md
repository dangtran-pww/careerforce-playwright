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
| Production | `https://careerforce.mn.gov` | every plan and case not marked no-prod |

Never run a no-prod plan or case on Production (see
[Keeping tests off Production](#keeping-tests-off-production)).

The test dashboard (`npm run dashboard`) has an environment picker, so you
don't need `BASE_URL` there. Several plans can also run together as a suite
(see `test-suites/README.md`).

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

Every plan in this folder must start with a status and, when it exists, a
link to its test script. Do not delete a plan when it is implemented —
update its status instead, so this folder stays a catalogue of both what is
waiting and what is covered.

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

Use the plain-language case form: one journey per plan, the role, the
starting URL, GIVEN / WHEN / THEN with a visible result, any unique test
data needed, and cleanup. Keep it in plain language — no code is needed
here. See the phase-1 plan below for a worked example.

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

### Rule 1: Steps and Expected result cells

A table cell holds one line, so lists are written inline, and the dashboard
shows them as numbered lists. [smoke-job-search.md](smoke-job-search.md) and
[smoke-public-site.md](smoke-public-site.md) follow this format.

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
findings and screenshots. HP-5 in [smoke-public-site.md](smoke-public-site.md)
is an example.

- **The case row:** the Steps cell starts with
  `**Prompt:** [<name>](prompts/<name>.md)`, followed by one sentence saying
  what Claude does. The Expected result says what passes and fails, as for any
  case (Rule 1 applies).
- **The prompt file:** `test-plans/prompts/<name>.md`. Suites can use the
  same file.

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
    environment's own comparison site (QA → Stage, Stage → Production). On
    Production, `default` compares with the **baseline**: the screenshots of
    the last run of the same check there. Run the check before a deploy and
    again after it, and the second run reports what the deploy changed. You
    can also write `baseline` or an environment id (`stage`, `prod`). A run
    can pick another site to compare with: `--compare` on the command
    line. A check that compares with another
    site must be anonymous, because a saved login only works on its own
    environment.
  - `Viewports` (optional; default `desktop 1280x800`): the sizes to check,
    as `<name> <width>x<height>`.
  - `Screenshots` (optional): the most Claude may take. The default is 6, or
    16 when comparing.
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
  npm run prompt -- HP-5 --env qa                 # compares QA with Stage
  npm run prompt -- HP-5 --env qa --compare prod  # compares QA with Production
  npm run prompt -- HP-5 --env prod               # compares with its last run there
  ```

  Results go to `reports/prompt-runs/`. `claude` must be installed and
  logged in. Claude Code runs headless with only the Playwright MCP's
  browser tools, so it can't run commands or edit files. It is told to stay
  read-only (no forms that change data, no logout), but a browser that can
  click can submit a form, so word admin prompts carefully. Each run costs
  Claude usage. Set `PROMPT_MODEL=sonnet` in `.env` for a cheaper model. A
  check that compares is stopped after 15 minutes
  (`PROMPT_COMPARE_TIMEOUT_MS`) or 100 turns, and other checks after 6
  minutes (`PROMPT_TIMEOUT_MS`) or 40 turns.
- **Basic Auth:** the browser sends one set of credentials. Comparing QA with
  Stage works when both use `BASIC_AUTH_USER`. If you set different
  credentials per environment (`BASIC_AUTH_USER_STAGE`), the comparison site
  asks for its own and the check comes back unsure.

The script checks that the Steps cell starts with the link, that the prompt
file exists and has a `## Prompt` section, and that its Role, Compare with,
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

### Checking a plan

```bash
npm run check:plans                                  # every plan
npm run check:plans -- test-plans/smoke-public-site.md   # one plan
```

Each problem names the plan, line, case and rule number.

## Smoke plans

Every `smoke-*.md` is a smoke plan: quick checks to run after each deploy.
Its tests live in `tests/smoke/<area>/`, and the `smoke-desktop` and
`smoke-mobile` Playwright projects run that folder. Most of them also run on Production after a deploy; the plans and cases
that must not are marked no-prod (see
[Keeping tests off Production](#keeping-tests-off-production)).

The Smoke suite (`test-suites/smoke.md`) lists every smoke plan. On
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
[smoke-public-site.md → Mobile](smoke-public-site.md#mobile) and the README's
"Desktop and mobile" section.

Conventions:

- **Naming:** `test-plans/smoke-<area>.md` ↔ `tests/smoke/<area>/`.
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

1. Write `test-plans/smoke-<area>.md` with `Status: ready to generate`.
2. Generate its specs into `tests/smoke/<area>/`, with
   `tests/seed.spec.ts` as the seed.
3. Update the status and the list below. No config change is needed.

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

- **Naming:** one plan per feature, `test-plans/functional-<feature>.md` ↔
  `tests/functional/<feature>/`. Each part of the feature is its own spec
  file in that folder, e.g. `search.spec.ts`, `saved-searches.spec.ts`.
  A feature too big for one plan is split into parts,
  `test-plans/functional-<feature>-<part>.md`, all sharing
  `tests/functional/<feature>/`; each part names its own spec files under
  `Implemented test:` so no two parts claim the same tests.
- **Projects:** `functional-desktop` and `functional-mobile` run
  `tests/functional/`.
- **Production:** the same rules as smoke, see
  [Keeping tests off Production](#keeping-tests-off-production): a
  `Prod: No` line or Prod column, the `@no-prod` tag, and cleanup in
  `finally` for tests that write.
- **Known bugs are `test.fail`.** A case that checks a known bug is marked as
  expected to fail, with the bug in a comment, so the run stays green. Once the
  bug is fixed, the run reports "expected to fail, but passed".

## Plans

- `smoke-public-site.md` — Status: implemented.
  Implemented tests: `tests/smoke/anonymous/*.spec.ts`.
- `smoke-admin-reports.md` — Status: implemented.
  Implemented test: `tests/smoke/admin-reports/admin-reports.spec.ts`.
- `smoke-admin-maintenance.md` — Status: needs update (AM-2: the
  rebuild-tracking confirm page is `/rebuild-tracker`; AM-1 not yet run).
  Implemented tests:
  `tests/smoke/admin-maintenance/*.spec.ts`. No-prod plan.
  Permissions rebuild, search-api rebuild tracking and reindex, and
  search checks (site, events, appointments, similar events, occupations).
- `smoke-content-lifecycle.md` — Status: implemented.
  Implemented tests: `tests/smoke/content-lifecycle/*.spec.ts`. No-prod plan.
  Publish/unpublish, revisions, translation.
- `smoke-ckeditor.md` — Status: implemented.
  Implemented tests: `tests/smoke/ckeditor/*.spec.ts`. No-prod plan.
- `smoke-media.md` — Status: ready to generate.
- `smoke-block-placement.md` — Status: implemented.
  Implemented test: `tests/smoke/block-placement/*.spec.ts`. No-prod plan.
- `smoke-job-search.md` — Status: partially implemented (SS-1 to SS-3 and
  MD-1 to MD-6 generated but not yet verified against a live site). Implemented tests:
  `tests/smoke/job-search/*.spec.ts`. Search and results, filters and sort
  (read-only, in the smoke run), plus saved searches and My Job Search on the
  dashboard as a job seeker (no-prod cases: tagged `@no-prod`, QA and Stage
  only).
- `smoke-jobseeker-tools.md` — Status: ready to generate.
  Skills Matcher / Interest Profiler / Employment Readiness as a job seeker.
- `smoke-resume-builder.md` — Status: ready to generate.
- `smoke-profile.md` — Status: ready to generate.
  Job seeker and admin profile edits.
- `functional-job-search-search.md` — Status: implemented.
  Implemented test: `tests/functional/job-search/search.spec.ts`.
  Job Search part 1: keyword, location formats, distance, empty, SOC and
  hostile input, location suggestions. Prod-safe.
- `functional-job-search-sort-filters-paging.md` — Status: implemented.
  Implemented tests: `tests/functional/job-search/sort-filters.spec.ts`,
  `paging-url-state.spec.ts`. Part 2: sort orders, Company and City filters
  (incl. the company cache check), paging, the address, Back/Forward, deep
  links. Prod-safe.
- `functional-job-search-posting-accessibility.md` — Status: implemented.
  Implemented tests: `tests/functional/job-search/posting.spec.ts`,
  `responsive.spec.ts`, `accessibility.spec.ts`. Part 3: one job on its own,
  Share, apply link, bad job IDs, the visitor's login dialog, phone width,
  keyboard, names and headings. Prod-safe.
- `functional-job-search-logged-in.md` — Status: partially implemented
  (every case generated; only PV-5 verified against a live site). Implemented
  tests: `tests/functional/job-search/logged-in/*.spec.ts`. Part 4: a
  logged-in job seeker's bookmarks, saved searches, Jobs for me, career goals
  and region, the log-in hand-off, and privacy. No-prod cases (all but PV-4,
  PV-5), `jobseeker` login.
