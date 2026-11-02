---
name: test-plan-report
description: Run every case of one fully implemented test plan in test-plans/ (e.g. smoke-anonymous) and write a Markdown report that explains, case by case, how each test was performed, with a screenshot for each step taken from the Playwright trace. Use when the user asks for a test report, a run report, evidence, or screenshots of how a test plan was tested.
argument-hint: <plan-name> [BASE_URL]
---

# Test plan report with step screenshots

The user names a test plan (for example `smoke-anonymous` or
`test-plans/smoke-admin-reports.md`), and optionally an environment URL.
Arguments: `$ARGUMENTS`

Reports are only for plans whose status is `implemented`. If no plan was
given, list the plans in `test-plans/` whose status is `implemented` and ask
which one to report on. Then stop.

The report is for QA, project managers, and the client, not for developers.
Write it in the same plain language as the plans. Locators, raw errors, and
commands do not go in the report. Give them to the user in your reply
(step 6).

## 1. Read the plan

Read `test-plans/<plan>.md`. Note these parts:

- **Status** and **Implemented test**. If the status is anything other than
  `implemented` (for example `ready to generate`, `partially implemented`,
  or `needs update`), do not run anything or write a report. Tell the user
  the plan's status, that the tests must match the plan before it can be
  reported on, and list the plans that are `implemented`. Then stop.
- The **test cases table**: ID, title, page, steps, and expected result.
  Also read the sub-tables that the cases point to.
- **Running it**: the spec folder and the project (`tests/smoke/…` →
  `smoke`, `tests/stage/…` → `stage`).
- The **persona**, and any Scope warnings.

## 2. Environment, safety, and login

Before you run anything, confirm with the user which environment the run
targets, even when a URL was given in the arguments. Ask with
AskUserQuestion and offer QA (`https://qa.careerforce.link`) first, or the
URL from the arguments when one was given. Do not run until the user has
answered. Use the confirmed URL as `BASE_URL` in step 3 and as the
**Environment** in the report.

Then follow steps 3 and 4 of `.claude/skills/run-test-case/SKILL.md`, applied to
the whole plan:

- Never run a `stage` project against production.
- Warn about long runtimes and side effects, and get confirmation first.
- Make sure the `playwright/.auth/<role>.json` session exists for every role
  that the plan's specs use.

## 3. Run the plan with tracing

Use one output folder per run:
`reports/<plan>-<YYYY-MM-DD-HHmm>/` (local time). Then run:

```bash
OUT=reports/<plan>-<stamp>
mkdir -p "$OUT"
BASE_URL=<target> npx playwright test <spec-folder> --project=<project> \
  --trace on --output "$OUT/test-output" --reporter=json > "$OUT/results.json"
```

- `--trace on` records every action and check, together with a screencast
  of the page. The screenshots in step 4 come from this recording, so the
  specs do not need any change.
- The exit code is non-zero when a test fails. That is still a valid run, so
  carry on to the next step.
- Browser tests need the network. If the sandbox blocks the run (the error
  shows `ERR_INTERNET_DISCONNECTED`), run it outside the sandbox.
- Give the command a timeout long enough for the plan. The plan's "Running
  it" section gives an estimate. For runs longer than a few minutes, run it
  in the background.
- Do not change the specs or `playwright.config.ts` to make the run work.

If `results.json` holds no tests, or begins with an error instead of JSON,
the run itself failed (for example a 401, a missing session, or a bad
`BASE_URL`). Report that failure to the user and stop.

## 4. Extract the steps and screenshots

```bash
node scripts/trace-steps.mjs "$OUT/results.json" "$OUT"
```

This writes `$OUT/steps.json` and `$OUT/screenshots/<NN>-<id>/<SS>.jpeg`.
For each test, `steps.json` holds the `id`, `title`, `spec`, `status`,
`durationMs`, `errors`, and `annotations`, plus a list of `steps`. Each step
has these fields:

- `title`: the Playwright action or check, e.g. `Click locator(…)` or
  `Expect "toBeVisible" getByRole(…)`.
- `kind`: `action`, `check`, or `step` (a `test.step` block, whose inner
  calls are listed in `substeps`).
- `at`: the spec line, e.g. `home.spec.ts:31`.
- `status` and `error`.
- `screenshot`: the browser viewport just after the step. The path is
  relative to `$OUT`.
- `sameAsPrevious`: true when the page did not change during the step, so
  `screenshot` is the same image as the previous step's.

Read each test's spec code and the page objects it uses
(`tests/pages/*.page.ts`). They tell you what each step means in plain
language.

## 5. Write `$OUT/report.md`

Use this shape:

```markdown
# <Plan title> — Test report

**Result:** <N passed, N failed, N skipped> of <N> tests · **Environment:** <BASE_URL>
**Date:** <YYYY-MM-DD HH:mm> · **Duration:** <total> · **Code version:** <git short hash>
**Plan:** [test-plans/<plan>.md](../../test-plans/<plan>.md)

## Summary

| ID | Test | Result | Duration |
| --- | --- | --- | --- |
| [HP-1](#hp-1--homepage-loads) | Homepage loads | ✅ Passed | 2.2 s |
| …   | …    | ❌ Failed / ⏭️ Skipped | … |

## HP-1 — Homepage loads ✅

**What it checks:** <the plan's expected result, in its own words>
**Page:** `/` · **Role:** anonymous · **Spec:** `tests/smoke/anonymous/home.spec.ts:8`

1. **Opened the homepage.**

   ![Homepage after loading](screenshots/01-hp-1/01.jpeg)

2. **Checked the Job Search block:** the heading, the blue gradient
   background, the intro sentence, the keyword and location boxes, the
   distance dropdown, and the Search button. All were present. ✅
3. …
```

End the report after the last test case. Do not add a "Not implemented"
section or a technical appendix. Do not list the trace folders (the
`test-output/` folder names) or the raw step titles anywhere in the report.

Rules for the steps:

- **Follow the test, not the plan.** List only steps that the test actually
  ran, in order. Use the plan's wording for the intent of each step.
- **Merge steps that belong together.** Consecutive checks of one area,
  especially those with `sameAsPrevious: true`, become one numbered step
  with one screenshot. Collapse loops into one step. For example, the
  Interest Profiler's 60 answers become "Answered all 60 questions over 5
  pages, clicking Continue between pages", shown with the last page's
  screenshot. Aim for about 3 to 10 numbered steps per test.
- **Show a screenshot when the page changed.** That means after navigation,
  after a click that opened or submitted something, and after the step that
  proves the expected result. Do not show the same image twice in a row.
- **The screenshot is the viewport only (1280×720), not the full page.** A
  check on content below the fold passes without scrolling, so its image may
  not show that content. Never write a caption that claims the image shows
  something it does not. Look at the images (Read them) for the key steps,
  and at every failure image, before you write their captions. If the
  checked content is out of view, say "checked below the visible area".
- **Data-driven cases** (several tests with one ID, such as SR-1's search
  terms, or LV-1's locations) get one sub-heading per variant, each with
  its own result.
- **Failures:** mark the failed step ❌. Give its screenshot, the expected
  and actual values in plain words, and the likely cause (site bug, data
  change, expired session, or broken locator). Then state that the steps
  after it were not performed. Give the raw error to the user in your
  reply, not in the report.
- **Skipped tests:** give the skip reason from the annotations.
- **Annotations** that the test logged (for example a picked event ID) go
  under the test as "Notes".

Image paths in the report are relative to `report.md`, for example
`screenshots/01-hp-1/01.jpeg`. That keeps the folder portable: zip it, or
open it in VS Code's Markdown preview.

## 6. Tell the user

Reply briefly with:

- The report path, `reports/<plan>-<stamp>/report.md`, as a clickable link.
- The result line, and the ID of each failed test with a one-line cause.
- **Not implemented:** compare the plan's test case IDs with the IDs in
  `steps.json`. List each plan case that has no test that ran, with its
  title and the plan's pending note if there is one. If every case ran,
  say "None".
- **Technical details:** the run command, the raw error of each failed
  test, and the command to replay one trace:
  `npx playwright show-trace <OUT>/test-output/<test-folder>/trace.zip`.
  Keep `<test-folder>` as a placeholder.
