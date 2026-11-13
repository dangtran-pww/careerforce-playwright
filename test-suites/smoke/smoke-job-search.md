# [Smoke] - Job Search - Test Plan

**Status: implemented.**

**Implemented test:** `tests/smoke/job-search/*.spec.ts`

No-prod cases: SS and MD (see the Prod column). On Production, the
dashboard and Playwright run the JS and JF cases only.

SS and MD are tagged `@no-prod`, run on desktop and phone, and need a saved
session from `npm run login:manual -- jobseeker`.

## Overview

This plan is the smoke check for Job Search (`/job-search`): the search
itself, its filters, saving searches, and managing them from the job
seeker's dashboard. It has four parts:

- **Search and results (JS):** Job Search opens with no search and lists
  jobs, without JavaScript errors, and its Keyword, Location, Distance and
  Search controls work; the homepage Job Search box leads to results;
  each job has its links; a job opens on its own; Save search and Bookmark
  ask a visitor to log in.
- **Filters (JF):** the Company and City filters each narrow the results to
  that company or city, the sort orders sort the jobs, the filters, sort and
  keyword keep each other, and Reset clears them all.
- **Layout (JL-1, a prompt case):** Claude compares Job Search with the
  comparison sites at desktop and phone sizes and reports any layout or
  styling difference ([Prompt case JL-1](#prompt-case-jl-1)).
- **Saved searches and My Job Search (SS, MD):** a logged-in job seeker
  saves a search, runs it again from "Jobs for me", and sees it on their
  dashboard (My Account). From the dashboard they open and remove saved
  searches and bookmarked jobs.

The JS, JF and JL cases run as a visitor who isn't logged in and don't change
anything, so they are part of the post-deploy smoke run and are safe on QA,
Stage, and **Production**. They live in `tests/smoke/job-search/`.

The SS and MD cases log in as a job seeker and save, bookmark and remove
things on that account, so they run on **QA and Stage only**, never on
Production. They live in the same folder, tagged `@no-prod`: on
Production, Playwright leaves them out, and `--grep-invert @no-prod` leaves
them out elsewhere (see
[Keeping tests off Production](../README.md#keeping-tests-off-production)).
Each test removes what it added, even when it fails.

The plan isn't no-prod as a whole, only SS and MD are (the Prod column), so
on Production the dashboard runs the plan without them. By hand, the first
command under [Running it](#running-it) leaves them out on Production too,
because they are tagged `@no-prod`.

JS-2 to JS-5 and JF-1, JF-2 were moved here from
[smoke-public-site.md](smoke-public-site.md) (where JF-1 and JF-2 were FL-5 and
FL-6); there, JS-2 to JS-5 were JS-1 to JS-4. The old JS-5 (no JavaScript errors) is now part of the new JS-1. The rest of the plan replaces the earlier draft of this file.

## Login

| | |
|---|---|
| **JS, JF and JL cases** | None. A visitor who isn't logged in. |
| **SS and MD cases** | The `jobseeker` role: `playwright/.auth/<env>/jobseeker.json`, from `npm run login:manual -- jobseeker`. Job seekers log in with LoginMN. Use a test account, not a person's own account (see [Open questions](#open-questions)). |
| **Site password gate** | QA and Stage ask for the `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` from `.env` ([one-time setup](../README.md#one-time-setup)). Production has no gate. |
| **Accounts touched** | SS and MD add saved searches and bookmarks to the job seeker account and remove them again. They never remove anything they didn't add. |

## Running it

First time? Do the [one-time setup](../README.md#one-time-setup).

Search and filters (no login, any environment; desktop, then phone). On QA
and Stage these commands also run SS and MD; add `--grep-invert @no-prod` to
leave them out:

```bash
BASE_URL=https://qa.careerforce.link npx playwright test tests/smoke/job-search --project=smoke-desktop
BASE_URL=https://qa.careerforce.link npx playwright test tests/smoke/job-search --project=smoke-mobile
```

Saved searches and the dashboard only (QA or Stage only, desktop and phone):

```bash
npm run login:manual -- jobseeker
BASE_URL=https://qa.careerforce.link npx playwright test tests/smoke/job-search --project=smoke-desktop --project=smoke-mobile --grep @no-prod
```

Add `--ui` to [watch it run](../README.md#watching-a-run), or put
`SCREENSHOT=on` in front to
[save a screenshot of every test](../README.md#screenshots-of-every-test).

### Prompt case JL-1

JL-1 has no test code. It is a [prompt case](../README.md#rule-2-prompt-cases):
Claude opens the site in a browser, follows
[prompts/job-search-compare.md](prompts/job-search-compare.md) and gives a
verdict (pass, fail or unsure) with findings and screenshots. The
`npx playwright test` commands above don't run it. Run it from the dashboard
(it runs with the rest of the plan), or on its own:

```bash
npm run prompt -- JL-1 --env qa
```

It compares Job Search with the environment's comparison sites, at desktop
and phone sizes:

| Site under test | Compared with |
|---|---|
| Local, QA, Sandbox | Stage and Production |
| Stage | Production |
| Production | The screenshots of the last JL-1 run on Production (the baseline) |

On Production, run JL-1 before a deploy and again after it: the second run
reports what the deploy changed. With no earlier run, it reviews the page on
its own. Add `--compare <env>` (for example `--compare prod`) to compare with
other sites. Each run costs Claude usage (several minutes with two
comparison sites, shown at the end).

## Test cases

"Page" is the address after the site name, for example `/job-search` means
`qa.careerforce.link/job-search`.

### Search and results

Not logged in. `tests/smoke/job-search/job-search.spec.ts`. JS-1 is
checked first: if Job Search doesn't load, the other cases can't pass.

| ID | Test | Page | Steps | Expected result | Required login | Prod |
|---|---|---|---|---|---|---|
| JS-1 | Job Search loads, and its search form works | `/job-search` | 1. Open Job Search with nothing after `/job-search` in the address. 2. Look at the search form. 3. Type "Saint P" in Location and pick "Saint Paul, MN" from the suggestions. 4. Type "nurse" in Keyword, set Distance to "10 miles", and click "Search". | **1.** The page loads (no error or "Page not found" page) with the heading "Job Search" and at least 1 job listed. No JavaScript error. **2.** The form shows: a "Keyword" box, empty, with the hint "Title, Company or Description"; a "Location" box, empty, with the hint "City, State or ZIP code"; a "Distance" dropdown set to "20 miles", offering 5, 10, 20, 30 … 100 miles; and a "Search" button. **3.** A list of suggestions opens under Location, and each one contains "Saint P". Picking one puts "Saint Paul, MN" in the box and closes the list. **4.** The address has `title=nurse`, `location[text]=Saint Paul, MN` and `radius=10`. The form still shows "nurse", "Saint Paul, MN" and "10 miles", and at least 1 job is listed. |  | Yes |
| JS-2 | Homepage Job Search hands over the search | `/` | In the Job Search block, type "nurse" and click "Search". | Only the hand-over is checked here: that Job Search loads with jobs and no JavaScript errors is JS-1, and the homepage's JavaScript errors are GN-5 in [smoke-public-site.md](smoke-public-site.md). **1.** Job Search opens with `title=nurse` and `radius=20` (the default 20 miles) in the address. **2.** The Keyword box still shows "nurse". |  | Yes |
| JS-3 | Jobs have their links | `/job-search?title=nurse` | Look at the first 3 jobs. | Each of the 3 jobs has: **1.** A title. **2.** A "Learn more and apply" link that opens the employer's posting on another site in a new tab. **3.** A "Read more" link to that job. **4.** A short description of the job, not empty. |  | Yes |
| JS-4 | A job opens on its own | `/job-search?title=nurse` | Click "Read more" on the first job. | **1.** Only that job shows, with the same title. **2.** Its full description shows. |  | Yes |
| JS-5 | Save search and Bookmark ask to log in | `/job-search?title=nurse` | Don't log in. 1. Click "Bookmark" on the first job, then close the dialog. 2. Click "Save search" (on a phone, open "Filters" first), then close the dialog. | Each dialog is on top of the page, not hidden behind another layer (on a phone, the Filters drawer). **1.** A dialog shows, saying "Create an account or log in to use this feature", with a "Log In or Register" button, a "Continue Browsing" link, and a "DEED staff and partners log in here." link back to this search. **2.** The same dialog shows. |  | Yes |

### Filters

Not logged in. `tests/smoke/job-search/filters.spec.ts`.

| ID | Test | Page | Steps | Expected result | Required login | Prod |
|---|---|---|---|---|---|---|
| JF-1 | Two companies | `/job-search?title=nurse` | 1. Search "nurse". 2. In the Company dropdown, filter by the company with the most jobs. 3. Filter by the company with the second most jobs instead. | See [How the filter cases compare results](#how-the-filter-cases-compare-results). **1.** At least 1 job is listed. **2.** The dropdown shows the chosen company, every job listed is from it, and there are no more jobs than in step 1. **3.** The same as step 2 for the second company, and the results differ from step 2's (a different total, or different jobs on the first page). |  | Yes |
| JF-2 | Two cities | `/job-search?title=nurse` | 1. Search "nurse". 2. In the City dropdown, filter by the city with the most jobs. 3. Filter by the city with the second most jobs instead. | See [How the filter cases compare results](#how-the-filter-cases-compare-results). **1.** At least 1 job is listed. **2.** The dropdown shows the chosen city, every job listed is in it, and there are no more jobs than in step 1. **3.** The same as step 2 for the second city, and the results differ from step 2's (a different total, or different jobs on the first page). |  | Yes |
| JF-3 | Sort orders | `/job-search?title=nurse` | 1. Search "nurse". 2. Sort by "Job title". 3. Sort by "Company". 4. Sort by "Date posted". | Each sort shows the same number of jobs as the unsorted search, and the Sort dropdown shows the chosen order. Letter case is ignored when comparing. **1.** At least 1 job is listed. **2.** The job titles on the first page are A–Z. **3.** The companies on the first page are A–Z. **4.** The "Posted … ago" labels on the first page go from newest to oldest. |  | Yes |
| JF-4 | Filters, sort and keyword keep each other | `/job-search?title=nurse` | Use the page's own controls, not the address. 1. Search "nurse". 2. Pick the city with the most jobs in the City dropdown (on a phone, open "Filters" first). 3. Change Sort to "Date posted". 4. Type "nursing assistant" in Keyword and click "Search". | After each step, the address and the form show everything chosen so far, and from step 2 on every job listed is in the chosen city. **1.** `title=nurse`. **2.** Also `loc=<city>`. **3.** Also `sort=date-posted-desc`. **4.** `title=nursing assistant`, with the same city and sort. |  | Yes |
| JF-5 | Reset clears the search | `/job-search?title=nurse&loc=<city>&sort=date-posted-desc` | Open JF-4's last search and click "Reset". | **1.** The Keyword box is empty. **2.** The City dropdown shows its placeholder ("List of cities"). **3.** Sort shows "Relevance". **4.** At least 1 job is listed. **5.** The address has no `title`, `loc` or `sort` value. |  | Yes |

### Layout

Not logged in. A [prompt case](#prompt-case-jl-1), with no test code.

| ID | Test | Page | Steps | Expected result | Required login | Prod |
|---|---|---|---|---|---|---|
| JL-1 | Job Search layout matches the comparison sites | `/job-search` | **Prompt:** [job-search-compare](prompts/job-search-compare.md): Claude compares Job Search with the [comparison sites](#prompt-case-jl-1) at desktop and phone sizes, part by part (on the phone, with the menu and the Filters drawer open). | **1.** No layout or styling difference from any comparison site that looks unintended: no missing, extra or reordered parts, no broken spacing, fonts, colours, icons or images, and nothing cut off, overlapping or scrolling sideways. **2.** Differences that are only content (other jobs, companies, cities, dates or counts) are listed as notes and don't fail the case. **3.** Matching screenshots of each part on each site at each size are saved with the result. |  | Yes |

### Saved searches

Logged in as `jobseeker`. QA and Stage only, desktop and phone. `tests/smoke/job-search/saved-search.spec.ts`, tagged `@no-prod`.

| ID | Test | Page | Steps | Expected result | Required login | Prod |
|---|---|---|---|---|---|---|
| SS-1 | Save a search | `/job-search?title=nurse&loc=<city>` | 1. Search "nurse", filter by the city with the most jobs, and click "Save search" (on a phone, open "Filters" first). 2. Name it `Playwright test <timestamp>` and save. 3. Without reloading, open "Jobs for me" → "Saved searches". **Cleanup:** remove the saved search from the dashboard. | **1.** A dialog "Save this search to your dashboard" with a "Name job search" box opens on top of the page, not hidden behind another layer (on a phone, the Filters drawer). **2.** The dialog closes with no error. **3.** The list shows the new name. | `jobseeker` | No: saves, bookmarks and removes on the job seeker account |
| SS-2 | Run a saved search from Jobs for me | `/job-search` | Save a search as in SS-1 first. 1. Open `/job-search` with no search. 2. In "Jobs for me", pick "Saved searches", then the saved name. **Cleanup:** as SS-1. | After step 2, Job Search opens with the saved search: **1.** The address has `title=nurse` and the same `loc`. **2.** The Keyword box shows "nurse". **3.** The City dropdown shows the city. **4.** At least 1 job is listed. | `jobseeker` | No: saves, bookmarks and removes on the job seeker account |
| SS-3 | Limit of 5 saved searches | `/job-search?title=nurse` | 1. Note how many saved searches the account has. 2. Save `Playwright test <timestamp> 1`, `2`, … until it has 5 saved searches. 3. Click "Save search" once more. 4. Try to save a 6th anyway. **Cleanup:** remove every saved search this test added. | **1.** At step 3, the dialog warns "You have already reached the limit for saved jobs." **2.** At step 4, the 6th is refused: either Save can't be used, or an error message says the search wasn't saved. **3.** "Jobs for me" → "Saved searches" and the dashboard still list exactly the same 5, and the 6th name isn't among them. | `jobseeker` | No: saves, bookmarks and removes on the job seeker account |

### My Job Search on the dashboard

Logged in as `jobseeker`. QA and Stage only, desktop and phone. `tests/smoke/job-search/dashboard.spec.ts`, tagged `@no-prod`.
The dashboard is the job seeker's account page, `/user` (it opens
`/user/<their user ID>`).

| ID | Test | Page | Steps | Expected result | Required login | Prod |
|---|---|---|---|---|---|---|
| MD-1 | My Job Search section shows | `/user` | Open the dashboard. | **1.** The "Jobs For Me" section shows its "Saved searches" and "Bookmarked jobs" groups. **2.** Each group lists its items, or says "You have no saved searches." / "You have no saved jobs.". **3.** Each item has a remove ("x") link. | `jobseeker` | No: saves, bookmarks and removes on the job seeker account |
| MD-2 | A saved search opens from the dashboard | `/user` | Save a search as in SS-1 first. 1. Open the dashboard. 2. Click the saved search's name. **Cleanup:** as SS-1. | **1.** The dashboard lists the saved search by its name. **2.** Job Search opens with `title=nurse` and the same `loc`, and at least 1 job. | `jobseeker` | No: saves, bookmarks and removes on the job seeker account |
| MD-3 | Remove a saved search from the dashboard | `/user` | Save a search as in SS-1 first. 1. On the dashboard, click its "x". 2. Reload the dashboard. 3. Open `/job-search` and look in "Jobs for me" → "Saved searches". | **1.** The saved search disappears from the dashboard. **2.** It stays gone after the reload, and every other saved search is still listed. **3.** "Jobs for me" no longer lists it, and still lists every other saved search. | `jobseeker` | No: saves, bookmarks and removes on the job seeker account |
| MD-4 | A bookmarked job shows on the dashboard | `/job-search?title=nurse` | 1. Bookmark the first job that isn't already bookmarked. 2. Reload and look in "Jobs for me" → "Bookmarked jobs". 3. Open the dashboard. 4. Click the job there. **Cleanup:** remove the bookmark. | **1.** The job's bookmark icon switches to its "remove bookmark" state. **2.** "Jobs for me" lists the job. **3.** The dashboard lists the job by its title (the dashboard shows only the title, not the company). **4.** That job opens on its own (`/job-search?jvid=<job ID>`, same title). | `jobseeker` | No: saves, bookmarks and removes on the job seeker account |
| MD-5 | Remove a bookmark from the dashboard | `/user` | Bookmark a job as in MD-4 first. 1. On the dashboard, click its "x". 2. Reload the dashboard. 3. Search "nurse" again. | **1.** The job disappears from the dashboard. **2.** It stays gone after the reload. **3.** In the search results, its bookmark icon is back to its "add bookmark" state. | `jobseeker` | No: saves, bookmarks and removes on the job seeker account |
| MD-6 | Un-bookmark from the results | `/job-search?title=nurse` | Bookmark a job as in MD-4 first. 1. Click its bookmark icon again. 2. Open the dashboard. | **1.** The icon goes back to its "add bookmark" state. **2.** The dashboard no longer lists the job. | `jobseeker` | No: saves, bookmarks and removes on the job seeker account |

### How the filter cases compare results

JF-1 and JF-2 open Job Search with no filter, then with filter X, then with
filter Y, and expect:

- The unfiltered search shows at least 1 job.
- X and Y each show no more jobs than the unfiltered search.
- **X and Y show different results:** a different total, or different jobs on
  the first page.

Exact counts are never checked.

## Good to know

- **The jobs come from an outside job feed** (CareerOneStop), so no case names
  a job, company or city. They use whatever "nurse" returns: the companies and
  cities with the most jobs at the time, and the first job on the page.
- **Every Job Search form uses GET**, so the whole search is in the address:
  `title`, `location[text]`, `radius`, `sort`, `company`, `loc`. JF-1 to JF-3
  open that address directly. JF-4 and JF-5 click the page's own controls,
  because that's how the page joins the keyword, filters and sort together.
- **Sort values:** `best-match` (Relevance, the default), `date-posted-desc`,
  `job-title-asc`, `company-asc`.
- **On a phone, the Company and City filters and Save search are in a drawer**
  behind a "Filters" button.
- **Results filtered by company may be cached.** The site caches Job Search
  results for 5 minutes, and the company isn't part of the cache key. That's
  why JF-1 checks that every job listed is from the chosen company.
- **Location and Distance are checked only by JS-1**, and only that the
  search keeps them: the jobs come from an outside feed and don't show how
  far away they are, so no case checks the distance itself. The Location
  suggestions come from the site, so JS-1 can name "Saint Paul, MN". An
  unknown location (e.g. "zzqx") shows "No results found." with no error
  message.
- **The result count stops at 500** ("Showing 500 jobs"), so a narrower
  search can show the same total as a wider one.
- **Limits:** a job seeker can have up to 5 saved searches and 15 bookmarked
  jobs. SS and MD need at least 1 free saved search and 1 free bookmark on the
  account. If the saved searches are full, SS-1, SS-2, MD-2 and MD-3 remove
  saved searches to make room: leftover `Playwright test …` ones first, then
  others. If the bookmarks are full, the test fails and says so, instead of
  removing someone else's bookmarks.
- **Saved search names are unique:** `Playwright test <timestamp>`. Cleanup
  removes only items with the names or job IDs the test added.
- **A saved search keeps the address it was saved from**, so SS-1 saves from
  the search results page, not the empty page.
- **There's no rename.** A saved search can only be added or removed. The
  earlier draft of this plan asked for rename "if supported"; it isn't.

## Mobile

The JS and JF cases also run on an emulated Android phone (Pixel 7, in
Chrome), project `smoke-mobile`:

- **JS-1 to JS-5, JF-4 and JF-5 run on the phone.** JF-4 and JF-5 use the
  filters drawer.
- **JF-1 to JF-3 are desktop only** (`@desktop-only`). The filtering and
  sorting happen on the server, so checking them once is enough.
- **No page may scroll sideways.** After each case, the test also checks that
  the page fits the screen width.

The SS and MD cases (QA and Stage only) run on the phone too. Every test runs
one at a time (`workers: 1`), so the desktop and phone runs never change the
job seeker account at the same time. On a phone, Save search is in the
Filters drawer, and the "Save this search" dialog must open on top of the
drawer, not behind it.

## Expected result

Every case is generated:

| Project | Runs | Cases |
|---|---|---|
| `smoke-desktop` on QA or Stage | 19 | JS-1 to JS-5, JF-1 to JF-5, SS-1 to SS-3, MD-1 to MD-6 |
| `smoke-desktop` on Production, or with `--grep-invert @no-prod` | 10 | JS-1 to JS-5, JF-1 to JF-5 (SS and MD are left out) |
| `smoke-mobile` on QA or Stage | 16 | JS-1 to JS-5, JF-4, JF-5, SS-1 to SS-3, MD-1 to MD-6 |
| `smoke-mobile` on Production, or with `--grep-invert @no-prod` | 7 | JS-1 to JS-5, JF-4, JF-5 (SS and MD are left out) |

JL-1 is a prompt case, so it isn't in these totals: the dashboard runs it
after the tests, and `npm run prompt -- JL-1` runs it on its own.

If the total is different, or anything fails, see
[When something fails](../README.md#when-something-fails).

## Not covered

- **An anonymous visitor who logs in from the Save search or Bookmark dialog**
  and comes back to finish saving. It needs LoginMN and account creation.
- **"Jobs for me" → "Career goals" and "In demand jobs".** They come from the
  job seeker's career goals and region, not from Job Search.
- **The employer's posting and applying.** They are on other sites.
- **An expired bookmarked job** (greyed out on its own page). It can't be set
  up on purpose.

## Open questions

1. **A dedicated job seeker test account** on QA and Stage, so SS and MD
   never touch a real tester's saved searches and bookmarks. It needs fewer
   than 5 saved searches and fewer than 15 bookmarks.
2. **MD-1 could join the post-deploy smoke run** (it changes nothing) if
   there's a job seeker account that may be used on Production.
