# Phase 1 — Read-Only Smoke Test Plan

**Status: implemented.** All 10 cases are written and passing against QA —
see `tests/smoke/*.spec.ts` and `tests/pages/*.page.ts`. This doc now
doubles as the as-built reference; corrections made while implementing are
called out inline and in "Implementation notes" below.

Split out from [deed-smoke-test-plan.md](../docs/deed-smoke-test-plan.md). This is the
first slice to actually build: everything here is safe to run against
**production**, requires no new test-inbox or third-party IdP integration,
and creates or deletes nothing. It's the direct automation of the checklist
items the source Confluence doc already calls out as prod-appropriate.

## Running it

```bash
cp .env.example .env   # fill in BASIC_AUTH_USER / BASIC_AUTH_PASSWORD for QA
npx playwright test --project=smoke
```

QA/stage sit behind an HTTP Basic Auth gate in front of Drupal — that's
`BASIC_AUTH_USER`/`BASIC_AUTH_PASSWORD` in `.env`, separate from any Drupal
login. `BASE_URL` defaults to `https://qa.careerforce.link`.

## Scope

- Read-only: no content created, edited, published, or deleted.
- No email assertions, no LoginMN round trip, no multi-day/long-running waits.
- Runs against any single environment via `BASE_URL` — prod, stage, or QA.
- All cases are fully anonymous — no login required. They run under their
  own `smoke` Playwright project (`testDir: tests/smoke`), with no
  `storageState` and no dependency on the `setup` project — this suite must
  work with none of the login auth infra in place, and now does. The
  admin-report checks (status report, translations warning, search index
  counts) moved to the admin testing plan, since they need a logged-in
  reports-viewer session and a different ownership model (the known-issues
  allowlist).

## Non-goals (explicitly deferred to later phases)

- Cross-environment result-count *parity* diffing (stage vs. live) — true
  parity comparison needs a harness that talks to two environments in one
  run; v1 settles for "search returns a sane number of results," not a diff.
- Visual regression baselines (`toHaveScreenshot()`) for homepage layout.
- Any flow needing a test inbox, LoginMN sandbox, or write access.

## Test cases

| ID | Title | Persona | Steps | Assertions | Notes |
|---|---|---|---|---|---|
| HP-1 | Homepage loads | Anonymous | `goto('/')` | `main` landmark visible; all 8 homepage section headings visible: "Job Search", "What brings you here today?", "Upcoming Events", "Explore Careers", "Upcoming Training Programs", "Get the most out of CareerForce, create an account" (CTA), "Connect to our Services", "CareerForce Blog" | Each heading is asserted via `getByRole('heading', { name: ... })` — all render as plain `<h2>`s with stable text, no content-dependent sections involved (unlike LV-1's Events block) |
| HP-2 | Login page offers LoginMN | Anonymous | `goto('/user/login')` | "Log In or Register with LoginMN" button visible | **Correction:** this site has no inline username/password form — login is a hand-off to LoginMN (the state's shared IdP). The generic starter template assumed `getByLabel('Username')`; that does not apply here. |
| HP-3 | GTM container present | Anonymous | `goto('/')` | Rendered HTML contains the GTM ID expected for this env (`GTM-P8D2THV` lower, `GTM-WL36T6M` prod) | GTM is self-hosted (`/modules/contrib/google_tag/js/gtm.js`), not loaded from googletagmanager.com, so scanning rendered HTML is more reliable than watching for a specific network request. Confirmed both IDs directly against prod and QA. |
| HP-4 | Decision Tree widget works | Anonymous | `goto('/')`, open the widget, click the first option | A second step's "Reset selections" control becomes visible | **Correction:** the options sit inside a native `<details>/<summary>` disclosure ("Choose a path") that's collapsed at the 1280×720 viewport Playwright uses — the options are in the DOM but not visible until the `<summary>` is clicked open first. Confirmed it's pure GET-navigation (`?decision-tree-to=N`), nothing written. |
| SR-1 | Site search returns results | Anonymous | 1) Search with an empty keyword. 2) Data-driven over keywords: "job fair", "networking", "farmer" | Empty search returns the full index (confirmed: not an empty state); each keyword's result count > 0 | Verified exact counts on QA at write-time (142/194/41 respectively) |
| SR-2 | `/explore/careers` search returns results | Anonymous | Data-driven over keywords: "Nursing", "taxi driver", "project manager" | Each keyword's result count > 0 | Verified on QA (19/22/146 respectively) |
| LV-1 | Location page shows Programs and Services | Anonymous | Data-driven over 4 locations (paths below) | "Programs and Services" heading visible | **Correction:** dropped the "Events" section from this assertion — it only renders when a location currently has events scheduled (confirmed: Aitkin did, Brooklyn Center didn't, at write-time), so it's content-dependent, not structural. Asserting it would make the suite flaky as events come and go. |
| LV-2 | `/events` view page loads | Anonymous | `goto('/events')` | H1 "Events" visible | |
| LV-3 | `/programs-services` view page loads | Anonymous | `goto('/programs-services')` | H1 "Programs and Services" visible | |
| CT-1 | Skills Matcher loads and accepts input | Anonymous | `goto('/occupations/skills_matcher')`, answer the first 10 skill groups, step through to the end, submit | "Matching Careers By My Skills" results render | **Correction:** this is a paginated, progressive-disclosure form (40 skill groups in batches of 10), not one continuous page. The first page already holds the 10 groups needed to satisfy the "answer at least 10" validation; the Submit button only exists on the form's last page though (hidden via a `cf-hidden` class until then), so the page object clicks "Continue" a few times after answering to reach it — regardless of whether the later pages are actually filled in. |
| CT-2 | Interest Profiler completes and scores | Anonymous | `goto('/occupations/interest_profiler')`, answer every visible question per page, clicking Continue between pages, submit | "Interest Assessment Results" render | **Correction:** same paginated component as Skills Matcher, but all 60 activities are required (no partial-answer shortcut) — the page object answers whatever's visible on each page before continuing, repeating until Submit appears. |
| CT-3 | Employment readiness assessment entry | Anonymous | `goto('/employment-readiness/take')` | H1 "Employment Readiness Assessment" visible | Confirmed it loads without requiring login |

Location paths for LV-1:

| Location | Path |
|---|---|
| Aitkin | `/careerforce-location/careerforce-aitkin` |
| Bloomington | `/careerforce-location/careerforce-bloomington` |
| Brooklyn Center | `/careerforce-location/careerforce-brooklyn-center` |
| CareerForce from Anywhere | `/anywhere` |

10 cases total, no new infrastructure required beyond the QA Basic Auth
credentials and `dotenv` (added as a dev dependency so `playwright.config.ts`
picks up `.env`).

## Page objects (as built)

One Page Object per distinct page/URL under `tests/pages/`; specs describe
*what* is being checked, page objects own *how* (locators, navigation,
workflow methods):

```
tests/
  pages/
    home.page.ts                 # HomePage — landmark, GTM tag, Decision Tree
                                  # (disclosure toggle + first option link)
    login.page.ts                # LoginPage — the LoginMN hand-off button
    search.page.ts                # SearchPage — shared base: fill keyword, read
                                  # result count. Site search and /explore/careers
                                  # both instantiate it with their own path+param.
    location.page.ts             # LocationPage — constructor takes a path;
                                  # exposes Programs-and-Services (asserted) and
                                  # Events (not asserted — content-dependent)
    listing.page.ts               # ListingPage — shared base for /events and
                                  # /programs-services (just the H1 heading)
    skills-matcher.page.ts        # SkillsMatcherPage — paginated-form stepper
    interest-profiler.page.ts     # InterestProfilerPage — paginated-form stepper
    employment-readiness.page.ts  # EmploymentReadinessPage
  helpers/
    environment.ts                # expectedGtmId(baseUrl) / isProd(baseUrl)
  smoke/
    home.spec.ts         # HP-1, HP-3, HP-4
    login.spec.ts        # HP-2
    search.spec.ts       # SR-1, SR-2
    locations.spec.ts    # LV-1, data-driven over the 4 paths
    listings.spec.ts     # LV-2, LV-3
    tools.spec.ts        # CT-1, CT-2, CT-3
```

`tests/smoke/**` is its own Playwright project (`smoke` in
`playwright.config.ts`) — no `storageState`, no dependency on the `setup`
project, runs standalone.

## Implementation notes

A few things only showed up once this was actually driven against QA rather
than reasoned about from the Confluence checklist and a generic Drupal
starter template — corrections are called out per-row in the table above,
summarized here:

- **Login is LoginMN, not a Drupal form.** `/user/login` just hands off to
  the state's shared identity provider.
- **The Decision Tree is a collapsed `<details>` at this viewport.** Needs a
  click to open before its options are interactable.
- **"Events" on a location page is content-dependent.** Only "Programs and
  Services" is structurally guaranteed, so only that's asserted across all 4
  locations.
- **Skills Matcher and Interest Profiler are paginated, not single-page
  forms.** Both batch their questions behind a "Continue" control with a
  JS-toggled `cf-hidden` class gating the Submit button; Skills Matcher only
  requires 10 of 40 answered (all available on page 1) but still needs
  stepping through to the last page to reach Submit, while Interest Profiler
  requires all 60 and the page object answers each page as it goes.
- **QA/stage sit behind HTTP Basic Auth**, separate from the Drupal login —
  `BASIC_AUTH_USER`/`BASIC_AUTH_PASSWORD` in `.env`, wired into
  `playwright.config.ts` as `httpCredentials`.

## Sizing

All 10 cases are read-only, anonymous interactions already described in the
source checklist — no email, no third-party IdP round trip. Implemented and
passing as a single suite.
