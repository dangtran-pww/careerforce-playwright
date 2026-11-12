# Test suites

A suite is one run made of several test plans from `test-plans/`, started
from the test dashboard (`npm run dashboard` → **Suites**). The plans run one
after another with Playwright, on the environment picked in the dashboard's
header. A plan's prompt cases
([Rule 2](../test-plans/README.md#rule-2-prompt-cases)) run after its tests.

`smoke.md` is the smoke suite: every smoke plan, QA and Stage only.
`job-search.md` runs the four functional Job Search plans.
`jobseeker-registration.md`, `resume-builder.md`, `events.md` and
`appointments.md` are placeholders with no plans yet. Add a suite by adding a
`.md` file here. The dashboard reads it the next time the Suites page loads.

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
```

Text between a heading and its table is for people and is ignored.

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
