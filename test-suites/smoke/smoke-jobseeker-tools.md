# [Smoke] - Job Seeker Tools - Test Plan

Status: partially implemented
Implemented test: tests/smoke/jobseeker-tools/visitor.spec.ts
Pending cases: JT-1 to JT-5 — ready to generate

A quick check after each deploy that the career tools work, both for a
visitor who isn't logged in and for a job seeker: the Skills Matcher, the
Interest Profiler and the Employment Readiness Assessment, plus adding
careers to the job seeker's goals. The source checklist asks for these
tools to be tested "both as anon user and career seeker".

JT-6 to JT-8 (the visitor checks) were CT-1 to CT-3 in
[smoke-public-site.md](smoke-public-site.md) and moved here so both halves
are in one plan. They only read the site and run on Production. JT-1 to
JT-5 log in as `jobseeker` and save to the account, so they are no-prod.

## Scope

- **Visitor (JT-6 to JT-8, prod-safe):** each tool can be filled in and
  shows results, or opens without a login.
- **Job seeker (JT-1 to JT-5, no-prod):** the same tools logged in, adding
  careers to goals and removing them in `finally`.
- Reuses the page objects `tests/pages/skills-matcher.page.ts`,
  `interest-profiler.page.ts` and `employment-readiness.page.ts`.

## Login

| | |
|---|---|
| **Visitor** | JT-6 to JT-8 use a logged-out browser context. |
| **`jobseeker`** | `playwright/.auth/<env>/jobseeker.json`, for JT-1 to JT-5. |
| **Environments** | JT-6 to JT-8: QA, Stage and Production. JT-1 to JT-5: QA and Stage only. |

## Test cases

JT-6 to JT-8 run as a visitor who isn't logged in. JT-1 to JT-5 log in as
`jobseeker` and change (or may change) that account, so they run on QA and
Stage only.

| ID | Test | Page | Steps | Expected result | Required login | Prod |
|---|---|---|---|---|---|---|
| JT-6 | Skills Matcher gives results to a visitor | `/occupations/skills_matcher` | 1. Answer the 10 skill groups on the first page. 2. Click "Continue" until the last page. 3. Submit. | A "Matching Careers By My Skills" results page shows. | | Yes |
| JT-7 | Interest Profiler gives results to a visitor | `/occupations/interest_profiler` | 1. On each page, answer every question and click "Continue" (60 questions in all). 2. On the last page, submit. | An "Interest Assessment Results" page shows. | | Yes |
| JT-8 | Employment Readiness Assessment opens for a visitor | `/employment-readiness/take` | Open the page. | **1.** The page title "Employment Readiness Assessment" shows. **2.** No login is needed. | | Yes |
| JT-1 | Skills Matcher: add a matched career to goals | `/occupations/skills_matcher` | Source checklist: "compare skills and add to goals". 1. Answer the skills and submit, as in JT-6. 2. On the results, click "Add to goals" (or similar) on the first career. 3. Open the dashboard. **Cleanup:** JT-2. | **1.** The results page shows. **2.** A confirmation shows. **3.** The career is listed in the dashboard's goals section. | `jobseeker` | No: adds a career to the job seeker's goals |
| JT-2 | Remove a career from goals | the dashboard | On the dashboard, remove the career added in JT-1 from the goals section. | The career is no longer listed. | `jobseeker` | No: changes the job seeker's goals |
| JT-3 | Interest Profiler as a job seeker | `/occupations/interest_profiler` | Confirm during generation whether results are saved to the account. 1. Answer every question and submit, as in JT-7. 2. Open the dashboard. | **1.** An "Interest Assessment Results" page shows. **2.** If results are saved to the account, they show on the dashboard. | `jobseeker` | No: may save results on the job seeker account |
| JT-4 | Employment Readiness Assessment as a job seeker | `/employment-readiness/take` | JT-8 only checks the page opens; this completes it. 1. Answer every question and submit. 2. Open the dashboard. | **1.** A results page shows. **2.** If results are saved to the account, they show on the dashboard. | `jobseeker` | No: may save results on the job seeker account |
| JT-5 | Save a career from Explore Careers | `/explore/careers` | The logged-in half of the checklist's §20 flow (the visitor half needs LoginMN). 1. Search "Nursing" and open a career. 2. Click Save / Add to goals, then open the dashboard. **Cleanup:** remove the career in `finally`. | **1.** The career page opens. **2.** The career is listed in the dashboard's goals. | `jobseeker` | No: saves a career on the job seeker account |

## Good to know

- **The Skills Matcher needs only 10 answers** (all on the first page), but
  Submit is only on the last page, so you still click "Continue" to get
  there. The **Interest Profiler needs all 60 answers.**
- **JT-6 and JT-7 submit the forms as a visitor.** Nothing is saved for a
  visitor, and both are approved for Production.

## Not covered

- The LoginMN prompt for a visitor who saves a career: Phase 3.

## Open questions

1. What exactly is the "add to goals" control and where do goals show on
   the dashboard?
2. Are Interest Profiler and Employment Readiness results stored on the
   account, or only shown once?

## Suggested files

```
tests/
  smoke/jobseeker-tools/
    visitor.spec.ts       # JT-6 .. JT-8 (implemented, desktop and phone)
    goals.spec.ts         # JT-1, JT-2, JT-5
    assessments.spec.ts   # JT-3, JT-4
  pages/
    dashboard.page.ts     # goals section (shared)
    employment-readiness.page.ts   # extend: answer all + submit
```
