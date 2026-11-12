# Test suites

A suite is one run made of several steps, started from the test dashboard
(`npm run dashboard` → **Suites**). The steps run one after another on the
environment picked in the dashboard's header:

1. **Plans:** test plans from `test-plans/`, run with Playwright. A plan's
   prompt cases ([Rule 2](../test-plans/README.md#rule-2-prompt-cases)) run
   after its tests.
2. **Prompts:** checks Claude does by looking at the site in a browser
   (`claude -p` with the Playwright MCP). Each one ends with a verdict: pass,
   fail or unsure, with a summary, findings and screenshots.

`smoke.md` is the smoke suite: every smoke plan, QA and Stage only.
`job-search.md` runs the four functional Job Search plans.
`jobseeker-registration.md`, `resume-builder.md`, `events.md` and
`appointments.md` are placeholders with
no steps yet. Add a suite by adding a `.md`
file here. Each prompt is its own file in `test-plans/prompts/`, shared with
the plans' prompt cases, so several suites and plans can use one. The dashboard reads both the next time the Suites page loads.

## Format

```md
# [Suite] - Smoke

One paragraph saying what the suite is for. The dashboard shows it.

**Order:** 1

## Plans

| Plan | Projects |
|---|---|
| smoke-public-site | smoke-desktop, smoke-mobile |
| smoke-admin-reports | (default) |

## Prompts

| ID | Prompt |
|---|---|
| PR-1 | [main-menu-landing-pages](../test-plans/prompts/main-menu-landing-pages.md) |
| PR-2 | [admin-content-list](../test-plans/prompts/admin-content-list.md) |
```

Any section can be left out. Text between a heading and its table is for
people and is ignored.

- **Order:** where the suite sits on the Suites page, lowest first. Suites
  without it come last, by name. Today: Smoke 1, Job Search 2, Job Seeker
  Registration 3, Events 4, Appointments 5, Resume Builder 6.

### Plans

`Plan` is the plan's file name in `test-plans/` without `.md`. `Projects` is
a comma-separated list of Playwright projects, or `(default)` for the ones
the plan page ticks by default. A plan with no tests yet is listed as "No
tests yet" and skipped.

On Production, a suite run skips its no-prod plans (`Prod: No` in the
plan's header, or every case no-prod) and runs the other plans without
their no-prod cases (a `No` in the plan's Prod column, or tests tagged
`@no-prod`). This holds even before the tests exist, because the dashboard
reads the plans. See
[Keeping tests off Production](../test-plans/README.md#keeping-tests-off-production).

### Prompts

`ID` is the check's ID in this suite. `Prompt` is the prompt file in
`test-plans/prompts/`: a link to it as above, or just its name
(`admin-content-list`). A missing file, or one with a problem (no
`## Prompt` section, a field that can't be read), is listed as a problem and
the check is left out.

A prompt file looks like this:

```md
# Admin content list

**Role:** admin

Notes for people (why the check exists, what it covers). Ignored.

## Prompt

Open /admin/content. Check the content list loads with its filters and at
least one row, and that the admin toolbar shows. Do not edit, save or delete
anything.
```

- The `#` heading is the check's name on the dashboard.
- `Role` is `anonymous` or a role with a saved login (`admin`, `jobseeker`,
  ...).
- `Compare with`, `Viewports` and `Screenshots` are optional. They let a
  check compare the site with another environment, or with its own last run,
  at several sizes. See
  [Rule 2: Prompt cases](../test-plans/README.md#rule-2-prompt-cases).
- Everything under `## Prompt` (up to the next `##` heading) is sent to
  Claude as written, so it can run over several lines and use lists. Write
  it as one check with a clear pass/fail, the way you'd ask a tester: what
  to open, what must be there, and what must not happen.

How a prompt runs (`dashboard/server/runs/prompt.mjs`, shared by suite runs,
plan runs and `npm run prompt`):

- Claude Code runs headless with only the Playwright MCP's browser tools. It
  can't run commands or edit files. It is told to stay read-only (no forms
  that change data, no logout), but a browser that can click can submit a
  form, so word admin prompts carefully.
- The browser blocks tracking like the tests do, gets past the Basic Auth
  gate, and is logged in as the role (`SEED_STORAGE_STATE`, the `seed`
  project in `playwright.config.ts`).
- Screenshots go to the step's `screenshots/` folder and show on the run
  page.
- Each prompt costs Claude usage, shown on the run page. Set
  `PROMPT_MODEL=sonnet` (or `haiku`) in `.env` for a cheaper model. A prompt
  that runs longer than 6 minutes is stopped (`PROMPT_TIMEOUT_MS`), as is one
  that goes past 40 turns (`PROMPT_MAX_TURNS`). A prompt that compares gets
  15 minutes and 100 turns (`PROMPT_COMPARE_TIMEOUT_MS`,
  `PROMPT_COMPARE_MAX_TURNS`).
- `claude` must be installed and logged in on the machine running the
  dashboard.
