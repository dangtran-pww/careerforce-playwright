---
name: run-test-case
description: Run one test case from test-plans/ by its ID (e.g. AM-2, HP-1, SR-1) with the Playwright test runner, guide the user through login if the case needs a saved session, and report the result with an explanation of every step performed. Use when the user asks to run, execute, or check a single test case by ID.
argument-hint: <test-case-id> [BASE_URL]
---

# Run a test case by ID

The user gives a test case ID (for example `AM-2`). Optionally they also give
an environment URL. Arguments: `$ARGUMENTS`

If no ID was given, ask for one and stop.

## 1. Find the plan that defines the case

1. Grep `test-plans/*.md` for the ID as a table row: `^\| <ID> \|`.
   Match it as a whole word, so `AM-1` does not match `AM-10`.
   - No match: say so, list the IDs that look close (same prefix), and stop.
   - Several plans match: show them and ask which one to use.
2. Read the plan. Note these parts:
   - The case row: title, persona, steps, assertions, notes. Also read any
     sub-sections that the row points to (for example "Searches for AM-3"
     or "Appointments search cases").
   - The **Running it** section, which says how to run the plan: login
     command, `BASE_URL`, project, folder, grep examples.
   - The **Persona / fixtures** section, or the persona column, which says
     which role and `playwright/.auth/<role>.json` session the case needs.
   - The **Status** header. If the case is listed as pending or not yet
     verified, tell the user before you run it, because the test may not
     exist yet or may not be trusted.
   - The **Scope** section, for warnings such as "run off-peak", long
     runtimes, or data dependencies.

## 2. Find the test that implements the case

Specs title their tests with the case ID first, for example
`test('AM-2: Occupations', …)` or `test.describe('AM-2: …')`.

1. Get the spec folder from the plan's "Implemented test" line or its
   "Running it" command.
2. Grep that folder for `['"\`]<ID>:` to get every matching `file:line`.
   A data-driven case can produce several tests from one line, or one
   `describe` block that holds several tests. Both are fine.
3. If no test exists, tell the user that the case is not implemented yet
   (the plan status should say so), and stop. Do not generate one unless
   the user asks you to.
4. Read the matching test code and the page objects it uses
   (`tests/pages/*.page.ts`), so you can explain the steps in the report.

## 3. Safety check before running

- The **project** is the folder under `tests/`: `tests/smoke/…` → `smoke`,
  `tests/stage/…` → `stage`.
- `stage` tests change site state, for example a reindex or a permissions
  rebuild. Never run them against production. If the target URL looks like
  production (not `qa.` or `stage.`), refuse and explain why.
- If the plan's Scope warns about side effects or long runtimes (such as an
  index that is empty during a reindex, a run that takes minutes, or
  "run off-peak"), tell the user what will happen and ask them to confirm
  before you run the test.

## 4. Make sure the user is logged in, if the case needs it

Skip this step for anonymous cases, meaning the spec has no `storageState`.

1. Find the role from the spec's
   `test.use({ storageState: 'playwright/.auth/<role>.json' })`.
2. Check whether that file exists.
3. If it is missing, or a later run fails in a way that suggests the session
   has expired (see step 6), stop and guide the user:

   > This case runs as **<role>**. Please run this in your own terminal (it
   > opens a real Chrome window and waits for you to press Enter, so it
   > can't run inside this session):
   >
   > ```bash
   > BASE_URL=<target> npm run login:manual -- <role>
   > ```
   >
   > In the Chrome window, click **"PWW Staff Log In"** and complete the
   > Google sign-in. Once you are back on the site and logged in, return to
   > the terminal and press Enter. That saves `playwright/.auth/<role>.json`.
   > Tell me when it's done.

   Use the same `BASE_URL` for the login as for the test run, because
   sessions do not carry over between environments.
4. Also mention that QA and stage sit behind HTTP Basic Auth. If
   `BASIC_AUTH_USER` and `BASIC_AUTH_PASSWORD` are not in `.env`, pages
   return 401. Do not read or print `.env` values. Only check whether the
   keys exist.

Wait for the user to confirm before you continue.

## 5. Run the test

Before you start the run, show the user the **Run it yourself** block (see
"The 'Run it yourself' section" below), introduced with a line such as
"Running <ID> now. To run it yourself later:". Then start the run in the same
turn; do not wait for a reply unless step 3 or step 4 already asked for one.

Prefer the Playwright test runner tool (`mcp__playwright-test__test_run`):

- `locations`: the `file:line` entries from step 2
- `projects`: the project from step 3

The tool cannot set environment variables or a grep pattern. It uses the
config default `BASE_URL` (QA, `https://qa.careerforce.link`) plus `.env`.
If the user asked for a different environment, run the CLI instead:

```bash
BASE_URL=<target> npx playwright test <spec-folder> --project=<project> --grep "<ID>:" --reporter=list
```

Give long cases a long Bash timeout, or run them in the background (see the
plan's Scope section). Do not change `playwright.config.ts` or the spec to
make the run work.

## 6. Interpret failures

- A redirect to `/user/login`, "Access denied", 403, or a missing admin-only
  element on the first step usually means the session expired. Go back to
  step 4 and ask the user to log in again, then rerun once.
- A 401 on every page means Basic Auth is missing.
- Anything else counts as a real failure. Use the error message, the
  expected and actual values, and the files under `test-results/` (the
  screenshot, video, and `error-context.md`) to explain it. Do not edit the
  test to make it pass. Offer the `playwright-test-healer` agent if the
  failure looks like a broken locator rather than a site bug.

## 7. Report

Write the report in this shape:

```markdown
## <ID> — <title>: PASSED | FAILED | SKIPPED

**Plan:** test-plans/<plan>.md · **Spec:** <file:line> · **Project:** <project>
**Environment:** <BASE_URL> · **Role:** <role or anonymous> · **Duration:** <time>

### Steps performed
1. <What the test did, in plain language, in order — e.g. "Opened
   /admin/config/search/search-api/index/occupations as admin">
2. <"Clicked 'Rebuild tracking information', confirmed, waited for the
   batch to finish (2m 10s)">
3. <What it checked and what it actually saw — e.g. "Checked progress
   reads 0/N with N > 0: saw 0/26471 ✅">
…

For data-driven cases, give one sub-list per variant (index, keyword, filter
case …), each with its own result.

### Result
<Pass: one line. Fail: which step failed, expected vs actual, and the likely
cause (site bug, data dependency, expired session, broken locator). Skipped:
the skip reason the test gave.>

### Notes
<Annotations the test logged (e.g. picked event IDs), warnings from the plan
that apply, and artifacts to look at: test-results/… paths, or
`npx playwright show-report` to open the HTML report.>

### Run it yourself
<The exact command for this case, then the optional variants below.>
```

Build the steps from what the test code actually does, together with the
runner output and the annotations. Use the plan's wording for the intent of
each check. Do not list steps the test did not run. If a step failed, the
steps after it were not performed, and the report must say so.

### The "Run it yourself" section

Show it twice: once before the run starts (step 5), and again at the end of
the report. Include it in the report whether the case passed, failed, or was
skipped, and also when you stopped before running (for example the user
declined a stage run), so the user can run the case from their own terminal
later. Fill in the real values: no placeholders.

```bash
BASE_URL=<target> npx playwright test <spec-folder> --project=<project> --grep "<ID>:"
```

- Use the same `BASE_URL`, spec folder, project, and grep that this run used.
  Keep `BASE_URL=` even when it is the QA default, so the target is explicit.
- Leave out `--reporter=list`; the user's default reporter is fine.
- If the case needs a session, add the login command from step 4 as a
  "first, if your session has expired" line before it.

Then list these variants, each built from the same command:

| To… | Add |
| --- | --- |
| Watch the browser | `--headed` |
| Watch it in slow motion | `--headed`, and put `SLOW_MO=500` (ms per action) before `BASE_URL=`. Write this one out as the full command, e.g. `SLOW_MO=500 BASE_URL=<target> npx playwright test <spec-folder> --project=<project> --grep "<ID>:" --headed` |
| Use the interactive UI mode | `--ui` |
| Open the last HTML report | run `npx playwright show-report` |

Repeat any warning from step 3 that applies (for example that a `stage`
case must never point at production, or that it takes minutes and should run
off-peak).
