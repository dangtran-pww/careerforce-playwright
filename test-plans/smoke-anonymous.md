# [Smoke] - Anonymous - Test Plan

**Status: implemented.**

**Implemented test:** `tests/smoke/anonymous/*.spec.ts`

## Overview

This plan is a quick health check of the public side of CareerForce, as seen
by a visitor who isn't logged in. It covers the pages and tools most people
use:

- **Homepage:** every section loads, the Decision Tree ("What brings you here
  today?") works, and the Google Tag Manager tracking code is present.
- **Login page:** offers the "Log In or Register with LoginMN" button.
- **Search:** site search and the Explore Careers search both return results.
- **Locations, Events, Programs and Services:** the pages load with their
  main content, and the Events and Programs and Services pages list at
  least 1 item.
- **Career tools:** the Skills Matcher and Interest Profiler can be filled in
  and show results, and the Employment Readiness Assessment opens.

The checks never log in, and they don't create, edit, or delete any site
content. The only things they do besides viewing pages are what any visitor
can do: make choices in the Decision Tree and submit the Skills Matcher and
Interest Profiler forms. Both are approved for Production, so the plan is safe
to run on QA, Stage, and **Production**.

The checks don't cover emails or anything that takes longer than a single
visit. Run them after each deployment to confirm the site still works for the
public.

The checks come from the DEED smoke-testing checklist
([deed-smoke-test-plan.md](../docs/deed-smoke-test-plan.md)).

## Running it

No login needed. First time? Do the [one-time setup](README.md#one-time-setup).
Run the command for the environment you want (about 1–2 minutes).

QA:

```bash
BASE_URL=https://qa.careerforce.link npx playwright test tests/smoke/anonymous
```

Stage:

```bash
BASE_URL=https://stage.careerforce.link npx playwright test tests/smoke/anonymous
```

Production:

```bash
BASE_URL=https://careerforce.mn.gov npx playwright test tests/smoke/anonymous
```

Add `--ui` to [watch it run](README.md#watching-a-run). A successful run ends
with `20 passed` ([Expected result](#expected-result)).

## Test cases

Every test starts as a visitor who isn't logged in. "Page" is the address
after the site name, for example `/programs-services` means
`qa.careerforce.link/programs-services`.

| ID | Test | Page | Steps | Expected result |
|---|---|---|---|---|
| HP-1 | Homepage loads | `/` | Open the homepage. | All 8 sections show their headings: "Job Search", "What brings you here today?", "Upcoming Events", "Explore Careers", "Upcoming Training Programs", "Get the most out of CareerForce, create an account", "Connect to our Services", "CareerForce Blog". |
| HP-2 | Login page offers LoginMN | `/user/login` | Open the login page. | A "Log In or Register with LoginMN" button shows. |
| HP-3 | Tracking code is present | `/` | Open the homepage. | The page includes the Google Tag Manager code for this environment: `GTM-WL36T6M` on Production, `GTM-P8D2THV` on QA and Stage. |
| HP-4 | Decision Tree works | `/` | In "What brings you here today?", open "Choose a path" and click the first option. | The next step shows, with a "Reset selections" link. |
| SR-1 | Site search returns results | `/search` | Search with no words. Then search for "job fair", "networking", and "farmer", one at a time. | Every search shows at least 1 result. |
| SR-2 | Career search returns results | `/explore/careers` | Search for "Nursing", "taxi driver", and "project manager", one at a time. | Every search shows at least 1 result. |
| LV-1 | Location pages load | see the list below | Open each of the 4 location pages. | Each page shows a "Programs and Services" section. |
| LV-2 | Events page lists events | `/education-and-training/events` | Open the page. | The page title "Events" shows, with at least 1 event listed below it. |
| LV-3 | Programs and Services page lists services | `/programs-services` | Open the page. | The page title "Programs and Services" shows, with at least 1 program or service listed below it. |
| CT-1 | Skills Matcher gives results | `/occupations/skills_matcher` | Answer the 10 skill groups on the first page, click "Continue" until the last page, then submit. | A "Matching Careers By My Skills" results page shows. |
| CT-2 | Interest Profiler gives results | `/occupations/interest_profiler` | Answer every question on each page, clicking "Continue" between pages (60 questions in all), then submit. | An "Interest Assessment Results" page shows. |
| CT-3 | Employment Readiness Assessment opens | `/employment-readiness/take` | Open the page. | The page title "Employment Readiness Assessment" shows, with no login needed. |

Location pages for LV-1:

| Location | Page |
|---|---|
| Aitkin | `/careerforce-location/careerforce-aitkin` |
| Bloomington | `/careerforce-location/careerforce-bloomington` |
| Brooklyn Center | `/careerforce-location/careerforce-brooklyn-center` |
| CareerForce from Anywhere | `/anywhere` |

Good to know:

- **Login is handled by LoginMN** (the State of Minnesota's shared login), so
  the CareerForce login page has no username or password boxes of its own.
- **"Choose a path" starts closed** in the Decision Tree. Click it to open the
  options.
- **Location pages don't always have an "Events" section.** It only appears
  when that location has events scheduled, so LV-1 doesn't check for it.
- **Skills Matcher needs only 10 answers** (all on the first page), but Submit
  is only on the last page, so you still click "Continue" to get there. The
  **Interest Profiler needs all 60 answers.**
- **Search result counts change** as content is added or removed. The tests
  only check that there's at least 1 result, not an exact number. The same
  goes for the Events and Programs and Services listings (LV-2, LV-3).

## Expected result

The terminal ends with `20 passed`. The plan has 12 test cases, but some are
repeated with different inputs, so they add up to 20 runs:

| Test case | Runs | Why |
|---|---|---|
| HP-1, HP-2, HP-3, HP-4 | 4 | once each |
| SR-1 | 4 | an empty search, plus "job fair", "networking", "farmer" |
| SR-2 | 3 | "Nursing", "taxi driver", "project manager" |
| LV-1 | 4 | Aitkin, Bloomington, Brooklyn Center, CareerForce from Anywhere |
| LV-2, LV-3 | 2 | once each |
| CT-1, CT-2, CT-3 | 3 | once each |
| **Total** | **20** | |

If the total is anything other than 20, or anything fails, see
[When something fails](README.md#when-something-fails).

