# [Functional] - Job Search - Sort, Filters and Paging - Test Plan

Status: implemented
Implemented test: tests/functional/job-search/sort-filters.spec.ts, tests/functional/job-search/paging-url-state.spec.ts

## Overview

Part 2 of 4 of the functional plans for Job Search (`/job-search`). It tests
everything that reshapes a search after it runs: each sort order, the Company
and City filters (including filtering by one company and then another), the
pager, and how the whole search is kept in the address, through re-submits,
the browser's Back and Forward buttons and a link opened somewhere else.

The other parts:
[functional-job-search-search.md](functional-job-search-search.md)
(the search itself),
[functional-job-search-posting-accessibility.md](functional-job-search-posting-accessibility.md)
(one job on its own, phone layout, keyboard and accessibility) and
[functional-job-search-logged-in.md](functional-job-search-logged-in.md)
(everything a logged-in job seeker can do).

Every case runs as a visitor who isn't logged in and changes nothing, so the
whole plan is safe on QA, Stage and Production. The quick post-deploy checks
of the filters and sort are JF-1 to JF-5 in
[smoke-job-search.md](../smoke/smoke-job-search.md); this plan goes further and
doesn't repeat them.

The cases come from the manual test session in
`docs/prompts/job-search-part-2-sort-filters-paging.md`: SO-1 to SO-5 are
B1, FI-1 is B2, FI-2 is B3, FI-3 and FI-4 are B4, UR-1 is B5, PG-2 to PG-5
are B6, UR-2 is B7, and UR-3 is B8. SO-6, FI-5, FI-6 and PG-1 are added.

## Login

| | |
|---|---|
| **Role** | None. A visitor who isn't logged in. No saved session is loaded. |
| **Accounts touched** | None. |

## Running it

First time? Do the [one-time setup](../README.md#one-time-setup).

```bash
BASE_URL=https://qa.careerforce.link npx playwright test tests/functional/job-search/sort-filters.spec.ts tests/functional/job-search/paging-url-state.spec.ts --project=functional-desktop
BASE_URL=https://qa.careerforce.link npx playwright test tests/functional/job-search/sort-filters.spec.ts tests/functional/job-search/paging-url-state.spec.ts --project=functional-mobile
```

Add `--ui` to [watch it run](../README.md#watching-a-run), or put
`SCREENSHOT=on` in front to
[save a screenshot of every test](../README.md#screenshots-of-every-test).

## Checked in every case

These hold after every step of every case, and a case fails if one doesn't:

- **No JavaScript error** in the browser console.
- **No failed request** to the site itself (no 4xx or 5xx answer from the
  CareerForce host).
- **No raw error on the page:** no "The website encountered an unexpected
  error", no PHP or Drupal error message, no stack trace.
- **Nothing is dropped from the address.** Submitting one form (keyword,
  sort or filters) keeps every value of the others, in the address and in
  the form.

## Test cases

"Page" is the address after the site name. Cases use the page's own controls
unless they say "by the address". "The first page" means the 10 jobs shown
before using the pager. On a phone, the Company and City filters and "Save
search" are in a drawer behind a "Filters" button.

The cases are in one table, one area after another: sort (SO) and filters
(FI) in `tests/functional/job-search/sort-filters.spec.ts`, then paging (PG)
and the address (UR) in `tests/functional/job-search/paging-url-state.spec.ts`.

| ID | Test | Page | Steps | Expected result |
|---|---|---|---|---|
| SO-1 | Relevance is the default | `/job-search?title=nurse` | Open the page. | **1.** The Sort dropdown shows "Relevance". **2.** The address has no `sort`, or `sort=best-match`. **3.** At least 1 job is listed. |
| SO-2 | Sort by job title A–Z, across the page break | `/job-search?title=nurse` | 1. Change Sort to "Job title". 2. Note the first page's titles. 3. Go to page 2. | Letter case is ignored. **1.** The address has `sort=job-title-asc`, the dropdown shows "Job title", and the total is the same as with Relevance. **2.** The first page's titles are in A–Z order. **3.** The address still has `sort=job-title-asc` and the dropdown still shows "Job title". Page 2's titles are in A–Z order, and the last title on page 1 comes before, or is the same as, the first title on page 2. |
| SO-3 | Sort by company A–Z, across the page break | `/job-search?title=nurse` | 1. Change Sort to "Company". 2. Note the companies. 3. Go to page 2. | Compared as in SO-2. **1.** The address has `sort=company-asc`. **2.** Companies are A–Z on page 1. **3.** Companies are A–Z on page 2 and across the break. |
| SO-4 | Sort by date posted, newest first, across the page break | `/job-search?title=nurse` | 1. Change Sort to "Date posted". 2. Note the "Posted … ago" labels. 3. Go to page 2. | "2 hours ago" comes before "1 day ago" before "3 days ago"; equal labels may come in any order. **1.** The address has `sort=date-posted-desc`. **2.** The labels go from newest to oldest on page 1. **3.** The labels go from newest to oldest on page 2 and across the break. |
| SO-5 | Sort stays after a new search | `/job-search?title=nurse` | 1. Change Sort to "Date posted". 2. Type "nursing assistant" in Keyword and search. 3. Type "Duluth, MN" in Location and search. | After each search (steps 2 and 3), the Sort dropdown still shows "Date posted", the address still has `sort=date-posted-desc`, and the jobs listed are newest first. |
| SO-6 | An unknown sort value in the address | `/job-search?title=nurse&sort=bogus` | Open the page by the address. | **1.** The page loads with jobs, as with Relevance. **2.** The Sort dropdown shows "Relevance" (or no choice), not a blank or broken control. |
| FI-1 | Company filter, and clearing it | `/job-search?title=nurse` | 1. Note the total and the first page's jobs, then pick the company with the most jobs in the Company dropdown. 2. Clear the Company filter (choose its placeholder, or "Reset" if that's the only way, and say which was used). | **1.** The address has `company=<that company>`, the dropdown shows it, the total is the same as or smaller than before, and every job on the first page (and on page 2, if there is one) shows that company. **2.** `company` is gone or empty in the address, and the total and the first page's jobs are the same as before filtering. |
| FI-2 | City filter, and clearing it | `/job-search?title=nurse` | Same as FI-1 with the City dropdown and the city with the most jobs. | **1.** With the filter: the address has `loc=<that city>`, the dropdown shows it, the total is the same or smaller, and every job listed shows that city in its location. **2.** After clearing: the original total and first page are back. |
| FI-3 | One company, then another, with the dropdown | `/job-search?title=nurse` | Pick the company with the most jobs (A) and note the first page, then pick the company with the second most jobs (B) from the same dropdown, within a minute. | The site keeps search results for 5 minutes and is suspected of not telling one company's results from another's; if B shows A's jobs, the case fails and the report names this. After B: **1.** The address has `company=<B>`, the dropdown shows B, and every job on the first page shows B, not A. **2.** The first page is not the same as A's. |
| FI-4 | One company, then another, by the address | `/job-search?title=nurse&company=<A>` | Open the page for company A by the address, then change only `company` in the address to B and open it. | Same as FI-3: B's jobs, not A's. |
| FI-5 | Company and city together | `/job-search?title=nurse` | Pick the city with the most jobs, then pick, from the Company dropdown as it now is, the company with the most jobs. | **1.** The address has both `loc` and `company`, and both dropdowns show them. **2.** Every job listed shows that company and that city. **3.** The total is the same as or smaller than the city filter alone. |
| FI-6 | A company with no jobs, by the address | `/job-search?title=nurse&company=No Such Company Playwright` | Open the page by the address. | The friendly empty state ("No results found." or a similar sentence), no jobs, no pager, no error. |
| PG-1 | The pager shows only when needed | `/job-search?title=nurse` | 1. Look at the pager. 2. Find a filter that leaves 10 or fewer jobs (try the Company dropdown's companies from the one with the fewest jobs up; stop at the first with a total of 1 to 10). | **1.** More than 10 jobs, so a pager shows. **2.** With 10 or fewer, every job is on one page and there is no pager. If no company leaves 10 or fewer, the step is skipped and the report says so. |
| PG-2 | Paging to page 2 | `/job-search?title=nurse&location[text]=Saint Paul, MN&sort=job-title-asc` | Note the first page's jobs, then click page 2 (or "Next"). | **1.** The address has `page=1` (the pager counts from 0) and still has `title`, `location[text]` and `sort`; the form still shows them. **2.** 10 jobs are listed, none of them on page 1. **3.** The total is unchanged. **4.** The pager marks page 2 as current. |
| PG-3 | Paging to the last page | `/job-search?title=nurse` | Click "Last" (or the highest page number). | **1.** The address keeps `title=nurse`. **2.** 1 to 10 jobs are listed, none of them on page 1. **3.** The pager has no "Next" or "Last". **4.** The last page is no further than the 500-job cap allows (page 50, `page=49`). |
| PG-4 | A page number past the end, by the address | `/job-search?title=nurse&page=999` | Open the page by the address. | **1.** No error. **2.** Either the last page of results shows, or the friendly empty state with a pager (or link) back to the results. **3.** The keyword is kept. |
| PG-5 | A negative or non-number page | `/job-search?title=nurse&page=-1`, then `&page=abc` | Open each by the address. | **1.** No error. **2.** Each shows the first page of results, the same jobs as `/job-search?title=nurse`. |
| UR-1 | Every form keeps the others' values | `/job-search` | 1. Search "nurse" with Location "55101" and Distance "50 miles". 2. Change Sort to "Company". 3. Pick the company with the most jobs. 4. Search again from the Keyword form (change nothing, click "Search"). 5. Change Sort to "Date posted". | After every step the address and the form hold everything chosen so far; nothing is dropped by either re-submit. **1.** `title=nurse`, `location[text]=55101` and `radius=50`. **2.** Also the sort. **3.** Also `company`, and every job listed shows the chosen company. **4.** Everything is kept, and every job listed shows the chosen company. **5.** The new sort, with everything else kept, and every job listed shows the chosen company. |
| UR-2 | Back and Forward keep the search | `/job-search` | Run three searches in a row ("nurse"; "welder" with Location "Duluth, MN"; "teacher" with Sort "Job title"), then click Back twice, then Forward twice. | **1.** Each Back and Forward shows that search's address, its form values (Keyword, Location, Distance, Sort) and its jobs: the same first-page jobs as when it was first run. **2.** No form shows the values of a different search. |
| UR-3 | A search opened somewhere else | `/job-search?title=nurse&location[text]=55101&radius=50&sort=company-asc&company=<A>&page=1` | Open UR-1's search (with `page=1`) in one browser, copy the address, and open it in a fresh browser that has never visited the site. | The fresh browser shows the same form values (Keyword, Location, Distance, Sort, Company), the same total and the same jobs as the first. |

## Good to know

- **The jobs come from an outside job feed** (CareerOneStop), so no case
  names a job, company or city, and none checks an exact count. They use
  whatever "nurse" returns: the companies and cities with the most jobs at
  the time. Each case compares the site with itself (before and after a
  step), never with a number written here.
- **The site keeps a search's results for 5 minutes**, and the company may
  not be part of what it remembers. That's what FI-3 and FI-4 check. Run
  them within a minute of each other so the earlier results are still kept.
- **Sort values:** `best-match` (Relevance, the default),
  `date-posted-desc`, `job-title-asc`, `company-asc`.
- **The pager counts from 0:** page 2 is `page=1`. The count stops at 500,
  so there are at most 50 pages.
- **Comparing titles and companies:** letter case and leading or trailing
  spaces are ignored. Other characters are compared as they are.
- **"Posted … ago":** minutes before hours before days before weeks before
  months. "Available … ago" is read the same way.

## Mobile

Every case runs on desktop (`functional-desktop`). On the phone
(`functional-mobile`, Pixel 7) only the cases that use the page's controls in
a different way run: SO-5, FI-1, FI-5, PG-2 and UR-1, through the Filters
drawer. The others are `@desktop-only`, because sorting, filtering and paging
happen on the server and checking them once is enough. On the phone each case
also checks that the page doesn't scroll sideways.

## Expected result

| Project | Runs | Cases |
|---|---|---|
| `functional-desktop` | 20 | SO-1 to SO-6, FI-1 to FI-6, PG-1 to PG-5, UR-1 to UR-3 |
| `functional-mobile` | 5 | SO-5, FI-1, FI-5, PG-2, UR-1 |

## Not covered

- **Reset** and the homepage hand-over: smoke JF-5 and JS-2.
- **Saving a sorted or filtered search:** part 4 (logged in).
- **Whether the order within equal values is stable** (two jobs with the
  same title or company). Only the order of different values is checked.
