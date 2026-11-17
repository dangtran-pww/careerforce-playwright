# [Smoke] - Admin Maintenance - Test Plan

Status: partially implemented
Implemented test: tests/smoke/admin-maintenance/*.spec.ts
Prod: No: rebuilds permissions and reindexes the search indexes.
Pending cases: AM-2 — Occupations only: re-run with the repeated "Index
now" runs (step 3). AM-1, AM-3 and AM-2's other three indexes passed on QA on
2026-11-16.

A quick check after each deploy that an admin can still run the site's
maintenance: rebuild content permissions, rebuild tracking and reindex each
search index, and then get results from the searches and filters that use
those indexes.

Devices: desktop only. Admin and editor screens are not tested on a phone (`DESKTOP_ONLY_SMOKE_AREAS` in `tests/helpers/devices.mts`).

Search-api maintenance and permissions rebuild, from the team's manual
checklist on Confluence,
[DEED Smoke Testing Template](https://portland-webworks.atlassian.net/wiki/spaces/MNDEED/pages/1540882433)
(the Stage run of 2026-10-30 also rebuilt and reindexed Appointment
Occurrences and Events More Like This, and searched both). These
are the admin write actions that the
[admin reports plan](smoke-admin-reports.md) deliberately leaves
out because they change site state.

## Login

| | |
|---|---|
| **Site login** | Required. Every case (AM-1 to AM-3) runs as a logged-in admin, including the search checks that a visitor could also do. |
| **Role** | `admin`: a PWW staff Google account that has admin rights on the environment being tested. It must be able to rebuild permissions (`/admin/reports/status/rebuild`) and manage Search API indexes (`/admin/config/search/search-api`). |
| **How to log in** | By hand, once per environment: `npm run login:manual -- admin --env <qa\|stage>` (without `--env`, it uses the environment `BASE_URL` in `.env` points at). A Chromium window opens on the login page. Click "PWW Staff Log In" and finish the Google sign-in. The session is saved as soon as you're back on the site, then close the window. The tests can't log in themselves: Google blocks sign-in from a browser Playwright controls. |
| **Saved session** | `playwright/.auth/<env>/admin.json`, one file per environment, shared with [smoke-admin-reports](smoke-admin-reports.md). A QA session doesn't work on Stage. |
| **When it expires** | Run the login command again. Each spec calls `useRole('admin')`, which checks the session before the first test; if it has expired, the tests fail with the login command to fix it. Drupal can also end the session early, e.g. when the same account logs in somewhere else. |
| **Environments** | QA and Stage only. The plan is no-prod (`Prod: No` in the header): AM-1 and AM-2 change site state, and AM-3 runs after AM-2. |

## Scope

- Rebuilding tracking and reindexing temporarily empties search results
  for that index.
- **Run off-peak.** Occupations is ~35k items; a full reindex takes minutes.
  Give these tests a much longer per-test timeout than the 60s default.
- Run manually for now. Scheduling it
  as part of regular runs is out of scope at this point.
- **Appointments data:** the tests don't create appointments, so AM-3's
  appointments check depends on the slots QA already has (about 1–3
  locations per day, Mon–Fri, about one week ahead). If the strip has no
  slots, it fails.
- **Searches in depth** (every filter, sort, the week strip, Reset, the
  address) are in the functional plans,
  [functional-events-search-detail](../events/functional-events-search-detail.md)
  and [functional-appointments-search](../appointments/functional-appointments-search.md).
  This plan only checks that the reindexed searches work.

## Persona / fixtures

- **Admin** — `playwright/.auth/<env>/admin.json`.
- No test data created. The tests don't create appointments; they use
  whatever slots QA already has (see "Appointments data" under Scope).

## Test cases

Every case runs as `admin`.

| ID | Test | Page | Steps | Expected result | Notes |
|---|---|---|---|---|---|
| AM-1 | Permissions rebuild completes | `/admin/reports/status/rebuild` | 1. Open the page. 2. Click "Rebuild permissions" and wait for the batch page to finish. | **1.** The heading reads "Are you sure you want to rebuild the permissions on site content?", with "Rebuild permissions" and "Cancel" buttons. **2.** A status message says the content permissions have been rebuilt, and there is no error message. | Source checklist: "should complete successfully with no errors/issues" |
| AM-2 | Rebuild tracking and reindex, per index | `/admin/config/search/search-api/index/<machine-name>` | Repeat for each of the 4 indexes below. 1. Open the index page. 2. Click "Rebuild tracking information"; on the confirm page, click "Confirm". 3. Click "Index now" and wait for the batch page to finish (it runs in the browser, not through cron). While the progress is below `N/N`, click "Index now" again, up to 5 runs in all. | **1.** The progress shows `N/N indexed` with N > 0, and "Index now" is disabled because nothing is left to index. **2.** The confirm page is `/admin/config/search/search-api/index/<machine-name>/rebuild-tracker` and asks "Are you sure you want to rebuild the tracking data for the search index <name>?". After confirming, back on the index page: a status message, the progress shows `0/N indexed`, and "Index now" is enabled. **3.** After each run, a status message says the batch finished, there is no error message, and more items are indexed than before the run. In the end the progress shows `N/N indexed`; the Status row (`.search-api-index-summary--status`) isn't marked as an error, and there is no error message. | Rebuild and reindex stay in one test per index so a failure never leaves an index empty and unnoticed. Why step 3 can take more than one run: while cron indexes, it holds the index's lock, a batch pass then indexes 0 items, and Search API ends the batch early with the warning "Number of indexed items is less than expected (by N)" (on QA on 2026-11-16, Occupations stopped at 12050/35280). Progress: `.search-api-index-status .progress__description`, the same selector AR-3 uses. The page also lists each datasource ("Datasource Content (2068/2068 indexed)"); see the counts below |
| AM-3 | Searches and filters work after reindex | See "Searches for AM-3" | After AM-2. 1. Run each of the 5 searches below with its keyword. 2. Run the two filter checks below: the events search with Format Online, and the appointments day from step 1 filtered by a format. | **1.** Each search returns results: a result count above 0, or at least one result where the page has no count. **2.** Each filter check's result is in the "Filter checks" column below. Never fixed counts, only relations to the unfiltered results. | Confirms every reindexed index is usable again, not just "indexed". Reuse `SearchPage` where the page uses the same view pattern (summary header + `.views-row`). The events search does **not** fit it — see "Events search page" below |

## Test data

### Indexes for AM-2

| Index | Machine name |
|---|---|
| Appointment Occurrences | `appointment_occurrences` |
| Events More Like This | `events_mlt` |
| General site content index | `general_site_content` |
| Occupations | `occupations` |

### Searches for AM-3

| Search | Index | URL | Keyword | Filter checks |
|---|---|---|---|---|
| Site search | `general_site_content` | `/search?k=<keyword>` | "job fair" | none |
| Events search | `general_site_content` | `/education-and-training/events?fq=<keyword>` | Run three times: empty (no filter), "job club", "job search" | Format Online (`?ff[virtual]=virtual`): the count is above 0 and no more than the unfiltered count, and every card's location contains "Online" |
| Appointments search | `appointment_occurrences` | `/connect-careerforce/schedule-an-appointment` | n/a, no keyword box. Walk the date strip from today until a day shows ≥ 1 location card (`.civiserv-location--appointments-for-booking`) with a booking link (`.appt-slots a[href*="/appointments/"]`); fail if no day in the strip has any. See "Appointments search page" below | That day filtered by the first format its first slot lists (`?start=<day>&format[<format>]=<format>`): at least 1 slot, every slot lists that format, and no more slots than the unfiltered day |
| Events more like this | `events_mlt` | "Similar Events" block on event detail pages (`/events/event-occurrence/<id>`) | n/a. Collect every event link from the events search (`a.cf-events-search-card-link`, all pager pages), pick 10 at random, and open each. Pass if **at least one** shows the block with ≥ 1 event; for every page that has the block, each similar-event link must point to `/events/event-occurrence/<id>` and not to the event itself. See "Similar Events block" below | none |
| Occupations | `occupations` | `/explore/careers?otitle=<keyword>` | Run three times: "taxi driver", "nurse", "project manager" | none |

### Index counts on QA

Counts on QA on 2026-11-12 (not asserted, they change with content). The
Confluence checklist still lists General 4351 and Occupations 26471, which
are out of date. Each index page shows the overall progress, one line per
datasource, and "There are N items indexed on the server"; the server count
is lower than the tracked count on every index except Occupations.

| Index | Progress | Datasources | On the server |
|---|---|---|---|
| Appointment Occurrences | 529/529 | Appointment Occurrence 529 | 60 |
| Events More Like This | 462/462 | Occurrence 461, External Session 1 | 416 |
| General site content index | 4574/4574 | Location 1175, Group 846, Occurrence 461, External Session 1, Content 2068, Taxonomy term 23 | 4132 |
| Occupations | 35280/35280 | O*Net Occupations 1016, Military MOC data 34264 | 35280 |

## What the site has

### Events search page

Investigated on QA, 2026-10-29. `/education-and-training/events` is a
GET form, so every filter and sort is a query param:

| Control | Param | Values |
|---|---|---|
| Event Name (keyword) | `fq` | free text |
| Topic | `ft[<id>]=<id>` | 786 Career Exploration, 787 Digital Skills, 788 Interviewing, 789 Job Search, 790 Networking, 791 Resumes |
| Format | `ff[in_person]=in_person`, `ff[virtual]=virtual` | In Person, Online |
| Event Type | `fy[<id>]=<id>` | 783 Job Club, 784 Job Fair or Networking Event, 785 Workshop |
| Date range | `fs`, `fe` | `YYYY-MM-DD` (From / To) |
| Featured statewide event | `fa=605` | checkbox |
| Location | `fp[loc][text]` | city or ZIP |
| Distance | `fp[radius]` | km values: `16.09` (10 mi) … `160.93` (100 mi), in 10 mi steps |
| Sort by | `sort_by` | `sp` Distance, `sr` Relevance |

Selectors:
- **Result count:** the text "Showing X-Y of Z" sits at the start of
  `.view-header` (the sort form is inside the same element). It is not
  `.view-header__result-summary-header`, so `SearchPage.resultCount()`
  doesn't work here.
- **Result cards:** `.views-row` is only the address line inside a
  card, not the card itself. Each card's date is in
  `.cf-events-search-card-icon-date time` and its time in
  `.cf-events-search-card-icon-time`. Count cards by the date element,
  not `.views-row`.
- **No results:** `.view-empty` with "No results found."
- **Pager:** 15 results per page.

What the results looked like on QA at the time (not asserted, counts
change with content):

| Query | Results |
|---|---|
| none | 28 |
| `fq=job club` | 10 |
| `fq=job search` | 3 |
| `ft[789]` Job Search | 23 |
| `ff[in_person]` | 28 (every event had an in-person location, including the hybrid "… and Online" ones) |
| `ff[virtual]` | 5 |
| `fy[783]` Job Club | 10 |
| `fy[785]` Workshop | 18 |
| `fs=2026-11-01&fe=2026-11-30` | 20 |
| `fa=605` Featured | 0 (no featured events right now) |
| `fp[loc][text]=55401&fp[radius]=16.09&sort_by=sp` | 5 |
| `fq=zzzxqqnomatch` | 0, "No results found." |

### Similar Events block

Investigated on QA, 2026-10-29, using
`/events/event-occurrence/384` as the example. The block is
`.block-views-blockevents-mlt-block-occurrence-mlt` (view `events_mlt`,
display `block_occurrence_mlt`) with an `h2` "Similar Events". Its event
cards link to `/events/event-occurrence/<id>`.

When an event has no similar events, the block **isn't rendered at all**.
There's no empty message. Of the 28 events in the search at the time,
13 had the block (1–2 similar events each) and 15 didn't. So "every event
has similar events" would fail on normal data. That's why AM-3 asserts at
least one out of 10 random events. With 13/28 having it, the chance that
10 random picks all lack it is about 0.02%.

Log the 10 picked event IDs in the test output (e.g. a `test.info()`
annotation), so a failure can be reproduced.

### Appointments search page

Investigated on QA, 2026-10-29. `/connect-careerforce/schedule-an-appointment`
(view `book_an_appointment`) is a GET form with no keyword field:

| Control | Param | Values |
|---|---|---|
| Date (week strip) | `start` | `YYYY-MM-DD`; defaults to today |
| Location | `location[loc][text]` | city or ZIP (map autocomplete; a hidden `location[loc][latlng]` stays empty when the URL is built by hand, and geocoding still worked) |
| Distance From | `location[radius]` | same km values as the events search, `16.09` (10 mi) … `160.93` (100 mi) |
| Format | `format[online]=online`, `format[phone]=phone`, `format[in_person]=in_person` | checkboxes |

Page structure:
- **Date strip** (`ul[aria-label="Appointment booking dates"]`, under a
  month `h2`): shows one Mon–Fri week. Past days are `li.past-date` with
  `aria-disabled="true"`. The selected day has no link, and the other
  bookable days link to `?start=<date>`. The Previous / Next Week arrows
  are links, or show as disabled ("Previous Week, disabled" in
  visually-hidden text). On 2026-10-29, Previous was disabled on the
  current week, and Next was disabled on the following week (week of
  Nov 2), so the strip only reaches about one week ahead. Loading
  `?start=` with a date past that still renders, with the empty message.
- **Results heading:** `h2` "Available appointments for <Weekday, Month D, YYYY>".
- **Location cards:** `.civiserv-location--appointments-for-booking`,
  name in `h3` ("CareerForce in <City>"). Each slot is an
  `.appt-slots a` linking to `/appointments/<id>/booking`, and its text
  is the time, date and formats ("online", "phone", "in person").
- **Empty:** `.view-empty` with "There are no appointments available on
  this day. Try adjusting your filters or selecting another day".
- **Buttons:** "Filter" submits, and "Reset" clears. The form is rendered
  twice (sidebar and mobile drawer), like on the events page.
- Results are rendered on the server, not loaded by JavaScript.

How the format filter behaved on QA: it filters by slot. Each slot that
stays lists the ticked format, and slots without it are dropped, even at a
location that has other slots. The location, distance and radius rules are
tested in [functional-appointments-search](../appointments/functional-appointments-search.md).

## Non-goals

- Reviewing `/admin/reports/dblog` after the run — stays manual.

## Open questions

None at the moment.

## Files

The spec files are numbered so a single worker runs them in plan order:
the permission rebuild, then the reindex, then the searches.

```
tests/
  smoke/admin-maintenance/
    01-permissions.spec.ts          # AM-1
    02-search-api.spec.ts           # AM-2, AM-3
  pages/
    search-api-index.page.ts     # rebuild tracking, index now, read counts, batch wait
    events-search.page.ts        # query URL, "Showing X-Y of Z", card locations, Similar Events block
    appointments-search.page.ts  # find a day in the strip, slots + formats
  helpers/
    dates.ts                     # site-timezone dates for the strip
```

Notes from verification:
- Run on QA on 2026-11-16: AM-1, AM-3 and AM-2 for Appointment
  Occurrences, Events More Like This and General site content passed.
  Occupations' single "Index now" stopped early (see AM-2's notes), so step 3
  now repeats it. AM-3's Similar Events check had picked up the admin
  contextual links in the block (their URLs end in
  `?destination=/events/event-occurrence/<this event>`); it now skips them,
  and passed on a re-run.
- Every date-strip link does a full page load, so the page object waits
  for the URL to change before reading the page.
- AM-1 and AM-2's pages and buttons were checked on QA with the admin
  session on 2026-11-12, without clicking them: "Rebuild permissions" /
  "Cancel" on the permissions page; "Index now", "Queue all items for
  reindexing", "Clear all indexed data" and "Rebuild tracking information"
  on each index page; "Confirm" / "Cancel" on `/rebuild-tracker`. The
  success messages are Drupal / Search API defaults and are still unchecked.
  "Index now" is disabled until tracking is rebuilt.
