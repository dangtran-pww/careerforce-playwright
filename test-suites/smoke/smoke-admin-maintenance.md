# [Smoke] - Admin Maintenance - Test Plan

Status: implemented
Implemented test: tests/smoke/admin-maintenance/*.spec.ts
Prod: No: rebuilds permissions and reindexes the search indexes.

## Overview

A quick check after each deploy that an admin can still run the site's
maintenance: rebuild content permissions, rebuild tracking and reindex each
search index, and then get results from the searches and filters that use
those indexes.

These are the admin write actions that [](smoke-admin-reports.md) leaves
out because they change the site. Rebuilding tracking and reindexing
empties an index's search results until it is indexed again, so the plan
runs on QA and Stage only, off-peak, and by hand for now: scheduling it as
part of regular runs is out of scope at this point. The Stage run of
2026-10-30 also rebuilt and reindexed Appointment Occurrences and Events
More Like This, and searched both.

## Login

| **Every case** | Admin role |
|---|---|

## Test cases

AM-1 is in `01-permissions.spec.ts`, AM-2 and AM-3 in
`02-search-api.spec.ts`. The files are numbered so one worker runs them in
plan order: the permissions rebuild, then the reindex, then the searches.
AM-3's searches also run as the admin, though a visitor could do them.

| ID | Test | Page | Steps | Expected result |
|---|---|---|---|---|
| AM-1 | Permissions rebuild completes | `/admin/reports/status/rebuild` | 1. Open the page. 2. Click "Rebuild permissions" and wait for the batch page to finish. | 1. The heading reads "Are you sure you want to rebuild the permissions on site content?", with "Rebuild permissions" and "Cancel" buttons. 2. A status message says the content permissions have been rebuilt, and there is no error message. |
| AM-2 | Rebuild tracking and reindex, per index | `/admin/config/search/search-api/index/<machine-name>` | Repeat for each of the 4 [Indexes for AM-2](#indexes-for-am-2), one test per index. 1. Open the index page. 2. Click "Rebuild tracking information"; on the confirm page, click "Confirm". 3. Click "Index now" and wait for the batch page to finish (it runs in the browser, not through cron). While the progress is below `N/N`, click "Index now" again, up to 5 runs in all. | 1. The progress shows `N/N indexed` with N > 0, and "Index now" is disabled because nothing is left to index. 2. The confirm page is `/admin/config/search/search-api/index/<machine-name>/rebuild-tracker` and asks "Are you sure you want to rebuild the tracking data for the search index <name>?". After confirming, back on the index page: a status message, the progress shows `0/N indexed`, and "Index now" is enabled. 3. After each run, a status message, no error message, and more items indexed than before the run. In the end the progress shows `N/N indexed`, the index's Status row isn't marked as an error, and there is no error message. |
| AM-3 | Searches and filters work after reindex | See [Searches for AM-3](#searches-for-am-3) | After AM-2. 1. Run each of the 5 searches with its keywords. 2. Run the two filter checks: the events search with Format Online, and the appointments day from step 1 filtered by a format. | 1. Each search returns results: a result count above 0, or at least one result where the page has no count. 2. Each filter check's result is in the "Filter checks" column. Never fixed counts, only relations to the unfiltered results. |

## Test data

The tests create nothing. AM-3's appointments check depends on the slots
QA already has (about 1–3 locations per day, Mon–Fri, about one week
ahead): if no day in the date strip has a slot, it fails.

### Indexes for AM-2

| Index | Machine name |
|---|---|
| Appointment Occurrences | `appointment_occurrences` |
| Events More Like This | `events_mlt` |
| General site content index | `general_site_content` |
| Occupations | `occupations` |

### Searches for AM-3

| Search | Index | Page | Keyword | Filter checks |
|---|---|---|---|---|
| Site search | `general_site_content` | `/search?k=<keyword>` | "job fair" | none |
| Events search | `general_site_content` | `/education-and-training/events?fq=<keyword>` | Run three times: empty (no filter), "job club", "job search" | Format Online (`?ff[virtual]=virtual`): the count is above 0 and no more than the unfiltered count, and every card's location contains "Online" |
| Appointments search | `appointment_occurrences` | `/connect-careerforce/schedule-an-appointment` | None: the page has no keyword box. Walk the date strip from today until a day shows at least one location card with a booking link (`/appointments/<id>/booking`); fail if no day in the strip has any. See [Appointments search page](#appointments-search-page) | That day filtered by the first format its first slot lists (`?start=<day>&format[<format>]=<format>`): at least 1 slot, every slot lists that format, and no more slots than the unfiltered day |
| Events more like this | `events_mlt` | "Similar Events" block on event pages (`/events/event-occurrence/<id>`) | None. Collect every event link from the events search (all pager pages), pick 10 at random, and open each. Pass if **at least one** shows the block with at least one event; on every page that has the block, each similar-event link points to `/events/event-occurrence/<id>` and not to the event itself. See [Similar Events block](#similar-events-block) | none |
| Occupations | `occupations` | `/explore/careers?otitle=<keyword>` | Run three times: "taxi driver", "nurse", "project manager" | none |

## Good to know

Checked on QA on 2026-10-29 (the search pages), and with the admin session
on 2026-11-12 (AM-1 and AM-2's pages and buttons, without clicking them).

- **AM-1 expects the rebuild to complete with no errors.**
- **The buttons:** "Rebuild permissions" and "Cancel" on the permissions
  page; "Index now", "Queue all items for reindexing", "Clear all indexed
  data" and "Rebuild tracking information" on each index page; "Confirm"
  and "Cancel" on `/rebuild-tracker`. "Index now" is disabled until
  tracking is rebuilt. The success messages are Drupal and Search API
  defaults, and the tests only check that a status message shows.
- **Rebuild and reindex stay in one test per index**, so a failure never
  leaves an index empty and unnoticed.
- **Why AM-2 step 3 can take more than one run:** while cron indexes, it
  holds the index's lock, a batch pass then indexes 0 items, and Search API
  ends the batch early with the warning "Number of indexed items is less
  than expected (by N)". On QA on 2026-11-16, Occupations stopped at
  12050/35280 after one run.
- **Reading the progress:** `.search-api-index-status .progress__description`,
  the same text AR-3 in [](smoke-admin-reports.md) reads. The Status row is
  `.search-api-index-summary--status`. The page also lists each datasource
  ("Datasource Content (2068/2068 indexed)").
- **Occupations is about 35k items**, and a full reindex takes minutes, so
  the AM-2 tests have a much longer timeout than the 60s default.
- **AM-3 checks every reindexed index is usable again**, not just
  "indexed". `SearchPage` fits the site search and Occupations, but not the
  events search (see [Events search page](#events-search-page)).
- **Admin contextual links in Similar Events:** the block holds the admin's
  contextual links, whose addresses end in
  `?destination=/events/event-occurrence/<this event>`. AM-3 skips them.
- **Every date-strip link does a full page load**, so the page object waits
  for the address to change before reading the page.
- **Verified on QA on 2026-11-16:** AM-1, AM-3, and AM-2 for Appointment
  Occurrences, Events More Like This and General site content passed. AM-2
  for Occupations, with the repeated "Index now" runs, passed on 2026-11-17
  (4.3 min).

### Index counts on QA

Counts on QA on 2026-11-12 (not checked by the tests: they change with
content). Each index page shows the overall progress,
one line per datasource, and "There are N items indexed on the server"; the
server count is lower than the tracked count on every index except
Occupations.

| Index | Progress | Datasources | On the server |
|---|---|---|---|
| Appointment Occurrences | 529/529 | Appointment Occurrence 529 | 60 |
| Events More Like This | 462/462 | Occurrence 461, External Session 1 | 416 |
| General site content index | 4574/4574 | Location 1175, Group 846, Occurrence 461, External Session 1, Content 2068, Taxonomy term 23 | 4132 |
| Occupations | 35280/35280 | O*Net Occupations 1016, Military MOC data 34264 | 35280 |

### Events search page

`/education-and-training/events` is a GET form, so every filter and sort is
in the address:

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

- **Result count:** the text "Showing X-Y of Z" sits at the start of
  `.view-header` (the sort form is inside the same element). It is not
  `.view-header__result-summary-header`, so `SearchPage.resultCount()`
  doesn't work here.
- **Result cards:** `.views-row` is only the address line inside a card,
  not the card itself. Each card's date is in
  `.cf-events-search-card-icon-date time` and its time in
  `.cf-events-search-card-icon-time`. Cards are counted by the date
  element. Each card links to its event with `a.cf-events-search-card-link`.
- **No results:** `.view-empty` with "No results found."
- **Pager:** 15 results per page.

What the results looked like on QA at the time (not checked by the tests:
counts change with content):

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

Checked with `/events/event-occurrence/384` as the example. The block is
`.block-views-blockevents-mlt-block-occurrence-mlt` (view `events_mlt`,
display `block_occurrence_mlt`) with an `h2` "Similar Events". Its event
cards link to `/events/event-occurrence/<id>`.

- **No similar events, no block:** the block isn't rendered at all, with
  no empty message. Of the 28 events in the search at the time, 13 had the
  block (1–2 similar events each) and 15 didn't, so "every event has
  similar events" would fail on normal data. That's why AM-3 asks for at
  least one of 10 random events. With 13/28 having it, the chance that 10
  random picks all lack it is about 0.02%.
- **The picked events are logged:** their IDs go into the test's
  annotations, so a failure can be reproduced.

### Appointments search page

`/connect-careerforce/schedule-an-appointment` (view `book_an_appointment`)
is a GET form with no keyword field:

| Control | Param | Values |
|---|---|---|
| Date (week strip) | `start` | `YYYY-MM-DD`; defaults to today |
| Location | `location[loc][text]` | city or ZIP (map autocomplete; a hidden `location[loc][latlng]` stays empty when the address is built by hand, and geocoding still worked) |
| Distance From | `location[radius]` | same km values as the events search, `16.09` (10 mi) … `160.93` (100 mi) |
| Format | `format[online]=online`, `format[phone]=phone`, `format[in_person]=in_person` | checkboxes |

- **Date strip** (`ul[aria-label="Appointment booking dates"]`, under a
  month `h2`): shows one Mon–Fri week. Past days are `li.past-date` with
  `aria-disabled="true"`. The selected day has no link, and the other
  bookable days link to `?start=<date>`. The Previous / Next Week arrows
  are links, or show as disabled ("Previous Week, disabled" in
  visually-hidden text). On 2026-10-29, Previous was disabled on the
  current week, and Next was disabled on the following week (week of Nov
  2), so the strip only reaches about one week ahead. Loading `?start=`
  with a date past that still renders, with the empty message.
- **Results heading:** `h2` "Available appointments for <Weekday, Month D,
  YYYY>".
- **Location cards:** `.civiserv-location--appointments-for-booking`, name
  in `h3` ("CareerForce in <City>"). Each slot is an `.appt-slots a`
  linking to `/appointments/<id>/booking`, and its text is the time, date
  and formats ("online", "phone", "in person").
- **Empty:** `.view-empty` with "There are no appointments available on
  this day. Try adjusting your filters or selecting another day".
- **Buttons:** "Filter" submits, and "Reset" clears. The form is rendered
  twice (sidebar and mobile drawer), like on the events page.
- **Rendered on the server**, not loaded by JavaScript.
- **The format filter works per slot:** each slot that stays lists the
  ticked format, and slots without it are dropped, even at a location that
  has other slots. The location, distance and radius rules are tested in
  [](../appointments/functional-appointments-search.md).

## Mobile

Desktop only. Admin and editor screens are not tested on a phone
(`admin-maintenance` is in `DESKTOP_ONLY_SMOKE_AREAS` in
`tests/helpers/devices.mts`).

## Not covered

- **Recent log messages** (`/admin/reports/dblog`) after the run: deciding
  which messages are a regression needs judgement, so it stays a manual
  check.
- **The searches in depth** (every filter, sort, the week strip, Reset, the
  address): [](../events/functional-events-search-detail.md) and
  [](../appointments/functional-appointments-search.md). This plan only
  checks that the reindexed searches work.
