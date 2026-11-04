# [Accessibility - Public Pages] - Test Plan

**Status: implemented.**

**Implemented test:** `tests/accessibility/a11y.spec.ts`

## Overview

This plan measures how accessible the public side of CareerForce is, for a
visitor who isn't logged in.

**Scope: public pages only, no login.** Every case runs as a logged-out
visitor and never signs in, so no saved session (`npm run login:manual`) is
needed. The login screens themselves are public and are checked: the Login
page with each of its sections open (A11Y-2) and the "Create an account or
log in" dialog on Job Search (A11Y-3). The pages a user sees *after* logging
in (job seeker tools, profile, resume builder, staff and admin pages) are out
of scope for this plan.

Each case opens a page, waits until its main
content is drawn, and scans it with [axe-core](https://github.com/dequelabs/axe-core)
against **WCAG 2.2, levels A and AA** (which include the WCAG 2.0 and 2.1 A
and AA rules).

The checks do two jobs:

- **Pass/fail:** a case fails when its page has any WCAG violation. Nothing
  is allowlisted, so every problem found is reported, including the ones the
  site already has ([Issues found](#issues-found)).
- **Report:** every scan is saved, and `npm run a11y:summary` turns the last
  run into a summary of all pages: how many violations each has, by impact,
  and the rules that fail most ([Summary report](#summary-report)).

The scans only read the page. They don't log in or change anything, so the
plan is safe to run on QA, Stage, and **Production**. It isn't part of the
smoke run (`npm run test:smoke`); run it on its own as below.

**What automated checks can't do.** axe finds roughly a third of WCAG
problems: things that can be read from the page, such as missing labels, low
contrast, small tap targets, or broken ARIA. It can't tell whether the
keyboard order makes sense, whether focus is visible and goes to the right
place, or whether a screen reader's wording is clear. Those still need a
manual check (see [Not covered](#not-covered)).

## Running it

No login needed. First time? Do the [one-time setup](README.md#one-time-setup).
Run the command for the environment you want.

QA:

```bash
BASE_URL=https://qa.careerforce.link npx playwright test tests/accessibility --project=accessibility
```

Stage:

```bash
BASE_URL=https://stage.careerforce.link npx playwright test tests/accessibility --project=accessibility
```

Production:

```bash
BASE_URL=https://careerforce.mn.gov npx playwright test tests/accessibility --project=accessibility
```

That is the desktop run. For the phone (an emulated Android Pixel 7), use
`--project=accessibility-mobile` instead.

## Test cases

Every test starts as a visitor who isn't logged in. "Page" is the address
after the site name.

| ID | Test | Page | Steps | Expected result |
|---|---|---|---|---|
| A11Y-1 | Public pages have no violations | see the list below | Open the page and wait for its main content (the title, or the first result or card). Scan the whole page. | No WCAG 2.2 A/AA violation. |
| A11Y-2 | Login page, every section open | `/user/login` | Open "CareerForce partner organization or a training program provider" and "DEED Staff Member". Scan. | Same as A11Y-1. Checks the partner form and the staff button, which start hidden. |
| A11Y-3 | Job Search login dialog | `/job-search?title=nurse` | Click "Bookmark" on the first job. When the "Create an account or log in" dialog shows, scan. | Same as A11Y-1, with the dialog open. |
| A11Y-4 | Mobile menu open (phones only) | `/` | Tap the menu button (☰), then the arrow next to "Find a Job". Scan. | Same as A11Y-1, with the menu and a sub-menu open. |
| A11Y-5 | Job Search filters drawer (phones only) | `/job-search?title=nurse` | Tap "Filters". When the Company filter shows, scan. | Same as A11Y-1, with the drawer open. |

Pages for A11Y-1:

| Page | Address |
|---|---|
| Homepage | `/` |
| Login | `/user/login` |
| Site search | `/search?k=job` |
| Explore Careers search | `/explore/careers?otitle=Nursing` |
| Career page (Registered Nurses) | `/explore/careers/29-1141.00` |
| Job Search | `/job-search?title=nurse` |
| Events | `/education-and-training/events` |
| Programs and Services | `/programs-services` |
| Training Programs | `/training-programs` |
| Location (Bloomington) | `/careerforce-location/careerforce-bloomington` |
| CareerForce from Anywhere | `/anywhere` |
| Schedule an appointment | `/connect-careerforce/schedule-an-appointment` |
| Skills Matcher | `/occupations/skills_matcher` |
| Interest Profiler | `/occupations/interest_profiler` |
| Employment Readiness Assessment | `/employment-readiness/take` |
| Find a Job | `/find-job` |
| Job Loss Resources | `/job-loss-resources` |
| Job Search Tools | `/job-search-tools` |
| Education and Training | `/education-and-training` |
| Resources for | `/resources-job-seekers-and-career-explorers` |
| Blog post (High School, High Wages) | `/careerforce-blog/high-school-high-wages` |
| Page Not Found | `/pww-smoke-test-no-such-page` |

Good to know:

- **Content we don't build isn't scanned:** the Apple MapKit map on location
  pages and the Google reCAPTCHA on the partner login form. The analytics and
  AWS WAF scripts are blocked in every test, so they never show anything.
- **Only the page as first shown is scanned,** plus the open states in A11Y-2
  to A11Y-5. Other menus, tabs and dialogs that start closed aren't checked.
- **A failure message lists each problem:** the rule, its impact
  (critical, serious, moderate or minor), a link explaining the rule and how
  to fix it, and up to 5 of the elements it found.
- **The full scan of each case** is attached to the test as `axe-results`
  (`npx playwright show-report`, under the test's Attachments).

### Issues found

These were found on QA on 2026-11-04. Each one fails its test until it is
fixed.

| Rule | WCAG | Where | Problem |
|---|---|---|---|
| target-size | 2.5.8 | Every page, desktop | The "Sub-menu for …" arrow buttons next to the 5 main menu items are smaller than 24×24 pixels, with no space around them. |
| target-size | 2.5.8 | Every page, desktop | The header "Search CareerForce" button (magnifying glass) is smaller than 24×24 pixels. |
| target-size | 2.5.8 | `/job-search-tools` | Content error: a link to `/node/107980` is on the single letter "s" of a word. |
| color-contrast | 1.4.3 | Career pages (`/explore/careers/<code>`) | Under "Data By Region", the selected region ("Statewide") has too little contrast with its background. |
| frame-title | 4.1.2 | Career pages | The CareerOneStop video `<iframe>` has no `title`, so screen readers announce an unnamed frame. |
| Sideways scroll (reflow) | 1.4.10 | `/careerforce-blog/high-school-high-wages`, phone | A table in the post is 835px wide on a 412px screen, so the page scrolls sideways. axe doesn't check this; the phone test's sideways-scroll check catches it. |

On a phone, every page passes except the career page (its contrast and
video problems) and the High School, High Wages blog post (its wide table).

## Summary report

After a run, `npm run a11y:summary` writes
`reports/a11y-<date>-<time>/summary.md` (and `summary.json`). It has:

- **Summary:** how many scans were clean, how many rules failed, a count by
  impact. When an earlier summary
  exists in `reports/`, each number shows its change since then, so the
  trend is easy to follow from release to release.
- **By page:** a row for each page on desktop and on the phone.
- **Failing rules:** each rule that failed, with its WCAG criterion, how many
  scans and elements it hit, and a link to how to fix it.
- **Details:** for each page, its failing rules and up to 3 elements each.

The summary covers every scan in `test-results/` (the last run), so run
both desktop and phone first for the full picture. If the run used
`--output <dir>`, pass that folder: `node scripts/a11y-summary.mjs <dir>`.

For the step-by-step report with screenshots, use `/test-plan-report
accessibility-public` as with any other plan. Publish either report to
Confluence only with `/publish-report-confluence`.

## Expected result

A case passes only when its page has no WCAG 2.2 A/AA violation. The
desktop run (`--project=accessibility`) has 24 cases: the 22 pages of
A11Y-1, plus A11Y-2 and A11Y-3. A11Y-4 and A11Y-5 are phone only. The phone
run (`--project=accessibility-mobile`) has 26: the same 24 plus A11Y-4 and
A11Y-5. Like every phone test, each phone case also fails if the page
scrolls sideways.

With the [issues found](#issues-found) on QA on 2026-11-04 still open:

- **Desktop:** all 24 cases fail, because the header's small menu and
  search buttons are on every page.
- **Phone:** 24 pass and 2 fail (A11Y-1 for the career page and for the
  blog post).

The whole run is green only once every issue is fixed.

## Not covered

Not covered by this plan, and worth adding later:

- **Keyboard-only use** of the main journeys: Tab order, a visible focus
  outline, no keyboard traps, Escape closing the menu and dialogs. ("Skip to
  main content" is already checked by GN-4 in
  [smoke-anonymous.md](smoke-anonymous.md).)
- **A Lighthouse accessibility score** per page, as a single headline number.
- **A manual screen reader check** (NVDA on Windows, VoiceOver on Mac or
  iPhone) of the top journeys each release.

Out of scope, by design: **pages after login** (job seeker tools, profile,
resume builder, staff and admin pages). This plan stays public and login-free
so it can run anywhere, including Production, without accounts. If those
pages need checking, give them a separate plan that uses saved sessions.
