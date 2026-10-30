# [Smoke] - Admin Maintenance - Test Plan

Status: partially implemented
Implemented test: tests/stage/admin-maintenance/*.spec.ts
Pending cases: AM-1, AM-2 — generated but not yet verified against a live
admin session (the saved admin session had expired). AM-3, AM-4, AM-5
verified on QA, 2026-10-29.

Split out from [deed-smoke-test-plan.md](../docs/deed-smoke-test-plan.md)
§3 (search-api maintenance) and §9 (permissions rebuild), Phase 2. These
are the admin write actions that the
[admin reports plan](smoke-admin-reports.md) deliberately leaves
out because they change site state.

## Running it

```bash
npm run login:manual -- admin
BASE_URL=https://qa.careerforce.link npx playwright test tests/stage/admin-maintenance

# Only the read-only search checks, no reindex:
npx playwright test tests/stage/admin-maintenance --grep "AM-3|AM-4|AM-5"
```

Runs in the `stage` project (see
[README → Stage plans](README.md#stage-plans)).

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

- **Admin** — `playwright/.auth/admin.json`.
- No test data created. AM-5 does **not** create appointments; it uses
  whatever slots QA already has (see "Appointments data" under Scope).

## Test cases

| ID | Title | Persona | Steps | Assertions | Notes |
|---|---|---|---|---|---|
| AM-1 | Permissions rebuild completes | Admin | `goto('/admin/reports/status/rebuild')`, click "Rebuild permissions", wait for the batch page to finish | Success message (e.g. "Content permissions have been rebuilt") visible; no error messages | Source checklist: "should complete successfully with no errors/issues" |
| AM-2 | Rebuild tracking and reindex, per index | Admin | Data-driven over the 4 indexes below. For each: `goto('/admin/config/search/search-api/index/<machine-name>')` → "Rebuild tracking information" → confirm → "Index now" → wait for the batch page to finish (it runs in the browser, not via cron/queue) | After rebuild tracking: success message, and the progress shows `0/<N> indexed` with N > 0. After Index now: batch success message; progress shows `N/N indexed`; no error status row | Rebuild and reindex stay in one test per index so a failure never leaves an index empty and unnoticed. Read counts with the same selectors AR-3 uses (`.search-api-index-status .progress__description`, `.search-api-index-summary--status`) |
| AM-3 | Searches work after reindex | Admin | After AM-2, data-driven over the 5 searches below: run each search with its keyword | Each search returns results (result count > 0, or at least one result row where there is no count summary) | Confirms every reindexed index is usable again, not just "indexed". Reuse `SearchPage` where the page uses the same view pattern (summary header + `.views-row`). The events search does **not** fit it — see "Events search page" below |
| AM-4 | Events search sort and filters | Admin | After AM-2, data-driven over the cases in "Events search sort and filter cases" below: `goto('/education-and-training/events?<query>')` | Per case, see the table | Filters go in the URL rather than through the form. The page renders the filter form several times (desktop sidebar, mobile drawer, sort-only form in the header), so clicking the form needs scoping to one copy |
| AM-5 | Appointments search date strip and filters | Admin | After AM-2, run the cases in "Appointments search cases" below. Most cases first find a **reference day**: the first day in the strip (this week, then next week) with ≥ 2 slots | Per case, see the table | Same thinking as AM-4: never assert fixed counts or location names, only relations to the unfiltered results on the same day. Don't click a booking link through to submission, because that would create a real booking |

Indexes for AM-2:

| Index | Machine name |
|---|---|
| Appointment Occurrences | `appointment_occurrences` |
| Events More Like This | `events_mlt` |
| General site content index | `general_site_content` |
| Occupations | `occupations` |

Searches for AM-3:

| Search | Index | URL | Keyword |
|---|---|---|---|
| Site search | `general_site_content` | `/search?k=<keyword>` | "job fair" |
| Events search | `general_site_content` | `/education-and-training/events?fq=<keyword>` | Run three times: empty (no filter), "job club", "job search" |
| Appointments search | `appointment_occurrences` | `/connect-careerforce/schedule-an-appointment` | n/a, no keyword box. Walk the date strip from today until a day shows ≥ 1 location card (`.civiserv-location--appointments-for-booking`) with a booking link (`.appt-slots a[href*="/appointments/"]`); fail if no day in the strip has any. See "Appointments search page" below |
| Events more like this | `events_mlt` | "Similar Events" block on event detail pages (`/events/event-occurrence/<id>`) | n/a. Collect every event link from the events search (`a.cf-events-search-card-link`, all pager pages), pick 10 at random, and open each. Pass if **at least one** shows the block with ≥ 1 event; for every page that has the block, each similar-event link must point to `/events/event-occurrence/<id>` and not to the event itself. See "Similar Events block" below |
| Occupations | `occupations` | `/explore/careers?otitle=<keyword>` | Run three times: "taxi driver", "nurse", "project manager" |

Source-checklist reference counts (at the time of writing — not asserted,
counts change with content): General 4351/4351, Occupations 26471/26471.

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

## Non-goals

- Reviewing `/admin/reports/dblog` after the run — stays manual.

## Open questions

None at the moment.

## Files

The spec files are numbered so a single worker runs them in plan order:
the permission rebuild, then the reindex, then the searches.

```
tests/
  stage/admin-maintenance/
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
- AM-1 and AM-2's button labels ("Rebuild permissions", "Rebuild tracking
  information", the confirm button, "Index now") and success messages are
  Drupal / Search API defaults, not yet checked on QA.
