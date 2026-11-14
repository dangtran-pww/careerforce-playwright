# [Functional] - Job Search - Search - Test Plan

Status: implemented
Implemented test: tests/functional/job-search/search.spec.ts

## Overview

Part 1 of 4 of the functional plans for Job Search (`/job-search`). It tests
the search itself in depth: the page as it first loads, keyword and location
together, every location format the site understands, distance, an empty
search, an occupation (SOC) keyword, bad and hostile input, and the location
suggestions.

The other parts:
[functional-job-search-sort-filters-paging.md](functional-job-search-sort-filters-paging.md)
(sort, filters, paging and the address),
[functional-job-search-posting-accessibility.md](functional-job-search-posting-accessibility.md)
(one job on its own, phone layout, keyboard and accessibility) and
[functional-job-search-logged-in.md](functional-job-search-logged-in.md)
(everything a logged-in job seeker can do).

Every case runs as a visitor who isn't logged in and changes nothing, so the
whole plan is safe on QA, Stage and Production. The quick post-deploy checks
of the same page are in [smoke-job-search.md](../smoke/smoke-job-search.md); this plan
doesn't repeat them.

The cases come from the manual test session in
`docs/prompts/job-search-part-1-search.md`: SE-1 is A1, SE-2 is A2, SE-3 is
A3, SE-4 and SE-5 are A4, SE-6 is A5, SE-7 is A6, SE-8 to SE-11 are A7, and
SE-12 is A8.

## Login

| | |
|---|---|
| **Role** | None. A visitor who isn't logged in. No saved session is loaded. |
| **Accounts touched** | None. |

## Running it

First time? Do the [one-time setup](../README.md#one-time-setup).

```bash
BASE_URL=https://qa.careerforce.link npx playwright test tests/functional/job-search/search.spec.ts --project=functional-desktop
BASE_URL=https://qa.careerforce.link npx playwright test tests/functional/job-search/search.spec.ts --project=functional-mobile
```

Add `--ui` to [watch it run](../README.md#watching-a-run), or put
`SCREENSHOT=on` in front to
[save a screenshot of every test](../README.md#screenshots-of-every-test).

## Checked in every case

These hold after every step of every case, and a case fails if one doesn't:

- **No JavaScript error** in the browser console.
- **No failed request** to the site itself (no 4xx or 5xx answer from the
  CareerForce host). Requests to other sites are not checked.
- **No raw error on the page:** no "The website encountered an unexpected
  error", no PHP or Drupal error message, no stack trace.
- **The address holds the search.** Every form uses GET, so whatever was
  searched is in the address (`title`, `location[text]`, `radius`, …) and
  still shows in the form after the page loads.

## Test cases

"Page" is the address after the site name, for example `/job-search` means
`qa.careerforce.link/job-search`. "Search" means typing in the form and
clicking "Search", not editing the address, unless the case says otherwise.

`tests/functional/job-search/search.spec.ts`

| ID | Test | Page | Steps | Expected result |
|---|---|---|---|---|
| SE-1 | Everything is on the page when it first loads | `/job-search` | Open Job Search with nothing after `/job-search` and look at the whole page. | The page shows: **1.** **Search form:** a "Keyword" box, empty, with the hint "Title, Company or Description"; a "Location" box, empty, with the hint "City, State or ZIP code"; a "Distance" dropdown set to "20 miles"; a "Search" button. **2.** **Sort:** a Sort dropdown showing "Relevance". **3.** **Filters:** a Company dropdown, a City dropdown ("List of cities"), a "Save search" link and a "Reset" link. **4.** **Results:** a count ("Showing … jobs"), 10 jobs, and a pager (there are more than 10). Each job shows a title, a company, a location, a short description, a "Posted … ago" or "Available … ago" label, a "Learn more and apply" link, a "Share" button, a "Read more" link and a bookmark icon. **5.** **Banner:** "Get matched with the right jobs" with a button that leads to the Skills Matcher. **6.** **Jobs for me:** its intro text and a "Customize my search" button. **7.** **Services** and **Resources** blocks show below. |
| SE-2 | Keyword and city | `/job-search` | Type "nurse" in Keyword and "Saint Paul, MN" in Location (type it, don't pick a suggestion), and search. | **1.** The address has `title=nurse` and `location[text]=Saint Paul, MN`. **2.** The Keyword box shows "nurse". **3.** The Location box shows "Saint Paul, MN" or its normal form "St. Paul, MN", nothing else. **4.** At least 1 job is listed, every job on the first page is in Minnesota (its location ends in ", MN"), and at least half of the first page's job titles contain "nurs" (letter case ignored). |
| SE-3 | Every location format | `/job-search` | One test per location: for each location in [the table below](#se-3-locations), type "nurse" in Keyword and the location in Location, and search. | For each location: **1.** What the table says. **2.** The Location box keeps the location as typed or in its normal form, and the Keyword box keeps "nurse". |
| SE-4 | Distance widens a ZIP search | `/job-search` | 1. Search "nurse" with Location "55101" and Distance at its smallest ("5 miles"), and note the total ("Showing N jobs"). 2. Search again with Distance at its largest ("100 miles"). | **1.** The address has `radius=5` and the Distance dropdown shows it. At least 1 job is listed. **2.** The address has `radius=100` and the Distance dropdown shows it. At least 1 job is listed, and the 100-mile total is the same as or larger than the 5-mile total. (Both can show 500, the cap.) |
| SE-5 | Distance makes no difference to a city search | `/job-search` | 1. Search "nurse" with Location "Duluth, MN" and Distance "5 miles", and note the total and the first page's job titles. 2. Search again with "100 miles". | **1.** The address and the Distance dropdown show 5 miles. At least 1 job is listed. **2.** The address and the Distance dropdown change to 100 miles. At least 1 job is listed, with the same total as at 5 miles and the same jobs, in the same order, on the first page. |
| SE-6 | Empty search shows all Minnesota jobs | `/job-search` | Leave Keyword and Location empty and click "Search". | **1.** The page loads with `title` and `location[text]` empty (or not in the address). **2.** At least 1 job is listed, with the same total as `/job-search` with nothing after it, and every job on the first page is in Minnesota (its location ends in ", MN"). **3.** The Keyword and Location boxes are still empty. |
| SE-7 | Occupation (SOC) keyword | `/job-search?title=Registered Nurses (29-1141.00)` | Open the page (this is how career pages and "Jobs for me" link to Job Search). | **1.** The Keyword box shows "Registered Nurses (29-1141.00)" exactly. **2.** At least 1 job is listed, and at least half of the first page's job titles contain "nurs" or "RN" (letter case ignored). |
| SE-8 | Nonsense keyword | `/job-search` | Type "zzqxqzz" in Keyword and search. | **1.** A friendly empty state: "No results found." (or a similar plain sentence), no jobs, no pager. **2.** The Keyword box still shows "zzqxqzz". **3.** The Company and City dropdowns are empty or hidden, with no error. |
| SE-9 | Special characters in the keyword | `/job-search` | Type `C++ & "R&D"` in Keyword and search. | **1.** The address carries the keyword encoded (`title=C%2B%2B+%26+%22R%26D%22`, or the same with `%20` for spaces). **2.** The Keyword box shows `C++ & "R&D"` exactly: no `&amp;`, `&quot;` or other escape codes, and nothing cut off. **3.** Either jobs are listed or the friendly empty state from SE-8 shows. |
| SE-10 | A 300-character keyword | `/job-search` | Type a 300-character keyword ("registered" 30 times, no spaces) and search. | **1.** The page loads normally: no "Request-URI Too Long" or other error page. **2.** If the Keyword box has a length limit, the box holds the first characters up to that limit; otherwise it holds all 300 characters. **3.** Either jobs are listed or the friendly empty state from SE-8 shows. |
| SE-11 | Script and HTML in the search are shown as text | `/job-search` | 1. Type `<script>alert(1)</script>` in Keyword and search. 2. Type it in Location and search. 3. Open these addresses directly: `/job-search?title="><img src=x onerror=alert(1)>`, then the same value in `location[text]`, `company` and `loc`. | At every step, no alert or other dialog opens, and the page gains no `<script>` element and no `<img>` with an `onerror` from the search. Anywhere the page repeats the search (the boxes, the empty-state message, the Company and City dropdowns, the page title), it shows the characters, not an element. **1.** The Keyword box shows the typed text as plain text. **2.** The Location box shows the typed text as plain text. **3.** For `title` and `location[text]`, the Keyword and Location boxes show the value as plain text. |
| SE-12 | Location suggestions | `/job-search` | 1. Type "Roch" in Location. 2. Pick "Rochester, MN" from the suggestions. 3. Type "nurse" in Keyword and search. | **1.** A list of suggestions opens under Location within a few seconds. Every suggestion contains "Roch", and every one is in Minnesota, Wisconsin, South Dakota, North Dakota or Iowa (it ends in ", MN", ", WI", ", SD", ", ND" or ", IA", or the full state name). "Rochester, MN" is among them. **2.** Picking it puts "Rochester, MN" in the box and closes the list. **3.** The address has `location[text]=Rochester, MN`, and at least 1 job is listed. |

## Test data

### SE-3 locations

| Location typed | Expected result |
|---|---|
| `55101` | The address has `location[text]=55101`. At least 1 job, and every job on the first page is in Minnesota. |
| `Minneapolis, Minnesota` | At least 1 job, and every job on the first page is in Minnesota. The Location box shows "Minneapolis, Minnesota" or "Minneapolis, MN". |
| `Fargo, ND` | At least 1 job, and every job on the first page is in North Dakota or Minnesota (Fargo–Moorhead). |
| `USA` | At least 1 job. The first page may list jobs from any state. |
| `MN` | At least 1 job, and every job on the first page is in Minnesota. |
| `Chicago, IL` | At least 1 job, and every job on the first page is in Illinois. Illinois isn't one of the states the site rewrites, so the location goes to the job feed as typed; "City, ST" is a format the feed accepts. If the page shows "No results found." instead, the case fails: see [Open questions](#open-questions). |

## Good to know

- **The jobs come from an outside job feed** (CareerOneStop), live on every
  search, so no case names a job or company and none checks an exact count.
  The cases check that jobs are listed and that they fit the search.
- **How the site rewrites a location** before it asks the feed: "US" or
  "USA" becomes "United States"; a 5-digit ZIP is sent as the ZIP;
  "<city>, <MN, WI, SD, ND or IA, or the full state name>" becomes
  "City, ST", with "St" and "Saint" written "St."; anything else is sent as
  typed.
- **Distance only changes the results for a ZIP.** For a city or state the
  feed ignores it, which is what SE-5 checks.
- **A keyword like `Registered Nurses (29-1141.00)`** is searched by the
  occupation code alone. Career pages and "Jobs for me" use this form.
- **Defaults:** location MN, distance 20 miles, sort Relevance, 10 jobs per
  page. The count stops at 500.
- **"In Minnesota"** means the job's location line ends in ", MN" (or
  "Minnesota"). A job with no location fails the check.

## Mobile

Every case runs on desktop (`functional-desktop`) and on an emulated phone
(`functional-mobile`, Pixel 7), and on the phone each case also checks that
the page doesn't scroll sideways. SE-4, SE-5 and SE-9 to SE-11 are desktop
only (`@desktop-only`): what they check happens on the server, so once is
enough.

## Expected result

| Project | Runs | Cases |
|---|---|---|
| `functional-desktop` | 17 | SE-1 to SE-12 (SE-3 is 6 tests, one per location) |
| `functional-mobile` | 12 | SE-1 to SE-3, SE-6 to SE-8, SE-12 (SE-3 is 6 tests) |

## Not covered

- **Sort, filters, paging and the address:** part 2.
- **One job on its own, phone layout and accessibility:** part 3.
- **The homepage Job Search box:** smoke JS-2.
- **How far away each job is.** The feed doesn't show a distance, so SE-4
  only compares totals.

## Open questions

1. **Locations outside the five states (SE-3, "Chicago, IL").** Should the
   site search them, or only Minnesota and its neighbours? The case expects
   them to work, because the Location box accepts them and the feed supports
   them. If the answer is "Minnesota and neighbours only", the expected
   result should become a clear message saying so.
2. **SE-2 and SE-7 count a job as a nursing job when its title contains
   "nurs" (or "RN"), and need at least half of the first page.** The feed
   also matches the description, so not every title will. Adjust the
   threshold if it proves too strict or too loose.
