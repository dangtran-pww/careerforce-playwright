# [Functional] - Job Search - Logged-in Job Seeker - Test Plan

Status: ready to generate
Implemented test: —

## Overview

Part 4 of 4 of the functional plans for Job Search (`/job-search`). It tests
everything Job Search offers a logged-in job seeker: bookmarking jobs, saving
searches, the "Jobs for me" selector (bookmarked jobs, saved searches, career
goals and in-demand jobs), finishing a bookmark or saved search after logging
in from the visitor's dialog, and keeping one person's jobs and searches
private.

The other parts:
[functional-job-search-search.md](functional-job-search-search.md)
(the search itself),
[functional-job-search-sort-filters-paging.md](functional-job-search-sort-filters-paging.md)
(sort, filters, paging and the address) and
[functional-job-search-posting-accessibility.md](functional-job-search-posting-accessibility.md)
(one job on its own, phone layout, keyboard and accessibility).

The basic saved-search and dashboard journeys are already in
[smoke-job-search.md](smoke-job-search.md): save a search (SS-1), run it
from Jobs for me (SS-2), the 5-search limit (SS-3), and listing, opening and
removing saved searches and bookmarks on the dashboard (MD-1 to MD-6). This
plan doesn't repeat them. It covers what they don't: every value a saved
search keeps, names, duplicates, the 15-bookmark limit, two tabs at once,
career goals, in-demand jobs and the user's region, the log-in hand-off,
and privacy.

Almost every case saves, bookmarks or changes something on the job seeker
account, so they run on **QA and Stage only**, tagged `@no-prod`. Each one
removes or puts back what it changed, even when it fails. PV-4 and PV-5
change nothing, so they may run on Production (PV-4 only once there is a job
seeker login for Production; PV-5 runs as a visitor).

## Login

| | |
|---|---|
| **Role** | `jobseeker`: `playwright/.auth/<env>/jobseeker.json`, from `npm run login:manual -- jobseeker`. Job seekers log in with LoginMN. PV-4 and PV-5 also use a fresh browser that isn't logged in. |
| **Test account** | A job seeker account used only for testing, never a person's own (see [Open questions](#open-questions)). Before a run it needs: at most 3 saved searches, at most 10 bookmarked jobs, at most 5 career goals, and "My Region" set to a Minnesota city (the cases note it and put it back). |
| **Site password gate** | QA and Stage ask for the `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` from `.env` ([one-time setup](README.md#one-time-setup)). |
| **Accounts touched** | The job seeker account: saved searches, bookmarked jobs, career goals and My Region. Every case removes or puts back only what it added or changed, matched by name (`Playwright test <timestamp>`), job ID or occupation code. It never removes anything it didn't add. |

## Running it

First time? Do the [one-time setup](README.md#one-time-setup). Then, on QA
or Stage only:

```bash
npm run login:manual -- jobseeker
BASE_URL=https://qa.careerforce.link npx playwright test tests/functional/job-search/logged-in --project=functional-desktop
```

`tests/functional/job-search/logged-in/` holds this plan's specs. MO-1 is the
only case for the phone:

```bash
BASE_URL=https://qa.careerforce.link npx playwright test tests/functional/job-search/logged-in --project=functional-mobile
```

Add `--ui` to [watch it run](README.md#watching-a-run), or put
`SCREENSHOT=on` in front to
[save a screenshot of every test](README.md#screenshots-of-every-test).

## Checked in every case

- **No JavaScript error** in the browser console.
- **No failed request** to the site itself (no 4xx or 5xx answer from the
  CareerForce host), except where a case expects one.
- **No raw error on the page**, and no browser `alert()` with an error.
- **Clean up:** after the case, the account's saved searches, bookmarks,
  career goals and My Region are what they were before it.

## Test cases

"Page" is the address after the site name. "The dashboard" is the job
seeker's account page, `/user` (it opens `/user/<their user ID>`). "Jobs for
me" is the block on Job Search with two dropdowns: a group (Bookmarked jobs,
Saved searches, Career goals, In demand jobs), then an item in it. A job
"is bookmarked" when its bookmark icon is in its "remove bookmark" state.

### The page as a job seeker

`tests/functional/job-search/logged-in/page.spec.ts`

| ID | Test | Page | Steps | Expected result | Required login | Prod |
|---|---|---|---|---|---|---|
| LI-1 | Job Search shows the job seeker's own tools | `/job-search?title=nurse` | Open the page. Look at Jobs for me, "Save search" and the bookmark icons. Watch the requests the page makes. | No "Customize my search" button. Jobs for me shows its group dropdown, listing only the groups that have items for this account. "Save search" opens "Save this search to your dashboard", not the login dialog (close it without saving). Each job's bookmark icon is in its "add" or "remove" state, not a link to the login dialog. The page tells the job seeker tools tracker about the visit: a request to `/careerforce/jobseeker-tools-tracker?active_path=/job-search` answers 2xx. | `jobseeker` | No: logs in as the job seeker |

### Bookmarks

`tests/functional/job-search/logged-in/bookmarks.spec.ts`

| ID | Test | Page | Steps | Expected result | Required login | Prod |
|---|---|---|---|---|---|---|
| BK-1 | A bookmark stays, and the search isn't disturbed | `/job-search?title=nurse&sort=job-title-asc&page=1` | Scroll to a job that isn't bookmarked and click its bookmark icon. Reload. Then open the same job's "Read more". **Cleanup:** remove the bookmark. | The icon switches to "remove bookmark" without loading a new page: the address, the scroll position and the jobs listed stay the same. After the reload it is still bookmarked, and on its own page too. | `jobseeker` | No: bookmarks and removes on the job seeker account |
| BK-2 | Bookmark from the job's own page | `/job-search?jvid=<first job of a "nurse" search>` | Open a job that isn't bookmarked on its own. Click its bookmark icon. Open the dashboard. Open `/job-search` and pick Jobs for me → "Bookmarked jobs". **Cleanup:** remove the bookmark. | The icon switches to "remove bookmark". The dashboard lists the job by its title. Jobs for me → "Bookmarked jobs" lists it too, and picking it opens that job on its own (`?jvid=<same ID>`). | `jobseeker` | No: bookmarks and removes on the job seeker account |
| BK-3 | Double-click doesn't leave a mess | `/job-search?title=nurse` | Double-click the bookmark icon of a job that isn't bookmarked. Wait for the page to settle. Reload. Open the dashboard. **Cleanup:** remove the bookmark if it's there. | After the reload the icon and the dashboard agree: either the job is bookmarked and listed once, or it isn't bookmarked and isn't listed. The job is never listed twice. | `jobseeker` | No: bookmarks and removes on the job seeker account |
| BK-4 | Two tabs, one job | `/job-search?title=nurse` | Open the same search in two tabs. In tab 1, bookmark the first job that isn't bookmarked. In tab 2 (which still shows it as not bookmarked), click its bookmark icon. Reload both tabs and open the dashboard. **Cleanup:** remove the bookmark if it's there. | Tab 2's click doesn't silently undo tab 1's: after it, tab 2's icon shows the real state, and the job is bookmarked (or tab 2 says it already was). After the reloads both tabs and the dashboard agree, and the job is listed at most once. | `jobseeker` | No: bookmarks and removes on the job seeker account |
| BK-5 | Limit of 15 bookmarks | `/job-search?title=nurse` | Note how many bookmarks the account has. Bookmark jobs that aren't bookmarked (from page 1, then page 2) until it has 15. Then click the bookmark icon of one more job. **Cleanup:** remove every bookmark this case added. | The 16th is refused with a plain message on the page, such as "You can bookmark up to 15 jobs" (not a browser `alert()` with an error, and no HTTP error). Its icon stays in the "add" state. The dashboard and Jobs for me → "Bookmarked jobs" list exactly 15 jobs, and the 16th isn't among them. | `jobseeker` | No: bookmarks and removes on the job seeker account |

### Saved searches

`tests/functional/job-search/logged-in/saved-searches.spec.ts`. Every name
starts with `Playwright test <timestamp>`.

| ID | Test | Page | Steps | Expected result | Required login | Prod |
|---|---|---|---|---|---|---|
| SV-1 | Closing the dialog saves nothing | `/job-search?title=nurse` | Note the saved searches. Click "Save search", type a name, and press Esc. Do it again and close with the close button. | The dialog has a heading "Save this search to your dashboard", a labelled "Name job search" box, a Save button and a close button. Both ways close it, and the saved searches (Jobs for me and the dashboard) are unchanged. | `jobseeker` | No: saves and removes searches on the job seeker account |
| SV-2 | A name is needed | `/job-search?title=nurse` | Click "Save search". Leave the name empty and click Save. Then type only spaces and click Save. | Each time the dialog stays open with a message that the name is needed, next to the box. Nothing is saved. | `jobseeker` | No: saves and removes searches on the job seeker account |
| SV-3 | A saved search keeps every value | `/job-search` | Search "nurse" with Location "55101", Distance "50 miles", Sort "Company", the city with the most jobs, and then the company with the most jobs in that city. Save it. Open `/job-search` with no search, and pick it in Jobs for me → "Saved searches". Then open it from the dashboard. **Cleanup:** remove it. | Both ways open Job Search with `title=nurse`, `location[text]=55101`, `radius=50`, `sort=company-asc`, the same `loc` and the same `company` (the address may also have `delta=<n>`). The form shows every one of them, and the jobs are the same as when it was saved. | `jobseeker` | No: saves and removes searches on the job seeker account |
| SV-4 | Names are shown as typed | `/job-search?title=nurse` | Save a search named `Playwright test <timestamp> <b>Bold</b> & "R&D" <script>alert(1)</script>`. Look at it in Jobs for me and on the dashboard. **Cleanup:** remove it. | No alert opens. Jobs for me and the dashboard show the name exactly as typed, as plain text: not bold, no `&amp;` or other escape codes, no `<script>` element on the page. | `jobseeker` | No: saves and removes searches on the job seeker account |
| SV-5 | A long name | `/job-search?title=nurse` | Save a search with a 300-character name (`Playwright test <timestamp> ` followed by "x"s). **Cleanup:** remove it if it was saved. | Either the box stops at its limit (at least 128 characters) and the search saves with that name, or the dialog says the name is too long and nothing is saved. No error page. A saved long name fits on the dashboard and in Jobs for me without breaking the layout. | `jobseeker` | No: saves and removes searches on the job seeker account |
| SV-6 | Two searches with the same name | `/job-search?title=nurse`, then `/job-search?title=welder` | Save "nurse" as `Playwright test <timestamp> twin`. Save "welder" with the same name. Open each from the dashboard. Remove the second one (the welder search) from the dashboard. **Cleanup:** remove what's left. | Either the second save is refused with a message that the name is taken, or both are saved and each opens its own search (nurse and welder). In the second case, removing the welder search removes only that one: the nurse search is still listed and still opens "nurse". | `jobseeker` | No: saves and removes searches on the job seeker account |
| SV-7 | Removing the right search when another tab changed the list | `/user` | Save two searches, A then B. Open the dashboard in two tabs. In tab 1, remove A. In tab 2 (which still lists A then B), remove B. Reload the dashboard. **Cleanup:** remove whatever is left of A and B. | Tab 2's remove removes B, not some other search. After the reload neither A nor B is listed, and every search that was there before the case is still listed. | `jobseeker` | No: saves and removes searches on the job seeker account |
| SV-8 | Room again after removing one | `/job-search?title=nurse` | Save searches until the account has 5. Remove one of them (one this case added) from the dashboard. Save one more. **Cleanup:** remove every search this case added. | With 5 saved, the dialog warns "You have already reached the limit for saved jobs." After removing one, the dialog shows no warning, and the new search saves and is listed in Jobs for me without reloading the page. | `jobseeker` | No: saves and removes searches on the job seeker account |
| SV-9 | Save a search with nothing searched | `/job-search` | With nothing after `/job-search`, save a search. Open it from Jobs for me. **Cleanup:** remove it. | It saves. Opening it shows Job Search with no keyword, location, sort or filters set, and jobs listed, the same as `/job-search` with nothing after it. | `jobseeker` | No: saves and removes searches on the job seeker account |

### Jobs for me

`tests/functional/job-search/logged-in/jobs-for-me.spec.ts`

| ID | Test | Page | Steps | Expected result | Required login | Prod |
|---|---|---|---|---|---|---|
| JM-1 | Jobs for me matches the account | `/job-search` | Bookmark one job and save one search, so both groups have items. Open the dashboard and note its saved searches and bookmarked jobs. On Job Search, pick each group in Jobs for me in turn. **Cleanup:** remove the bookmark and the search. | The group dropdown is labelled and lists only groups with items. After picking a group, the item dropdown shows the placeholder "Select <group>" and lists that group's items. "Saved searches" lists the same names as the dashboard, in the same order; "Bookmarked jobs" lists the same jobs. Picking a group alone doesn't leave the page; picking an item does. | `jobseeker` | No: bookmarks and saves on the job seeker account |
| JM-2 | Career goals lead to their jobs | `/explore/careers/29-1141.00` | If "Registered Nurses" isn't already a career goal, click "Add to career goals". Open `/job-search`, pick Jobs for me → "Career goals" → "Registered Nurses". **Cleanup:** if the case added the goal, click "Remove from career goals". | Jobs for me → "Career goals" lists "Registered Nurses" (and every other goal on the account's Goals & Experience page). Picking it opens Job Search with `title=Registered Nurses (29-1141.00)`, the Keyword box shows it, at least 1 job is listed, and at least half of the first page's titles contain "nurs" or "RN". | `jobseeker` | No: adds and removes a career goal on the job seeker account |
| JM-3 | In-demand jobs lead to their jobs | `/job-search` | Pick Jobs for me → "In demand jobs". Note the list. Pick the first one. | The list has 1 to 10 occupations. Picking one opens Job Search with `title=<occupation> (<code>)` and the Keyword box showing it. Jobs are listed, or the friendly empty state shows with no error. | `jobseeker` | No: logs in as the job seeker |
| JM-4 | In-demand jobs follow My Region | `/user` | Note the account's My Region and the In demand jobs list (JM-3). On the dashboard, set My Region to "Duluth, MN" (Northeast) and note the list; then to "Saint Paul, MN" (Metro). **Cleanup:** set My Region back to what it was (or clear it, if it was Statewide). | The In demand jobs list for Duluth is not the same as the list for Saint Paul (different occupations or a different order). After the cleanup, the list is the same as at the start. | `jobseeker` | No: changes My Region on the job seeker account |
| JM-5 | Browsing the items with the keyboard doesn't leave the page | `/job-search` | With "Saved searches" (at least 2 items) picked, Tab to the item dropdown and press Down once, without opening it. | The page doesn't navigate just because the highlighted item changed. It goes to the search only when the choice is confirmed (Enter, or a "Go" button). | `jobseeker` | No: logs in as the job seeker |

### Finishing an action after logging in

`tests/functional/job-search/logged-in/login-handoff.spec.ts`. A visitor who
clicks Bookmark or Save search is sent to log in, and comes back to
`/job-search?<their search>#bookmark[<job ID>]` or `#save-search` (part 3,
PO-9). These cases open that return address as the logged-in job seeker,
which is what the browser does after a real login.

| ID | Test | Page | Steps | Expected result | Required login | Prod |
|---|---|---|---|---|---|---|
| HO-1 | Coming back to save a search | `/job-search?title=nurse#save-search` | Open the address. Name the search and save. **Cleanup:** remove it. | The "Save this search to your dashboard" dialog opens by itself. After saving, it's listed in Jobs for me and on the dashboard, and opening it gives `title=nurse` (without `#save-search`). | `jobseeker` | No: saves and removes a search on the job seeker account |
| HO-2 | Coming back to bookmark a job | `/job-search?title=nurse#bookmark[<ID of a job that isn't bookmarked>]` | Open the address. Finish the bookmark if a dialog asks. **Cleanup:** remove the bookmark. | The job gets bookmarked: the page reloads without the `#bookmark[…]` part, and that job's icon is in its "remove bookmark" state. The dashboard lists it once. | `jobseeker` | No: bookmarks and removes on the job seeker account |
| HO-3 | Coming back to a job that's already bookmarked | `/job-search?title=nurse#bookmark[<ID of a bookmarked job>]` | Bookmark a job. Open the address with its ID. **Cleanup:** remove the bookmark. | A plain message says it's already bookmarked. It stays bookmarked (not removed) and is listed once on the dashboard. | `jobseeker` | No: bookmarks and removes on the job seeker account |
| HO-4 | Coming back with a job ID that doesn't exist | `/job-search?title=nurse#bookmark[00000000000000000000000000000000]`, then `#bookmark[nothex]` | Open each address. | A plain message (or nothing at all) and the search as usual. No error, no alert, and nothing new on the dashboard. | `jobseeker` | No: logs in as the job seeker |

### Privacy and security

`tests/functional/job-search/logged-in/privacy.spec.ts`

| ID | Test | Page | Steps | Expected result | Required login | Prod |
|---|---|---|---|---|---|---|
| PV-1 | A job seeker's page isn't shown to a visitor | `/job-search?title=nurse` | As the job seeker, bookmark the first job and open the page. Within a minute, open the same address in a fresh browser that isn't logged in. Then, the other way round, open a new search (`/job-search?title=welder`) as a visitor first and then as the job seeker. **Cleanup:** remove the bookmark. | The visitor sees the visitor's page: "Customize my search", bookmark icons that open the login dialog, and no "remove bookmark" state, saved search names or bookmarked titles anywhere. The job seeker, after the visitor, sees their own tools as in LI-1. | `jobseeker` | No: bookmarks and removes on the job seeker account |
| PV-2 | The bookmark link needs the page's security token | the bookmark icon's link | Note the address the first job's bookmark icon calls (`/careerforce/ajax/job-post/add/<ID>?token=…`). As the job seeker, open it with the token removed, then with a wrong token. Open the dashboard. | Both are refused (403 or similar), and the job is not bookmarked or un-bookmarked. | `jobseeker` | No: logs in as the job seeker |
| PV-3 | The remove-search link needs the page's security token | the dashboard's "x" link for a saved search | Save a search. Note its "x" link (`/careerforce/ajax/job-search/remove/<n>/<hash>?token=…`). Open it with the token removed, then with a wrong token. Reload the dashboard. **Cleanup:** remove the search. | Both are refused, and the search is still listed. | `jobseeker` | No: saves and removes a search on the job seeker account |
| PV-4 | Someone else's dashboard is private | `/user/1` | As the job seeker, open `/user/1` (another account). | "Access denied" (403) or "Page not found". No other user's saved searches or bookmarked jobs show. | `jobseeker` | Yes |
| PV-5 | The job seeker's tools refuse a visitor | `/careerforce/ajax/jobs-for-me`, `/careerforce/forms/job_search_authenticated_modal`, `/careerforce/ajax/job-post/add/<a job ID>` | In a fresh browser that isn't logged in, open each address. | Each is refused (403, or sent to the login page). None returns a list of searches or jobs, a save form, or a bookmark. |  | Yes |

### On a phone

`tests/functional/job-search/logged-in/mobile.spec.ts`, `@mobile-only`.

| ID | Test | Page | Steps | Expected result | Required login | Prod |
|---|---|---|---|---|---|---|
| MO-1 | Save, bookmark and Jobs for me on a phone | `/job-search?title=nurse` | Open "Filters", click "Save search", name it and save. Bookmark the first job that isn't bookmarked. Pick the saved search in Jobs for me. **Cleanup:** remove the search and the bookmark. | The save dialog opens on top of the drawer and fits the screen. The search saves and Jobs for me lists it without a reload. The bookmark icon can be tapped and switches state. Jobs for me's dropdowns can be used and open the saved search. No page scrolls sideways. | `jobseeker` | No: saves, bookmarks and removes on the job seeker account |

## Good to know

- **Limits:** 15 bookmarked jobs, 5 saved searches and 6 career goals per
  account. The test account's starting point (see [Login](#login)) leaves
  room for every case. BK-5 and SV-8 fill the account up to the limit and
  then remove only what they added.
- **Bookmarking is a toggle.** The same link adds and removes a bookmark
  (the dashboard's "x" uses it too), which is why BK-3 and BK-4 check double
  clicks and two tabs.
- **A saved search keeps the address of the page it was saved from**, so
  SV-3 saves from the results page, not the empty page.
- **Jobs for me updates without a reload when a search is saved.** After a
  bookmark, it updates on the next page load; the cases reload before
  checking it.
- **Career goals and in-demand jobs** come from the account (Goals &
  Experience, `/user/<ID>/skills-experience`) and from DEED's labour-market
  data for the account's region (My Region on the dashboard; Statewide when
  it isn't set). The jobs themselves come from the outside job feed, so no
  case checks an exact count.
- **The log-in hand-off can't be done end to end:** LoginMN can't be driven
  by a test. HO-1 to HO-4 start from the address the browser comes back to.
- **One account, one run at a time.** Two runs on the same account would
  change each other's saved searches and bookmarks. Keep `workers: 1`.

## Mobile

Every case except MO-1 runs on desktop only (`@desktop-only`), like every
data-changing test. MO-1 runs on the phone only (`@mobile-only`,
`functional-mobile`, Pixel 7).

## Expected result

| Project | Runs | Cases |
|---|---|---|
| `functional-desktop` on QA or Stage | 29 | LI-1, BK-1 to BK-5, SV-1 to SV-9, JM-1 to JM-5, HO-1 to HO-4, PV-1 to PV-5 |
| `functional-desktop` on Production | 2 | PV-4, PV-5 |
| `functional-mobile` on QA or Stage | 1 | MO-1 |

## Not covered

- **Already in the smoke plan:** saving a search and seeing it in Jobs for
  me (SS-1, SS-2), the 5-search limit (SS-3), and the dashboard's lists,
  links and remove links (MD-1 to MD-6).
- **A real login through LoginMN** from the visitor's dialog, and creating
  an account. Only the return to Job Search is tested (HO-1 to HO-4).
- **An expired bookmarked job** (greyed out on its own page, can't be
  bookmarked again). It needs a job the feed has dropped, which can't be set
  up on purpose.
- **Jobs for me with no items at all.** It would mean emptying the test
  account's bookmarks, searches and goals, and its in-demand list can't be
  emptied.
- **Logging out.** It would end the saved session that the other cases use.
  PV-1 checks the visitor's view from a separate browser instead.
- **Staff and partners** (other roles) on Job Search.

## Open questions

1. **A dedicated job seeker test account** on QA and Stage, with the
   starting point in [Login](#login), so these cases never touch a real
   tester's data. The smoke plan asks for the same account.
2. **SV-6, duplicate names:** should a second search with the same name be
   refused, or saved? The case accepts either, as long as each saved search
   keeps working on its own.
3. **SV-5, the longest name allowed.** The case expects at least 128
   characters. If the product sets a limit, put it here.
4. **JM-5:** if the product wants Jobs for me to change page on every
   arrow key, this case fails by design and needs a decision (WCAG 3.2.2,
   "On Input", says a change of setting shouldn't change the page without
   warning).
