# [Smoke] - Admin Maintenance - Test Plan

Status: needs update
Implemented test: tests/smoke/admin-maintenance/*.spec.ts
Prod: No: rebuilds permissions and reindexes the search indexes.
Updated cases: AM-2 — the rebuild-tracking confirm page is
`/admin/config/search/search-api/index/<id>/rebuild-tracker` with a
"Confirm" button, but `SearchApiIndexPage.rebuildTracking()` waits for a URL
matching `/rebuild-tracking`, so it times out. "Index now" is disabled until
tracking is rebuilt (checked on QA with the admin session, 2026-11-12).
Pending cases: AM-1 — generated; its page and button checked on QA on
2026-11-12, but the rebuild itself hasn't been run by the test yet. AM-3,
AM-4, AM-5 verified on QA, 2026-10-29.

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
| **Site login** | Required. Every case (AM-1 to AM-5) runs as a logged-in admin, including the search checks that a visitor could also do. |
| **Role** | `admin`: a PWW staff Google account that has admin rights on the environment being tested. It must be able to rebuild permissions (`/admin/reports/status/rebuild`) and manage Search API indexes (`/admin/config/search/search-api`). |
| **How to log in** | By hand, once per environment: `npm run login:manual -- admin --env <qa\|stage>` (without `--env`, it uses the environment `BASE_URL` in `.env` points at). A Chromium window opens on the login page. Click "PWW Staff Log In" and finish the Google sign-in. The session is saved as soon as you're back on the site, then close the window. The tests can't log in themselves: Google blocks sign-in from a browser Playwright controls. |
| **Saved session** | `playwright/.auth/<env>/admin.json`, one file per environment, shared with [smoke-admin-reports](smoke-admin-reports.md). A QA session doesn't work on Stage. |
| **When it expires** | Run the login command again. Each spec calls `useRole('admin')`, which checks the session before the first test; if it has expired, the tests fail with the login command to fix it. Drupal can also end the session early, e.g. when the same account logs in somewhere else. |
| **Environments** | QA and Stage only. The plan is no-prod (`Prod: No` in the header): AM-1 and AM-2 change site state, and AM-3 to AM-5 run after AM-2. |

## Running it

```bash
npm run login:manual -- admin
BASE_URL=https://qa.careerforce.link npx playwright test tests/smoke/admin-maintenance --project=smoke-desktop

# Only the read-only search checks, no reindex:
npx playwright test tests/smoke/admin-maintenance --grep "AM-3|AM-4|AM-5" --project=smoke-desktop
```

Runs in the `smoke-desktop` project (admin-maintenance is desktop only). The
plan is no-prod and every test is tagged `@no-prod`, so it never runs on
Production, and `--grep-invert @no-prod` leaves it out elsewhere (see
[README → Keeping tests off Production](../README.md#keeping-tests-off-production)).

## Scope

- Rebuilding tracking and reindexing temporarily empties search results
  for that index.
- **Run off-peak.** Occupations is ~26k items; a full reindex takes minutes.
  Give these tests a much longer per-test timeout than the 60s default.
- Run manually for now (the command under "Running it"). Scheduling it
  as part of regular runs is out of scope at this point.
- **Appointments data:** the tests don't create appointments, so AM-3's
  appointments check and AM-5 depend on the slots QA already has
  (about 1–3 locations per day, Mon–Fri, about one week ahead). If the strip has
  no slots, AM-3's appointments check fails, and AM-5's cases that need a
  reference day (or a specific kind of slot, like in-person-only) skip
  with a reason instead of failing.

## Persona / fixtures

- **Admin** — `playwright/.auth/<env>/admin.json`.
- No test data created. AM-5 does **not** create appointments; it uses
  whatever slots QA already has (see "Appointments data" under Scope).

## Test cases

Every case runs as `admin`.

| ID | Test | Page | Steps | Expected result | Notes |
|---|---|---|---|---|---|
| AM-1 | Permissions rebuild completes | `/admin/reports/status/rebuild` | 1. Open the page. 2. Click "Rebuild permissions" and wait for the batch page to finish. | **1.** The heading reads "Are you sure you want to rebuild the permissions on site content?", with "Rebuild permissions" and "Cancel" buttons. **2.** A status message says the content permissions have been rebuilt, and there is no error message. | Source checklist: "should complete successfully with no errors/issues" |
| AM-2 | Rebuild tracking and reindex, per index | `/admin/config/search/search-api/index/<machine-name>` | Repeat for each of the 4 indexes below. 1. Open the index page. 2. Click "Rebuild tracking information"; on the confirm page, click "Confirm". 3. Click "Index now" and wait for the batch page to finish (it runs in the browser, not through cron). | **1.** The progress shows `N/N indexed` with N > 0, and "Index now" is disabled because nothing is left to index. **2.** The confirm page is `/admin/config/search/search-api/index/<machine-name>/rebuild-tracker` and asks "Are you sure you want to rebuild the tracking data for the search index <name>?". After confirming, back on the index page: a status message, the progress shows `0/N indexed`, and "Index now" is enabled. **3.** A status message says the batch finished; the progress shows `N/N indexed`; the Status row (`.search-api-index-summary--status`) isn't marked as an error, and there is no error message. | Rebuild and reindex stay in one test per index so a failure never leaves an index empty and unnoticed. Progress: `.search-api-index-status .progress__description`, the same selector AR-3 uses. The page also lists each datasource ("Datasource Content (2068/2068 indexed)"); see the counts below |
| AM-3 | Searches work after reindex | See "Searches for AM-3" | After AM-2, run each of the 5 searches below with its keyword. | Each search returns results: a result count above 0, or at least one result where the page has no count. | Confirms every reindexed index is usable again, not just "indexed". Reuse `SearchPage` where the page uses the same view pattern (summary header + `.views-row`). The events search does **not** fit it — see "Events search page" below |
| AM-4 | Events search sort and filters | `/education-and-training/events?<query>` | After AM-2, open the page with each query in "Events search sort and filter cases" below. | Each case's result is in that table. | Filters go in the URL rather than through the form. The page renders the filter form several times (desktop sidebar, mobile drawer, sort-only form in the header), so clicking the form needs scoping to one copy |
| AM-5 | Appointments search date strip and filters | `/connect-careerforce/schedule-an-appointment` | After AM-2, run the cases in "Appointments search cases" below, most of which start from a **reference day** (the first day in the strip, this week then next week, with at least 2 slots). | Each case's result is in that table. | Same thinking as AM-4: never assert fixed counts or location names, only relations to the unfiltered results on the same day. Don't click a booking link through to submission, because that would create a real booking |

## Test data

### Indexes for AM-2

| Index | Machine name |
|---|---|
| Appointment Occurrences | `appointment_occurrences` |
| Events More Like This | `events_mlt` |
| General site content index | `general_site_content` |
| Occupations | `occupations` |

### Searches for AM-3

| Search | Index | URL | Keyword |
|---|---|---|---|
| Site search | `general_site_content` | `/search?k=<keyword>` | "job fair" |
| Events search | `general_site_content` | `/education-and-training/events?fq=<keyword>` | Run three times: empty (no filter), "job club", "job search" |
| Appointments search | `appointment_occurrences` | `/connect-careerforce/schedule-an-appointment` | n/a, no keyword box. Walk the date strip from today until a day shows ≥ 1 location card (`.civiserv-location--appointments-for-booking`) with a booking link (`.appt-slots a[href*="/appointments/"]`); fail if no day in the strip has any. See "Appointments search page" below |
| Events more like this | `events_mlt` | "Similar Events" block on event detail pages (`/events/event-occurrence/<id>`) | n/a. Collect every event link from the events search (`a.cf-events-search-card-link`, all pager pages), pick 10 at random, and open each. Pass if **at least one** shows the block with ≥ 1 event; for every page that has the block, each similar-event link must point to `/events/event-occurrence/<id>` and not to the event itself. See "Similar Events block" below |
| Occupations | `occupations` | `/explore/careers?otitle=<keyword>` | Run three times: "taxi driver", "nurse", "project manager" |

### Events search sort and filter cases

The assertions compare against the unfiltered count and against what is
on the cards, never against fixed numbers, so the cases hold up as
events come and go.

| Case | Query | Assertions |
|---|---|---|
| Topic filter | `ft[789]=789` (Job Search) | 0 < count ≤ unfiltered count |
| Format: Online | `ff[virtual]=virtual` | 0 < count ≤ unfiltered; every card's location text contains "Online" |
| Event type: Job Club | `fy[783]=783` | 0 < count ≤ unfiltered |
| Event type: Workshop | `fy[785]=785` | 0 < count ≤ unfiltered |
| Date range | `fs=<today>&fe=<today + 30 days>` | every card date is within the range |
| Featured | `fa=605` | page loads and shows either results or "No results found." (there are no featured events right now) |
| Keyword + filter combined | `fq=job&fy[783]=783` | count ≤ the count for `fq=job` alone |
| Sort: Relevance | `fq=job&sort_by=sr` | count > 0; card dates are in ascending order |
| Sort: Distance with location | `fq=job&fp[loc][text]=Minneapolis&fp[radius]=160.93&sort_by=sp` | count > 0; the first card's location contains "Minneapolis" |
| Location radius | `fp[loc][text]=55401&fp[radius]=16.09` | 0 < count ≤ unfiltered |
| No match | `fq=zzzxqqnomatch` | "No results found." visible; no cards |

### Appointments search cases

"Slots" means the `.appt-slots a` links, and each slot's formats are read
from its text. *Ref day* is the reference day from AM-5.

| Case | Steps | Assertions |
|---|---|---|
| Default day | `goto('/connect-careerforce/schedule-an-appointment')` | Heading reads "Available appointments for <today>"; days before today in the strip are `aria-disabled="true"`; today has no link; either location cards or the empty message is shown |
| Pick a day | Click a linked day in the strip | URL has `start=<that date>`; heading shows that date; that day is now the one without a link |
| Week navigation | Click Next Week, then Previous Week | Next: the strip shows the following Monday–Friday and the URL `start` is that Monday. Previous: back to the current week. On the current week, Previous Week is disabled |
| Booking window | Go to the furthest week the strip allows | Next Week is disabled (the strip reached about 1 week ahead on QA) |
| Format: Online | Ref day + `format[online]=online` | Every slot shown lists "online"; slot count ≤ unfiltered |
| Format: Phone | Ref day + `format[phone]=phone` | Every slot lists "phone"; slot count ≤ unfiltered |
| Format: In person | Ref day + `format[in_person]=in_person` | Every slot lists "in person"; slot count ≤ unfiltered |
| Formats combined | Ref day + `format[online]` + `format[phone]` | Every slot lists at least one of the two; slot count ≥ each single-format count |
| Format narrows | Ref day, picked so that at least one slot lacks some format (fall back to skipping the case if none does) | Filtering by the missing format hides that slot |
| Location sorts by distance | Ref day with ≥ 2 locations; take the *last* card's city (strip "CareerForce in ") and send it as `location[loc][text]` with `location[radius]=16.09` | That location's card is now first |
| Radius hides distant in-person-only slots | Find a day with an in-person-only slot (text lists only "in person"); note its location's city. Search that day with a city at least 50 mi from it (e.g. Duluth for a Twin Cities slot, Bloomington for a Duluth/Bemidji slot) and `location[radius]=16.09` | That in-person-only slot is gone. Every slot that lists "phone" or "online" is still shown. Searching that slot's own city with the same radius shows it again. Skip with a reason if no in-person-only slot is in the strip |
| Remote slots ignore radius | Ref day + a far-away location + `location[radius]=16.09` | Every slot from the unfiltered day that lists "phone" or "online" is still shown |
| Reset | Apply a format + location, click "Reset" | URL has no format/location params; the results match the unfiltered day |
| Empty day | `goto('?start=<a weekday beyond the booking window>')` | The empty message is visible; no cards |
| Booking link target | Ref day, read the first slot's `href` | Matches `/appointments/<id>/booking`; optionally `goto` it and check the booking page loads, **without submitting** |

If no day in the strip has a slot, the cases that need a reference day
are skipped with a `test.skip` reason, not failed. The AM-3 check is
what catches "no appointments at all".

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

Sort observations:
- **Relevance** (`sr`, and the default when there's no location) came back
  in date order.
- **Distance** (`sp`) only changes the order when a location is
  given: with `fq=job`, Minneapolis, 100 mi, Minneapolis events came
  first, then Bloomington, then Bemidji. Events that are also online
  showed up even when they were outside the radius (Bemidji is about 200 mi from Minneapolis).

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

What the results looked like on QA (not asserted, the data changes):

| Day | Locations [slots: formats] |
|---|---|
| Thu Oct 29 (today) | Bemidji [6:00 pm: online, phone, in person] |
| Fri Oct 30 | Bemidji [8:00 am; 6:00 pm — all formats] |
| Mon Nov 2 | Bloomington [8:30 am all] |
| Tue Nov 3 | Bloomington [8:00 am in person; 8:30 am all], Faribault [10:00 am, 2:00 pm phone + in person] |
| Wed Nov 4 | Bloomington [8:30 am all] |
| Thu Nov 5 | Bloomington [8:30 am all], Duluth [1:00 pm all], Faribault [9:30 am phone only] |
| Mon Nov 9, Mon Nov 16 | none (empty message) |

How the filters behaved:
- **Format filters by slot.** On Nov 3, `format[online]` dropped
  Bloomington's in-person-only 8:00 am slot and all of Faribault. On
  Nov 5, `online` and `in_person` each dropped Faribault, which only
  offers phone. Checking more than one format returns slots that offer
  any of them.
- **Location sorts by distance.** On Nov 5, Duluth / Bloomington /
  Faribault's ZIP 55021 each moved the matching location to the top.
  Moorhead (no CareerForce appointments nearby) left the default order.
- **Radius only applies to in-person-only slots** (confirmed by the
  team). A slot that also offers phone or online always shows,
  whatever the distance. On Nov 3, Duluth + 10 mi hid Bloomington's
  8:00 am in-person-only slot, but kept its 8:30 am slot (all formats)
  and Faribault's phone + in-person slots. Bloomington + 10 mi kept
  everything.

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
    03-events-search.spec.ts        # AM-4
    04-appointments-search.spec.ts  # AM-5
  pages/
    search-api-index.page.ts     # rebuild tracking, index now, read counts, batch wait
    events-search.page.ts        # query URL, "Showing X-Y of Z", card dates/locations, Similar Events block
    appointments-search.page.ts  # date strip (pick day, next/prev week, find a day), slots + formats, location order
  helpers/
    dates.ts                     # site-timezone dates for the date filters and strip
```

Notes from verification:
- Every date-strip link and the Reset button do a full page load, so the
  page object waits for the URL to change before reading the page.
- Reset also drops `start`, so it returns to today's unfiltered results.
- AM-1 and AM-2's pages and buttons were checked on QA with the admin
  session on 2026-11-12, without clicking them: "Rebuild permissions" /
  "Cancel" on the permissions page; "Index now", "Queue all items for
  reindexing", "Clear all indexed data" and "Rebuild tracking information"
  on each index page; "Confirm" / "Cancel" on `/rebuild-tracker`. The
  success messages are Drupal / Search API defaults and are still unchecked.
- `tests/pages/search-api-index.page.ts`: `rebuildTracking()` must wait for
  `/rebuild-tracker`, not `/rebuild-tracking`, and its comment saying the
  labels are unchecked can go.
