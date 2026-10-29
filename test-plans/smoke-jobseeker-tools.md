# [Stage] - Job Seeker Tools - Test Plan

Status: ready to generate
Implemented test: —

Split out from [deed-smoke-test-plan.md](../docs/deed-smoke-test-plan.md)
§11, Phase 2. The [anonymous smoke plan](smoke-anonymous.md)
(CT-1 .. CT-3) already covers these tools for a logged-out visitor; the
source checklist asks for them to be tested "both as anon user and career
seeker". This plan covers the logged-in parts, mainly "add to goals".

## Running it

```bash
npm run login:manual -- jobseeker
BASE_URL=https://qa.careerforce.link npx playwright test tests/stage/jobseeker-tools
```

## Scope

- Adds careers to the job seeker's goals and removes them in
  `finally`.
- Reuses the existing page objects `tests/pages/skills-matcher.page.ts`,
  `interest-profiler.page.ts`, and `employment-readiness.page.ts`.

## Persona / fixtures

- **Job seeker** — `playwright/.auth/jobseeker.json`.

## Test cases

| ID | Title | Persona | Steps | Assertions | Notes |
|---|---|---|---|---|---|
| JT-1 | Skills Matcher: add a matched career to goals | Job seeker | `SkillsMatcherPage`: `goto()`, `answerSkills()`, `submit()`. On the results, click "Add to goals" (or similar) on the first career | Confirmation shown; that career appears in the goals section of the dashboard | Source checklist: "compare skills and add to goals" |
| JT-2 | Remove a career from goals | Job seeker | From the dashboard, remove the career added in JT-1 | It is no longer listed | Same steps as JT-1's cleanup |
| JT-3 | Interest Profiler as a job seeker | Job seeker | `InterestProfilerPage`: `goto()`, `answerAll()`, `submit()` | "Interest Assessment Results" render. If results are saved to the account, they show on the dashboard | Confirm during generation whether results are saved |
| JT-4 | Employment readiness assessment as a job seeker | Job seeker | `goto('/employment-readiness/take')`, answer every question, submit | A results page renders. If results are saved to the account, they show on the dashboard | The anonymous plan only checks the page loads; this completes it |
| JT-5 | Save a career from the careers explorer | Job seeker | `goto('/explore/careers')`, search "Nursing", open a career, click Save / Add to goals | The career appears in the dashboard goals; removed in `finally` | Logged-in half of the §20 flow (the anonymous half needs LoginMN) |

## Non-goals

- The anonymous versions of these tools — already in the smoke suite.
- LoginMN prompt for anonymous "save career" — Phase 3.

## Open questions

1. What exactly is the "add to goals" control and where do goals show on
   the dashboard?
2. Are Interest Profiler and Employment Readiness results stored on the
   account, or only shown once?

## Suggested files

```
tests/
  stage/jobseeker-tools/
    goals.spec.ts         # JT-1, JT-2, JT-5
    assessments.spec.ts   # JT-3, JT-4
  pages/
    dashboard.page.ts     # goals section (shared)
    employment-readiness.page.ts   # extend: answer all + submit
```
