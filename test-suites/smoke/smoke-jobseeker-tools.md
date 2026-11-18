# [Smoke] - Job Seeker Tools - Test Plan

Status: implemented
Implemented test: tests/smoke/jobseeker-tools/*.spec.ts

## Overview

A quick check after each deploy that the career tools work, both for a
visitor who isn't logged in and for a job seeker: the Skills Matcher, the
Interest Profiler and the Employment Readiness Assessment, plus adding
careers to the job seeker's goals. The source checklist asks for these
tools to be tested "both as anon user and career seeker".

The visitor cases (JT-6 to JT-8) only read the site, so they run on QA,
Stage and Production. JT-1 to JT-5 log in as the job seeker and save to the
account, so they run on QA and Stage only.

## Login

| **JT-6 to JT-8** | Visitor, not logged in |
|---|---|
| **JT-1 to JT-5** | Job seeker role |
| **Accounts touched** | The job seeker account: JT-1 and JT-5 each add a career to its goals and remove it again (JT-2, or a clean-up step), even when the case fails. JT-3 saves Interest Profiler answers on it; they are not undone, and the next run replaces them ("Start Over"). |

## Test cases

JT-6 to JT-8 are in `visitor.spec.ts`, JT-1, JT-2 and JT-5 in
`goals.spec.ts`, and JT-3 and JT-4 in `assessments.spec.ts`. JT-1 and JT-2
run in order. The job seeker's career goals are on the **My Goals &
Experience** tab (`/user/<ID>/skills-experience`), under "My Career Goals",
not on the Dashboard tab.

| ID | Test | Page | Steps | Expected result | Required login | Prod |
|---|---|---|---|---|---|---|
| JT-6 | Skills Matcher gives results to a visitor | `/occupations/skills_matcher` | Answer the 10 skill groups on the first page, click "Continue" until the last page, and submit. | A "Matching Careers By My Skills" results page shows. | | Yes |
| JT-7 | Interest Profiler gives results to a visitor | `/occupations/interest_profiler` | On each page, answer every question and click "Continue" (60 questions in all), then submit on the last page. | An "Interest Assessment Results" page shows. | | Yes |
| JT-8 | Employment Readiness Assessment opens for a visitor | `/employment-readiness/take` | Open the page. | The page title "Employment Readiness Assessment" shows, with no login needed. | | Yes |
| JT-1 | Skills Matcher: add a matched career to goals | `/occupations/skills_matcher` | Source checklist: "compare skills and add to goals". The account must have room for a goal. If the page opens on saved results, click "Start Over" first. 1. Answer the skills and submit, as in JT-6. 2. On the results, tick the first career that isn't already a goal and click "Update Career Goals". 3. Open My Goals & Experience. **Cleanup:** JT-2; if JT-2 doesn't run, the career is removed after the case. | 1. The results page shows. 2. My Goals & Experience opens with "Successfully updated your Career Goals.". 3. The career is listed under My Career Goals. | `jobseeker` | No: adds a career to the job seeker's goals |
| JT-2 | Remove a career from goals | My Goals & Experience | On My Goals & Experience, click the "x" on the career added in JT-1. | The career is no longer listed. | `jobseeker` | No: changes the job seeker's goals |
| JT-3 | Interest Profiler as a job seeker | `/occupations/interest_profiler` | If the page opens on saved results, click "Start Over" first. 1. Answer every question and submit, as in JT-7. 2. Open My Goals & Experience. | 1. An "Interest Assessment Results" page shows. 2. The Interest Profiler card says "See my interest profiler results", with a "View careers" link: the answers are saved on the account. | `jobseeker` | No: saves results on the job seeker account |
| JT-4 | Employment Readiness Assessment as a job seeker | `/employment-readiness/take` | JT-8 only checks the page opens; this completes it. 1. Answer all 12 questions. 2. Click "Printable Version". | 1. A "Recommendation based on your selection" shows under the answers. 2. A new tab shows "Employment Readiness Assessment Results". | `jobseeker` | No: logged-in use of the tool is tracked on the account |
| JT-5 | Save a career from Explore Careers | `/explore/careers` | The logged-in half of the checklist's §20 flow (the visitor half needs LoginMN). If Registered Nurses is already a goal (left by an earlier run), remove it first. 1. Search "Nursing" and open "Registered Nurses" (it opens in a new tab). 2. Click "Add to career goals". **Cleanup:** remove the career, even when the case fails. | 1. The career page opens, at `/explore/careers/29-1141.00`. 2. An alert says "Career goal has been added!", then My Goals & Experience lists Registered Nurses under My Career Goals. | `jobseeker` | No: saves a career on the job seeker account |

## Good to know

- **The Skills Matcher needs only 10 answers** (all on the first page), but
  Submit is only on the last page, so you still click "Continue" to get
  there. The **Interest Profiler needs all 60 answers.**
- **JT-6 and JT-7 submit the forms as a visitor.** Nothing is saved for a
  visitor, and both are approved for Production.
- **A job seeker's Skills Matcher and Interest Profiler answers are saved.**
  The next visit opens on the results, and My Goals & Experience says "See
  my … results". "Start Over" deletes the saved answers.
- **Employment Readiness results are not saved**, for a visitor or a job
  seeker. They are only shown in the "Printable Version" tab.
- **A job seeker can have at most 6 career goals.** JT-1 and JT-5 fail with
  a clear message, rather than removing other goals, when the account is
  full. Each case removes only the career it added, by its SOC code.

## Mobile

JT-6 to JT-8 run on desktop and on a phone. JT-1 to JT-5 change the job
seeker account, so they are tagged `@desktop-only`: a phone run would make
the same changes again.

## Not covered

- **The LoginMN prompt for a visitor who saves a career:** Phase 3.
