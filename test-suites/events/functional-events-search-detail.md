# [Functional] - Events - Search and Detail Pages - Test Plan

Status: ready to generate
Implemented test: —

## Overview

Part 1 of 5 of the functional plans for Events. It tests what a visitor sees
of events: the Events search at `/education-and-training/events` (first load,
keyword, every filter, sort, paging, Reset, the address, bad and hostile
values, empty results and the event cards), which events the search leaves
out, external events, the occurrence page `/events/event-occurrence/<id>`
with every block, events on the homepage "Upcoming Events" carousel and on
location pages, the online-only card location
([MNDEED-9620](https://portland-webworks.atlassian.net/browse/MNDEED-9620)),
and the pages at phone width, with the keyboard and for screen readers.

The other parts (not written yet):

- functional-events-scheduling (admin: catalog items, sessions, recurrence,
  overrides, location scheduler, alternate locations, private events,
  cancelling),
- functional-events-registration (job seeker: reserve and confirm, Tier 2
  gating, waitlist, cancel, My Events & Appointments, printing),
- functional-events-attendees (staff Attendees tab, attended, service
  records, undo, resend, bulk),
- functional-events-external-submissions ("Submit an Event" and review).

This plan is the in-depth version of the quick visitor checks in the Smoke
suite: EP-1 to EP-7 in [smoke-events.md](../smoke/smoke-events.md), and
AM-4 (and the Similar Events part of AM-3) in
[smoke-admin-maintenance.md](../smoke/smoke-admin-maintenance.md). Some overlap is
expected; the case IDs here are its own.

Every case runs as a visitor who isn't logged in and changes nothing, so the
whole plan is safe on QA, Stage and Production. It is **not** marked
`Parallel: yes`, although it only reads the site: on QA a request with
markup in the address (EU-6) is answered "403 Forbidden" by the site's
firewall, and on 2026-11-12 the firewall then refused every request from
the same browser for about 20 seconds, which would fail any plan running
alongside it. See [Open questions](#open-questions).

Where the cases come from: the request for this part (the scope above), the
knowledge base `docs/kb/events/` and the app source, and what QA showed on
2026-11-12.

## Login

| | |
|---|---|
| **Role** | None. A visitor who isn't logged in. No saved session is loaded. |
| **Site password gate** | QA and Stage ask for the `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` from `.env` ([one-time setup](../README.md#one-time-setup)). Production has no gate. |
| **Accounts touched** | None. ED-10 follows "Log In or Create Account" to the LoginMN page and stops there. |

## Running it

First time? Do the [one-time setup](../README.md#one-time-setup).

```bash
BASE_URL=https://qa.careerforce.link npx playwright test tests/functional/events/search.spec.ts tests/functional/events/search-filters.spec.ts tests/functional/events/search-address.spec.ts tests/functional/events/listing-rules.spec.ts tests/functional/events/external-events.spec.ts tests/functional/events/occurrence-page.spec.ts tests/functional/events/homepage-location-events.spec.ts tests/functional/events/search-detail-responsive.spec.ts tests/functional/events/search-detail-accessibility.spec.ts --project=functional-desktop
BASE_URL=https://qa.careerforce.link npx playwright test tests/functional/events/search.spec.ts tests/functional/events/search-filters.spec.ts tests/functional/events/search-address.spec.ts tests/functional/events/occurrence-page.spec.ts tests/functional/events/homepage-location-events.spec.ts --project=functional-mobile
```

Add `--ui` to [watch it run](../README.md#watching-a-run), or put
`SCREENSHOT=on` in front to
[save a screenshot of every test](../README.md#screenshots-of-every-test).

## Scope

- **In:** everything a visitor can see or do with events without logging
  in, on the Events search, the occurrence and external event pages, the
  homepage carousel and location pages.
- **Out:** anything behind a login (parts 2 to 4), the "Submit an Event"
  form (part 5), and appointments.
- **Read-only:** no case saves, submits, registers, or logs in. The only
  forms used are the search and filter forms, which only read (GET).

## Checked in every case

These hold after every step of every case, and a case fails if one doesn't:

- **No JavaScript error** from the site's own scripts in the browser
  console. Failed loads of other sites' files (Google Tag Manager, the AWS
  firewall's `challenge.js`) are ignored; both failed in the planning
  browser on QA.
- **No failed request** to the site itself (no 4xx or 5xx answer from the
  CareerForce host), except where a case expects one (EU-6, EX-4, ED-12).
- **No raw error on the page:** no "The website encountered an unexpected
  error", no PHP or Drupal error message, no stack trace.

## Login and test data

No account is needed. The cases use whatever events the site has, and never
check an exact count. A few cases need a particular kind of occurrence; the
test finds one as described, or uses the environment's entry in the table
below, and is skipped with the reason when there is none.

| What | How the test finds it | On QA (2026-11-12) |
|---|---|---|
| D and "now" | Today and the time now in America/Chicago, the site's timezone. The display window ends 45 days after now. | D = 2026-11-12, window to 2026-12-27 |
| Online-only event | A search card whose tags have "Online" and not "In Person", and whose page shows Location "Online". | "Creative Job Search: Job Search Over 55", CareerForce in Bemidji (for example 445) |
| Hybrid event | A card with both "In Person" and "Online". | "Job Club", CareerForce in Minneapolis South (225, 2026-12-10) |
| Meeting location different from Offered By | A page whose Location name isn't its Offered By name. | "Job Club", CareerForce in Thief River Falls, held at Thief River Falls Public Library (288) |
| Full event | The first of the search's events (up to 20) whose page shows "This event is full!". | "Computer Confidence" 2026-11-13 (464) |
| Event with more than 3 other dates | A page whose "Additional times" table has more than 3 rows. | 445 (21 other dates) |
| Event with no other dates | A page with no "Additional times" heading. | "QA Test Event - Resume Writing Workshop" (405) |
| Occurrence more than 45 days ahead | Open occurrence IDs above the highest ID in the search, up to 40, and take the first whose date is after the window. | 461, 462, 483 to 486 (2026-12-28 to 12-30) |
| Past occurrence | Open IDs just below the lowest ID on the search's first page, up to 40, and take the first dated before now. | 438 (2026-11-11) |
| Private occurrence | Per environment, from the team (see Open questions). | Appears to be "Applications 101", CareerForce in Aitkin (413 to 430, 434): its pages open but it is in no listing |
| Cancelled or draft occurrence | Per environment, from the team (see Open questions). | 321 (a visitor is sent to the login page; which state it is in wasn't visible) |
| External event | A search card that links to `/events/external/…` or `/events/event-external/<id>`; else the environment's known one. | None in the search. `/events/event-external/1` ("External Event", 2026-09-16, past) |

## What the site has

Checked on QA as a visitor (no login) on 2026-11-12, at about 2:00 PM
Central, without saving anything. The saved `admin` and `jobseeker`
sessions had expired and weren't loaded.

**Events search** (`/education-and-training/events`, title "Events | CareerForce"):

- h1 "Events", then a "Skip to event search results" link (to
  `#block-careerforce-skin-content`) and "What are you searching for
  today?" (h2) with 4 links: "Featured statewide events" (`?fa=605`),
  "Search job fairs and networking events" (`?fy[784]=784`), "Book an
  appointment" (`/connect-careerforce/schedule-an-appointment`), "Find a
  training program" (`/training-programs`).
- Sidebar (its own form): Topic (Career Exploration 786, Digital Skills 787,
  Interviewing 788, Job Search 789, Networking 790, Resumes 791), Format (In
  Person `ff[in_person]`, Online `ff[virtual]`), Type (Job Club 783, Job Fair
  or Networking Event 784, Workshop 785), Date Range with "From" and "To"
  date boxes (`fs`, `fe`, type `date`), a "Featured statewide event"
  checkbox (`fa=605`), and a "Filter" button. Below it, "For Employers"
  (h2) with "Submit event" to `/form/external-event`.
- Search form (a second form): "Event Name" (`fq`, hint "e.g., Resume
  Writing", `maxlength` 128), "Location" (`fp[loc][text]`, a combobox with
  hint "City, State, ZIP"; typing "Bloom" offered "Bloomington, MN",
  "Bloomer, WI", "Blooming Prairie, MN"), "Distance" (`fp[radius]`, 10 to
  100 mi in 10 mi steps, sent in km, default 40 mi = `64.4`), a "Search"
  button and a "Reset" link (to `/education-and-training/events`).
- Results: "Showing 1-15 of 59", a "Sort by" dropdown (Distance `sp`,
  Relevance `sr`; Distance was selected with no location, and changing it
  reloads the page with `sort_by` added and everything else kept), 15 event
  cards a page, and a "Book a 1:1 appointment with a Career Specialist"
  promo (h2, "Book now") as the 4th item of page 1. Pager links are `?page=N`
  (0-based) and add `view_title=Events`; "Showing 46-59 of 59" on page 4.
- Each card: the title as a link to `/events/event-occurrence/<id>`, whose
  accessible name is "<title> on <Month D, YYYY> at <h:mma> in <place>"; tags
  (format first, then type, then topics; for example "Online / Workshop /
  Job Search"); the date ("November 12, 2026"); "7:00 PM to 8:00 PM"; and a
  location line: "Bloomington, MN", "Online", or "Minneapolis, MN and Online"
  for the hybrid Job Club. Card titles are not headings.
- The order was by date and time, earliest first, both with no sort chosen
  and with Relevance. With `fp[loc][text]=55437` and Distance sort, the
  Bloomington events came first; with Relevance they were by date.
- Results by the address: no filter 59; Online 23; In Person 37; both 59;
  `fq=job club` 9 (all "Job Club"); Job Fair 0; `fa=605` 0 ("No results
  found.", and the page stayed on `?fa=605`); Resumes or Digital Skills 22;
  `fq=resume` + Resumes + In Person + Workshop 3; `fe=2026-11-13` 3,
  including a 7:00 PM event on the 13th (the To date is inclusive);
  `fs=2026-11-20&fe=2026-11-20` 2; From after To 0; 55437 within 10 mi 52
  (Bloomington events plus every online and hybrid event); Duluth within
  10 mi 23 (only online and hybrid events); `fq=zzqxqzz` 0.
- With nothing found: "No results found.", no "Showing" line, no Sort by, no
  pager.
- **The page's own forms didn't narrow the results.** Typing "job club"
  and clicking "Search" (or pressing Enter) led to
  `?fq=job+club&fp[loc][text]=&fp[loc][latlng]=&fp[radius]=64.4&form_build_id=…&form_id=toolshed_search_filter_form&form_build_id=…&form_id=toolshed_search_filter_form`
  and "Showing 1-15 of 59", with "job club" still in the box. Ticking
  Online and clicking "Filter" did the same. Opening
  `?fq=job+club&form_id=toolshed_search_filter_form` also showed 59, and
  `?fq=job+club` alone showed 9, so the `form_id` that the forms add is what
  stops the filtering. EV-4, EF-1 to EF-5, EF-8, EF-9, EF-11, EU-2 and EM-2
  use the forms and expect them to work.
- Odd values by the address: `sort_by=bogus` showed "No results found." and
  no Sort by; `page=999` showed "Showing 46-59 of 59" and no cards; `page=-1`
  and `page=abc` showed page 1; `fs=notadate` was ignored (From box empty);
  `fp[radius]=abc` with a location showed "No results found." with Distance
  showing "10 mi"; `ft[99999]=99999` showed "No results found."; `fa=1` was
  ignored (59); a 300-character `fq` loaded with "No results found." and
  all 300 characters in the box; `C++ & "R&D"` showed exactly in the box.
- Markup in the address (`fq=<script>alert(1)</script>`,
  `fq="><img src=x onerror=alert(1)>`, `fp[loc][text]=<b>x</b>`): "403
  Forbidden" from the firewall. After a few of those, every page of the
  site answered 403 to this browser for about 20 seconds, then worked
  again.
- Back and Forward through three searches showed each search's address and
  form values again.
- At 390 × 844: the sidebar is hidden behind a "Filters" button (it has no
  `aria-expanded`); the drawer has a "Close filters" button, takes focus
  when it opens, closes on Esc and gives focus back to "Filters". The
  phone's "Reset" is a button. The page was 383 px wide in a 375 px client
  area.
- Tab order on desktop: the site header and menus, the breadcrumb, "Skip to
  event search results", the 4 quick links, then the sidebar filters (each
  date box takes several Tab stops, one per part of the date), then the
  search form. Checkboxes show a ring on focus, other controls an outline.

**Which events the search leaves out** (every occurrence ID from 1 to 500
opened as a visitor):

- 415 opened (200), 39 were "Page Not Found" (404), and 46 sent the visitor
  to `/user/login?destination=/events/event-occurrence/<id>` (unpublished:
  draft or cancelled).
- 84 of the open ones were in the future; the search listed 59. The other
  25: 6 dated 2026-12-28 to 12-30 (after the window ends on 2026-12-27) and
  all 19 "Applications 101" dates at CareerForce in Aitkin (2026-11-13 to
  12-25), which also aren't on the Aitkin location page, the homepage or in
  Similar Events; it appears to be private.
- An occurrence whose time had passed earlier today (Job Club, 9:00 AM) was
  not listed.

**Occurrence page** (`/events/event-occurrence/<id>`; some redirect to their
alias, for example `/careerforce-location/careerforce-thief-river-falls/location-events/job-club/42/100`):

- h1 "<title> <Weekday, Month D, YYYY>" and page title "<same> |
  CareerForce"; tags; the description; "Please create an account or log in
  to register for this event." with a "Log In or Create Account" button (a
  POST form that sent the browser to `dev-login.mn.gov/…/authorize?…&redirect_uri=https://qa.careerforce.link/openid-connect/loginmn`).
- h2 "Date" ("Friday, November 20, 2026"), "Time" ("7:00 PM - 8:00 PM"),
  "Location", "Offered By" (a link to the location page), and "Accommodation
  Phone Number" (with a "Show tooltip for: Occurrence: Accommodation Phone
  Number" button; the number is a `tel:` link on some events and plain text
  on others).
- Location: "Online" for the online-only event; "CareerForce in Bloomington",
  its address and a map ("Map" region) for an in-person one; "Online or" and
  the Minneapolis South name and address for the hybrid one; "Thief River
  Falls Public Library" and its address for the TRF Job Club, whose Offered
  By is "CareerForce in Thief River Falls".
- "Additional times are offered for this event:" (h2): a table "Date &
  Time" / "Action", one row per other future date of the same session (not
  the page's own date, none after the window), each with a "View" link
  named "View Event on <date - times>". Over 3 rows: the first 3 show and a
  "See More" button ("Show 18 more times for this event." for screen
  readers); clicking it shows all rows, removes the button, moves focus to
  the 4th row's link, and announces "Loaded 18 additional event times for
  this event."
- "Similar Events" (h2) with up to 4 cards (date such as "Friday, November
  20th, 2026", title link, "7:00 AM - 7:15 AM", location). On 445 it listed
  no other "Creative Job Search" date. Missing on some events, with no empty
  message.
- The full event (464) adds "**This event is full!** CareerForce offers
  priority of service to veterans, current service members, and eligible
  spouses. If you are a veteran, active military service member, or
  eligible spouse, you can log in and be added to the waitlist for this
  event." and still shows the login prompt.
- A past occurrence (438, the day before) opens with all its blocks,
  including the login prompt to register.
- `/events/event-occurrence/99999999` and `/events/event-occurrence/abc`:
  404 "Page Not Found". `/events/event-session/1` sends a visitor to the
  login page.

**External event:** `/events/event-external/1` redirects to
`/events/external/external-event` ("External Event Wednesday, September 16,
2026", in the past): tags "In Person / Job Club / Career Exploration /
Networking", a description with a "Learn more" link to `https://example.com`
(`target="_blank"`), Date, Time "10:00 PM - 10:15 PM", Location (a free-text
address in Saint Paul, MN), Offered By "Me", Accommodation Phone Number, and
Similar Events; no login prompt. IDs 2 and 3 are 404. No external event was
in the search.

**Homepage "Upcoming Events"** (`view-display-id-upcoming_events`): h2
"Upcoming Events"; 9 events, the same as the first 9 search events in date
order, 3 at a time, with dot buttons "1 of 9" to "9 of 9" and "Previous" /
"Next"; the carousel adds copies of the slides. Each card: the date
("Thursday, November 12th, 2026" plus hidden-from-screen-readers "THU 12
Nov"), the title link (named like the search's), "7:00 PM - 8:00 PM", the
location. A "Distance from" fieldset: "Location" (`loc[loc][text]`),
"Distance from" (10 to 100 mi, default 40 mi) and "Apply". Applying 55437 and
10 mi changed the address to `/homepage?loc[loc][text]=55437&…&loc[radius]=16.09&view_title=Upcoming%20Events%20in`
and left Bloomington and online events; opening that address redirects to
`/?…` with the same values. Duluth and 10 mi left only online events. Link
"Find a filterable list of all events, workshops and appointments" to
`/education-and-training/events`.

**Location pages:** an "Events" (h2) section with 6 cards a page and a
pager (`?page=1,,,,,,,,,,,0` style), and "Find a filterable list of all
events" to `/education-and-training/events`. Bemidji had 4 pages, Bloomington
5, Aitkin 1 card ("QA Test Event", no "Applications 101"), Thief River Falls 6
(Job Club at the library), Minneapolis South (`/minneapolissouth`) 1.

**The online-only event's location (MNDEED-9620):** its search card says
"Online" and its page says Location "Online", but its cards on the homepage,
the Bemidji location page and in Similar Events say "Bemidji, MN or Online",
and every card link's accessible name says "… in Bemidji or Online". The
hybrid Job Club says "Minneapolis, MN and Online" on the search and
"Minneapolis, MN or Online" on its location page.

From the KB (`docs/kb/events/`) and the app source (`config/sync`,
`cf_happenings`, `happenings`, the theme), not checked on a running site:

- The search is view `content_search`, display `events_search`, on Search
  API index `general_site_content`, listing occurrences and external
  sessions only. Its fixed filters: interface language; `field_private != 1`
  (private sessions left out); the Display Window filter (an occurrence must
  start no more than 45 days from now; anything that isn't an occurrence
  passes it); and a start date between now and 45 days from now on the
  combined start date of occurrences **and** external events. That last
  filter appears to leave external events out after 45 days too, but they
  must not be limited (decided 2026-11-12), so if it does, EX-3 fails and
  reports it. The index's "entity status" processor leaves out unpublished
  items, and in the session workflow both Draft and Cancelled are
  unpublished.
- The homepage carousel (`upcoming_events`, 9 items), the featured event
  block (location 605) and the location page block
  (`block_events_by_service_location`, 6 a page, by the occurrence's primary
  location) list occurrences only, starting after now, with the same window
  and private filters. The carousel's empty text is "No results found. Try
  increasing your search radius."
- "Featured statewide event" (`fa`) filters on the occurrence's location
  (alternate or primary) equal to the value; the link and the checkbox use
  605.
- The To date (`fe`) given as a bare date gets " 23:59:59" added, so it is
  inclusive.
- Distance filtering and sorting cover both occurrences and external events.
- Similar Events (`events_mlt`) leaves out other occurrences of the same
  catalog item, and is also on external event pages.
- The "Additional times" table on the page is view `happenings_occurrence`,
  display `additional_times`: other future occurrences of the session,
  within the window. "See More" shows when there are more than 3 rows.
- A visitor never gets the registration actions block; they get the LoginMN
  login block instead. The "This event is full!" text is
  `happenings.settings:registration.event_full_text`.
- Viewing an unpublished occurrence needs `view happenings_occurrence
  unpublished`; a visitor doesn't have it, so the site answers access
  denied, which sends a visitor to the login page.
- An external event's page is `/events/event-external/<id>`, aliased to
  `/events/external/<label>`.

## Test cases

"Page" is the address after the site name. "The search" is
`/education-and-training/events`. "Search" means typing in the search form
and clicking its "Search" button; "Filter" means ticking or filling the
sidebar and clicking its "Filter" button; "by the address" means opening
the address directly. "The unfiltered total" is the "Showing … of N" total
of the search with nothing after it, read in the same test. "Within the
window" means starting no earlier than now and no later than 45 days from
now. Counts are never compared with a number written here.

### Search: first load, keyword and cards

`tests/functional/events/search.spec.ts`

| ID | Test | Page | Steps | Expected result |
|---|---|---|---|---|
| EV-1 | Everything is on the page when it first loads | `/education-and-training/events` | Open the search with nothing after it and look at the whole page. | The page shows: **1.** The h1 "Events" and a "Skip to event search results" link. **2.** "What are you searching for today?" with the links "Featured statewide events" (`?fa=605`), "Search job fairs and networking events" (`?fy[784]=784`), "Book an appointment" (`/connect-careerforce/schedule-an-appointment`) and "Find a training program" (`/training-programs`). **3.** The filters, none ticked or filled: Topic (Career Exploration, Digital Skills, Interviewing, Job Search, Networking, Resumes), Format (In Person, Online), Type (Job Club, Job Fair or Networking Event, Workshop), Date Range "From" and "To", "Featured statewide event", and a "Filter" button. **4.** The search form: an empty "Event Name" box with the hint "e.g., Resume Writing", an empty "Location" box, a "Distance" dropdown at "40 mi" with 10 mi to 100 mi, a "Search" button and a "Reset" link. **5.** "Showing 1-15 of N" with N at least 1, a "Sort by" dropdown offering Distance and Relevance, 15 event cards (or N when N is under 15), and a pager when there are more than 15 events. **6.** One "Book a 1:1 appointment with a Career Specialist" item with "Book now" to `/connect-careerforce/schedule-an-appointment`, not counted as an event. **7.** "For Employers" with "Submit event" to `/form/external-event`. |
| EV-2 | Events come in date order, across the page break | `/education-and-training/events` | 1. Read the start date and time of every card on page 1. 2. Go to page 2 and read them again. | **1.** Every start is within the window, and each is the same as or later than the one before. **2.** The same on page 2, and page 2's first start is the same as or later than page 1's last; no event is on both pages. |
| EV-3 | Each card shows its event correctly | `/education-and-training/events` | 1. Read every card on page 1. 2. Open the first 3 cards' events, one at a time. | **1.** Each card has: a title linking to `/events/event-occurrence/<id>` (or an external event's page); tags, starting with its format ("In Person", "Online" or both) then its type and topics; a date like "November 12, 2026"; a start and end time like "7:00 PM to 8:00 PM"; and a location line that is "<City>, MN", "Online", or "<City>, MN and Online". The link's accessible name has the title, the date, the start time and the same place as the location line. **2.** Each event page has the card's title in its h1, the card's date, the card's start and end time, the card's tags in the same order, and a Location that matches the card ("Online" for "Online"; an address in the card's city otherwise). |
| EV-4 | Keyword with the Search button and with Enter | `/education-and-training/events` | 1. Type "job club" in Event Name and click "Search". 2. Open the search again, type "job club" and press Enter. | Each time: **1.** The address has `fq=job club` and the box shows "job club". The total is smaller than the unfiltered total, and the total and the first page's events are the same as opening `?fq=job+club` by the address. The first card's title contains "Job Club" (letter case ignored). **2.** The same as step 1. |
| EV-5 | Letter case and spaces don't matter | `/education-and-training/events` | 1. Search "job club" and note the total and the first page's events. 2. Search "  JOB CLUB  " (spaces before and after). | **1.** At least 1 event is listed. **2.** The same total and the same first page as step 1. |
| EV-6 | Nonsense keyword | `/education-and-training/events` | Search "zzqxqzz". | **1.** "No results found." shows, with no event cards, no "Showing" line and no pager. **2.** The Event Name box still shows "zzqxqzz". **3.** The filters and the search form are still there and can be used. |
| EV-7 | Special characters in the keyword | `/education-and-training/events` | Search `C++ & "R&D"`. | **1.** The address carries the keyword encoded (`fq=C%2B%2B+%26+%22R%26D%22`, or `%20` for spaces). **2.** The Event Name box shows `C++ & "R&D"` exactly, with no `&amp;` or `&quot;`. **3.** Either events are listed or "No results found." shows. |
| EV-8 | A long keyword | `/education-and-training/events` | 1. Type a 300-character keyword ("resume" 50 times, no spaces) in Event Name and search. 2. Open the search with that 300-character keyword in `fq` by the address. | **1.** The box holds only the first 128 characters (its limit), the page loads normally, and either events are listed or "No results found." shows. **2.** The page loads normally (no "Request-URI Too Long" or error page), and either events are listed or "No results found." shows. |

### Search: filters

`tests/functional/events/search-filters.spec.ts`. Each filter is used through
the page's controls, then compared with the same filter opened by the address.

| ID | Test | Page | Steps | Expected result |
|---|---|---|---|---|
| EF-1 | Each topic on its own | `/education-and-training/events` | One test per topic: open the search, tick the topic (Career Exploration, Digital Skills, Interviewing, Job Search, Networking, Resumes), and click "Filter". | For each topic: **1.** The address has `ft[<id>]=<id>` and the topic is still ticked. **2.** Either "No results found." shows, or the total is no more than the unfiltered total and every card on the first page has that topic among its tags. **3.** The total and the first page are the same as opening `?ft[<id>]=<id>` by the address. |
| EF-2 | Two topics give either one | `/education-and-training/events` | 1. Filter by Resumes alone, then by Digital Skills alone, and note both totals. 2. Tick both and click "Filter". | **1.** Each total is no more than the unfiltered total. **2.** Both stay ticked; the total is at least the larger of the two and no more than their sum; every card on the first page has Resumes or Digital Skills among its tags. |
| EF-3 | Format: Online, In Person, and both | `/education-and-training/events` | 1. Filter by Online. 2. Filter by In Person instead. 3. Tick both and click "Filter". | **1.** Online stays ticked; every card on the first page has the "Online" tag, and its location line is "Online" or ends in "and Online". **2.** In Person stays ticked; every card on the first page has the "In Person" tag. **3.** Both stay ticked; the total is the unfiltered total (every event is one or the other) and no more than the two totals added together. |
| EF-4 | Each event type, and the job fairs link | `/education-and-training/events` | 1. One test per type: filter by Job Club, then Job Fair or Networking Event, then Workshop. 2. Open the search, click "Search job fairs and networking events". | **1.** For each type: it stays ticked, and either "No results found." shows or every card on the first page has that type among its tags. **2.** The address has `fy[784]=784`, "Job Fair or Networking Event" is ticked, and the results are the same as step 1's for that type. |
| EF-5 | Date range | `/education-and-training/events` | 1. Find the first card on the unfiltered search that starts at 5:00 PM or later, and filter with From and To both set to its date. 2. Filter with From D+7 and To D+14. 3. Filter with From D-30 and To D+3. | Dates are typed into the date boxes. **1.** Both boxes keep the date; every card is on that day, and the evening event is listed (the To date includes the whole day). Skipped with a reason if no card starts at 5:00 PM or later. **2.** Every card's date is from D+7 to D+14, and the total is no more than the unfiltered total. **3.** No card starts before now; every card's date is D+3 or earlier. |
| EF-6 | From after To | `/education-and-training/events` | Filter with From D+14 and To D+7. | **1.** "No results found." or a message saying the dates are the wrong way round shows, with no error. **2.** Both boxes keep their dates. |
| EF-7 | Featured statewide events | `/education-and-training/events` | 1. Click the "Featured statewide events" link. 2. Wait 10 seconds. 3. Open the search, tick "Featured statewide event" and click "Filter". | **1.** The address has `fa=605` and "Featured statewide event" is ticked. Either "No results found." shows, or every event listed is held at the statewide location: its page's Location or Offered By is the same for every one. **2.** The page stays on `fa=605` with the same results (it doesn't reload to `?page=0`). **3.** The same results as step 1. |
| EF-8 | Location and distance | `/education-and-training/events` | 1. Type "55437" in Location, choose "10 mi" and search. 2. Choose "100 mi" and search again. | **1.** The address has `fp[loc][text]=55437` and `fp[radius]=16.09`, and the form shows both. The total is no more than the unfiltered total. No card without the "Online" tag shows Aitkin, Bemidji, Duluth or Thief River Falls (all more than 50 miles from 55437). **2.** The address has `fp[radius]=160.93` and the form shows "100 mi"; the total is the same as or more than step 1's. |
| EF-9 | Online events are listed whatever the distance | `/education-and-training/events` | 1. Note every event on all pages of `?ff[virtual]=virtual` by the address. 2. Type "Duluth, MN" in Location, choose "10 mi" and search, then read all pages. | **1.** At least 1 online event is listed, or the case is skipped with that reason. **2.** Every event from step 1 is listed; every other event listed has an in-person location within about 10 miles of Duluth. This appears to be the intended behaviour (see Open questions). |
| EF-10 | Location suggestions | `/education-and-training/events` | 1. Type "Bloom" in Location. 2. Pick "Bloomington, MN". 3. Search. | **1.** A list of suggestions opens under Location within a few seconds; every suggestion contains "Bloom", and "Bloomington, MN" is among them. **2.** The box shows "Bloomington, MN" and the list closes. **3.** The address has `fp[loc][text]=Bloomington, MN`, and the page shows events or "No results found.". |
| EF-11 | Everything together | `/education-and-training/events` | 1. Search "resume". 2. Tick Resumes, In Person and Workshop, and click "Filter". | **1.** The address has `fq=resume`, and the box shows it. **2.** The address still has `fq=resume` and now also `ft[791]`, `ff[in_person]` and `fy[785]`; all three stay ticked and "resume" stays in the box. Either "No results found." shows, or every card has the tags Resumes, In Person and Workshop, and the total is no more than step 1's. The total and the first page are the same as opening `?fq=resume&ft[791]=791&ff[in_person]=in_person&fy[785]=785` by the address. |

### Search: sort and paging

`tests/functional/events/search-filters.spec.ts`

| ID | Test | Page | Steps | Expected result |
|---|---|---|---|---|
| EO-1 | Sort keeps the search, and without a location both sorts are by date | `/education-and-training/events?fq=job` | 1. Note the total and the order of the first page. 2. Change "Sort by" to Relevance. 3. Change it to Distance. | **1.** At least 1 event is listed. **2.** The address keeps `fq=job` and adds `sort_by=sr`, the dropdown shows Relevance, and the total is unchanged; the cards are in date order. **3.** The address keeps `fq=job` and has `sort_by=sp`, the dropdown shows Distance, the total is unchanged, and the cards are in date order. |
| EO-2 | Distance sort with a location | `/education-and-training/events?fp[loc][text]=55437&fp[radius]=160.93` | 1. Change "Sort by" to Distance. 2. Change it to Relevance. | **1.** The address has `sort_by=sp` and keeps the location and distance. The first card without the "Online" tag shows "Bloomington, MN" if any Bloomington event is listed, and no in-person-only card from a city more than 50 miles away (Aitkin, Bemidji, Duluth, Thief River Falls) comes before a Bloomington card. **2.** The same total as step 1, with the cards in date order. |
| EO-3 | Paging | `/education-and-training/events` | Needs more than 15 events; skipped with that reason otherwise. 1. Note page 1's events and the total. 2. Click page 2 in the pager. 3. Click the last page. | **1.** "Showing 1-15 of N" and 15 event cards. **2.** "Showing 16-30 of N" (or 16-N), the address has `page=1`, the pager marks page 2 as current, and no event is on both pages. **3.** "Showing <from>-N of N" with the matching number of cards (at least 1), and no "Next". |
| EO-4 | Paging keeps the search | `/education-and-training/events?ff[virtual]=virtual&fq=job` | Needs more than 15 results; else uses `?ff[in_person]=in_person`. 1. Note the total and the form's values. 2. Click page 2. | **1.** The online filter and "job" are shown in the form. **2.** The address keeps every filter and the keyword, the form still shows them, the total is unchanged, and every card still matches the filter. |
| EO-5 | No pager when everything fits | `/education-and-training/events?fq=job+club` | Open the page by the address. | When the total is 15 or less every event is on one page and there is no pager; if the total is over 15 the case is skipped with that reason. |

### The address

`tests/functional/events/search-address.spec.ts`

| ID | Test | Page | Steps | Expected result |
|---|---|---|---|---|
| EU-1 | A search opened from a link | `/education-and-training/events?fq=job&ft[789]=789&ff[in_person]=in_person&fs=<D+1>&fe=<D+30>&fp[loc][text]=55437&fp[radius]=160.93&sort_by=sp` | Open the address in a fresh browser that has never visited the site. | **1.** The form shows every value: "job", Job Search and In Person ticked, the From and To dates, "55437", "100 mi" and Distance. **2.** Either "No results found." shows, or every card has the Job Search and In Person tags and a date from D+1 to D+30. |
| EU-2 | The forms keep each other's values | `/education-and-training/events` | 1. Search "job". 2. Tick Job Search and click "Filter". 3. Type "55437" in Location, choose "100 mi" and search. 4. Change "Sort by" to Relevance. | After every step the address and the form hold everything chosen so far, and the total and first page are the same as opening an address with only those values (`fq`, `ft`, `fp`, `sort_by`). **1.** `fq=job`. **2.** Also `ft[789]=789`, still ticked. **3.** Also the location and 100 mi; "job" and Job Search are kept. **4.** Also `sort_by=sr`; everything else is kept. |
| EU-3 | Back and Forward | `/education-and-training/events` | Run three searches in a row ("job club"; Online with "Filter"; "resume" with Sort Relevance), then click Back twice, then Forward twice. | **1.** Each Back and Forward shows that search's address, its form values (Event Name, the ticked filters, Sort by) and its results: the same total and first page as when it was first run. **2.** No form shows the values of a different search. |
| EU-4 | Reset | `/education-and-training/events?fq=job&ft[789]=789&ff[in_person]=in_person&fp[loc][text]=55437&fp[radius]=160.93&sort_by=sr` | Click "Reset" (on a phone, the "Reset" button). | **1.** The address is `/education-and-training/events` with nothing after it. **2.** Every box is empty, nothing is ticked, Distance shows "40 mi". **3.** The total is the unfiltered total. |
| EU-5 | Bad values in the address | See [the table below](#eu-5-values) | One test per row: open the search with the row's value by the address. | **1.** The page loads with no error. **2.** What the row says. |
| EU-6 | Script and HTML in the search are never run | `/education-and-training/events` | 1. Type `<script>alert(1)</script>` in Event Name and search. 2. Type it in Location and search. 3. Open `?fq="><img src=x onerror=alert(1)>` by the address, then the same value in `fp[loc][text]`. | At every step no alert or other dialog opens, and the page gains no `<script>` and no `<img>` with an `onerror` from the search. The firewall's "403 Forbidden" page is a pass. When the events page loads instead, it shows the characters as plain text wherever it repeats the search (the boxes, the page title). **1.** As above for Event Name. **2.** As above for Location. **3.** As above for both addresses. |

#### EU-5 values

| Value added to the address | Expected result |
|---|---|
| `sort_by=bogus` | The same events and total as with no sort, and "Sort by" shows Distance or Relevance (not "No results found." or a missing dropdown). |
| `page=999` | Either the last page's events with a matching "Showing" line, or "No results found." with a pager or link back; never a "Showing … of N" line with no cards. |
| `page=-1`, then `page=abc` | The first page, the same as with no `page`. |
| `fs=notadate` | Ignored: the From box is empty, and the results are the same as with no `fs`. |
| `fe=2026-13-45` | Ignored or "No results found."; the To box is empty or shows nothing invalid. |
| `fp[loc][text]=55437&fp[radius]=abc` | The Distance dropdown shows a real choice, and the results are the same as for that choice with 55437. |
| `ft[99999]=99999` | "No results found." or the unfiltered results, and no topic is ticked. |
| `fy[abc]=abc` | "No results found." or the unfiltered results, and no type is ticked. |
| `fa=1`, then `fa=abc` | "No results found." or the unfiltered results, and "Featured statewide event" is not ticked. |

### What the search leaves out

`tests/functional/events/listing-rules.spec.ts`

| ID | Test | Page | Steps | Expected result |
|---|---|---|---|---|
| EI-1 | Only events within the window, and only events | `/education-and-training/events` | Read every card on every page of the unfiltered search. | **1.** Every card links to `/events/event-occurrence/<id>`, `/events/external/…` or `/events/event-external/<id>`. **2.** Every occurrence card starts within the window: no event that has already started today, and none more than 45 days from now. **3.** No event is listed twice. |
| EI-2 | Nothing after the window | `/education-and-training/events?fs=<D+46>&fe=<D+365>` | Open the page by the address. | No card links to `/events/event-occurrence/<id>`: the page shows "No results found." or only external events. |
| EI-3 | An occurrence more than 45 days ahead stays out of every listing | an occurrence more than 45 days ahead | Find one as in [Login and test data](#login-and-test-data); skipped with that reason if none. 1. Open its page. 2. Search its title, all pages. 3. Open the homepage, its Offered By location page (all pages of Events), and the page of another date of the same event. | **1.** The page opens with its title and date. **2.** No card links to it. **3.** No "Upcoming Events" card, no location page card, and no "Additional times" row links to it. |
| EI-4 | A private occurrence stays out of every listing | the environment's private occurrence | Skipped with a reason where none is known. 1. Search its title, all pages. 2. Open the homepage and its location page (all pages of Events). 3. Open 10 other events' pages. | **1.** No card links to any date of it. **2.** No card links to it. **3.** No Similar Events card links to it. |
| EI-5 | A cancelled or draft occurrence is hidden from visitors | the environment's cancelled or draft occurrence | Skipped with a reason where none is known. 1. Open its page. 2. Read every card on every page of the unfiltered search. | **1.** No event details show: the visitor lands on the login page (`/user/login?destination=/events/event-occurrence/<id>`) or an access denied or "Page Not Found" page. **2.** No card links to it. |
| EI-6 | A past occurrence | a past occurrence | Find one as in [Login and test data](#login-and-test-data); skipped with that reason if none. 1. Open its page. 2. Read every card on every page of the unfiltered search, the homepage carousel and its location page. | **1.** The page opens with its title, date and time, and its "Additional times" table (if any) lists only dates still to come. **2.** No card links to it. |

### External events

`tests/functional/events/external-events.spec.ts`

| ID | Test | Page | Steps | Expected result |
|---|---|---|---|---|
| EX-1 | External events in the results | `/education-and-training/events` | Read every card on every page, then on every page of `?fy[784]=784`; skipped with a reason if no card links to an external event. | **1.** Each external event's card has a title linking to `/events/external/…` (or `/events/event-external/<id>`), tags, a date, a start and end time and a location line, like an occurrence card. **2.** Each is in date order among the other events. |
| EX-2 | An external event's page | the first external event from EX-1, else the environment's known one | 1. Open the page. 2. Look at its "Learn more" link. | **1.** The h1 is "<name> <Weekday, Month D, YYYY>"; the tags, the description, Date, Time, Location (its address) and Offered By (the host's name) show. There is no "Log In or Create Account" and no registration message. If "Similar Events" shows, its cards link to other events, not this one. **2.** It goes to another site, opens in a new tab (`target="_blank"`) and has `rel="noopener"` (or `noreferrer`). |
| EX-3 | External events aren't limited to 45 days | `/education-and-training/events?fs=<D+46>&fe=<D+365>` | Open the page by the address, once an active external event dated more than 45 days ahead is known (see Open questions); until then the case is skipped with that reason. | The external event is listed. |
| EX-4 | An external event that doesn't exist | `/events/event-external/99999999` | Open it. | **1.** The site answers 404 with "Page Not Found". **2.** No empty event page shows. |

### The occurrence page

`tests/functional/events/occurrence-page.spec.ts`

| ID | Test | Page | Steps | Expected result |
|---|---|---|---|---|
| ED-1 | Every block of an event page | the first card of the search | 1. Open the first card's event. 2. Click the "Offered By" link. | **1.** The address is `/events/event-occurrence/<id>` or its alias. The h1 is "<title> <Weekday, Month D, YYYY>" and the page title is "<same> \| CareerForce". The tags, the description, "Please create an account or log in to register for this event." and a "Log In or Create Account" button show, with no "Register" button. "Date", "Time", "Location" and "Offered By" headings show with the card's date, its start and end time, a location and a link. **2.** The location page whose name is the Offered By text opens. |
| ED-2 | An in-person location | the first In Person-only event of the search | Open its page. | **1.** Location shows the place's name and a street address ending in "MN" and a 5-digit ZIP. **2.** A map shows. |
| ED-3 | Held somewhere other than the office offering it | a meeting-location event (see [test data](#login-and-test-data)) | Skipped with a reason if none. 1. Open its page. 2. Find its card on the search. | **1.** Location shows the meeting place's name and address, and Offered By shows the office, as a link to its page. **2.** The card's location line shows the meeting place's city. |
| ED-4 | An online-only event | the online-only event | Open its page. | **1.** The tags start with "Online" and don't include "In Person". **2.** Location shows "Online" with no street address and no map. **3.** Offered By shows the office, as a link. |
| ED-5 | A hybrid event | the hybrid event | Skipped with a reason if none. 1. Open its page. 2. Find its card on the search. | **1.** The tags include "In Person" and "Online"; Location shows "Online", "or", and the place's name and address. **2.** The card's location line is "<City>, MN and Online". |
| ED-6 | Additional times and "See More" | an event with more than 3 other dates | 1. Open its page. 2. Click "See More". | **1.** "Additional times are offered for this event:" shows a table with "Date & Time" and "Action" columns and 3 rows. Every row is a date of the same event still to come, within the window, not this page's own date, in date order, with a "View" link to another `/events/event-occurrence/<id>` whose page has the same title. A "See More" button tells screen readers "Show N more times for this event." **2.** All N + 3 rows show, the button is gone, focus moves to the 4th row's "View" link, and "Loaded N additional event times for this event." is announced. |
| ED-7 | No other dates | an event with no other dates | Open its page (skipped with a reason if there is none). | No "Additional times are offered for this event:" heading or table shows. |
| ED-8 | Similar Events | the first of the search's events (up to 10) with a "Similar Events" block | Skipped with a reason if none of 10 has one. 1. Open its page. 2. Open the first similar event. | **1.** "Similar Events" shows 1 to 4 cards, each with a date, a title, a time and a location, and a link to `/events/event-occurrence/<id>` or an external event. None links to this page or to a date in its "Additional times" table, and none is in the past. **2.** The page that opens has the card's title and date. |
| ED-9 | A full event | the full event | Open its page (skipped with a reason if there is none). | **1.** "This event is full!" shows with "CareerForce offers priority of service to veterans, current service members, and eligible spouses." **2.** The visitor still sees "Please create an account or log in to register for this event." and "Log In or Create Account", and no "Register" or "Join Waitlist". |
| ED-10 | "Log In or Create Account" leads to LoginMN | the first card's event | Click "Log In or Create Account", without logging in or going further than the first LoginMN page. | The browser goes to the LoginMN login page (on QA `dev-login.mn.gov`), with a `redirect_uri` back to this site's `/openid-connect/loginmn`. |
| ED-11 | An event page that doesn't exist | `/events/event-occurrence/99999999`, then `/events/event-occurrence/abc` | Open each. | **1.** Each answers 404 with "Page Not Found". **2.** No empty event page shows. |

### Homepage and location pages

`tests/functional/events/homepage-location-events.spec.ts`. On the
homepage, read only the carousel's real slides, not the copies it adds.

| ID | Test | Page | Steps | Expected result |
|---|---|---|---|---|
| EH-1 | Upcoming Events on the homepage | `/` | 1. Read every event in "Upcoming Events". 2. Open the Events search. 3. Click "Find a filterable list of all events, workshops and appointments". | **1.** The heading "Upcoming Events" shows, with 1 to 9 events, each listed once, in date order and within the window. Each card has a date, a title linking to `/events/event-occurrence/<id>`, a start and end time, and a location. **2.** The carousel's events are the first occurrences of the search in date order (events with the same start may swap). **3.** The Events search opens. |
| EH-2 | Moving through the carousel | `/` | 1. Click "Next". 2. Click "Previous". 3. Click the last dot button ("N of N"). | **1.** The next card(s) slide into view. **2.** The first card(s) are back. **3.** The last card shows. |
| EH-3 | "Distance from" on the homepage | `/` | 1. Type "55437" in the carousel's Location, choose "10 mi" and click "Apply". 2. Reload the page. | **1.** The cards change without leaving the homepage; every card without an online format is in Bloomington or within about 10 miles of it, and no card shows Aitkin, Bemidji (unless the event is online), Duluth or Thief River Falls. The Location box keeps "55437" and the dropdown "10 mi". **2.** The same values and the same cards. |
| EH-4 | "Distance from" with nothing in person nearby | `/` | Type "Duluth, MN" in the carousel's Location, choose "10 mi" and click "Apply". | Either every card is an online or hybrid event (its page's Location starts with "Online"), or the carousel's empty text, starting "No results found", shows. |
| EH-5 | A location page's Events | `/careerforce-location/careerforce-bemidji`, else the first location page with an "Events" section | 1. Read the "Events" section. 2. Go to page 2 of its pager. 3. Click "Find a filterable list of all events". | **1.** The heading "Events", 1 to 6 cards in date order and within the window, each with a date, a title link, a time and a location; each card's event page has this location as Offered By. A pager shows when there are more than 6 events. **2.** Up to 6 other events, none from page 1, still in date order. **3.** The Events search opens. |
| EH-6 | A location with no events | the first location page on `/locations` whose location offers none of the search's events | Open it (skipped with a reason if every location has events). | No "Events" heading and no event cards show. |
| EH-7 | Online-only event cards show where it really is ([MNDEED-9620](https://portland-webworks.atlassian.net/browse/MNDEED-9620)) | the online-only event's pages | 1. Read its card on the Events search. 2. Read its card on the homepage (any slide). 3. Read its card on its Offered By location page. 4. Read its card in Similar Events on another event's page, if any. | Each card's location line is the same as its event page's Location ("Online"), never "<City>, MN or Online", and its link's accessible name doesn't name an in-person city either. **1.** On the search. **2.** On the homepage. **3.** On the location page. **4.** In Similar Events (skipped if no Similar Events block lists it in the first 10 events). |

### At phone width

`tests/functional/events/search-detail-responsive.spec.ts`. Each case sets
the browser to 390 × 844 pixels and checks that no page in it scrolls
sideways.

| ID | Test | Page | Steps | Expected result |
|---|---|---|---|---|
| EM-1 | The search at phone width | `/education-and-training/events` | 1. Look at the page. 2. Search "job club". | No sideways scrolling and nothing cut off. **1.** The quick links, the search form, "Filters", "Reset", "Sort by" and the cards fit the width; the sidebar filters are hidden. **2.** The results update as in EV-4, and every card fits the width. |
| EM-2 | The filters drawer | `/education-and-training/events` | 1. Tap "Filters". 2. Tick Online and tap "Filter". 3. Tap "Filters", then press Esc. 4. Tap "Filters", then tap "Close filters". | **1.** The drawer opens with "Close filters", Topic, Format, Type, Date Range, "Featured statewide event" and "Filter", all visible without sideways scrolling; focus moves into it, and "Filters" tells screen readers it is expanded (`aria-expanded="true"`). **2.** The address has `ff[virtual]=virtual` and every card has the "Online" tag. **3.** The drawer opens with Online still ticked; Esc closes it and focus goes back to "Filters", which now says collapsed. **4.** "Close filters" closes it, and focus goes back to "Filters". |
| EM-3 | An event page at phone width | an event with more than 3 other dates | 1. Open its page. 2. Tap "See More". | **1.** Every block (tags, description, login prompt, Date, Time, Location, Offered By, Additional times, Similar Events) is one above the other and fits the width; the table fits or scrolls inside its own box. **2.** All rows show and still fit. |
| EM-4 | Homepage and location page events at phone width | `/`, then the EH-5 location page | 1. On the homepage, look at "Upcoming Events" and tap "Next". 2. On the location page, look at "Events". | **1.** At least one whole card shows, with its date, title, time and location readable, and "Next" moves to the next card. **2.** The cards and the pager fit the width. |

### Keyboard and accessibility

`tests/functional/events/search-detail-accessibility.spec.ts`. Keyboard cases
use only Tab, Shift+Tab, Enter, Space, Esc and the arrow keys. "Focus is
visible" means the focused control shows an outline, ring or other change
that isn't there when it isn't focused.

| ID | Test | Page | Steps | Expected result |
|---|---|---|---|---|
| EK-1 | Search and filter with the keyboard only | `/education-and-training/events` | 1. Tab from the top of the page to the Job Search topic and press Space. 2. Tab to "Filter" and press Enter. 3. Tab to Event Name, type "job" and press Enter. | Focus is visible at every stop, and the stops follow the order on screen. **1.** The topic is reached by Tab and Space ticks it. **2.** The filter runs: the address has `ft[789]=789`. **3.** The search runs: the address has `fq=job` and keeps `ft[789]=789`. |
| EK-2 | The skip link | `/education-and-training/events` | Tab to "Skip to event search results" and press Enter. | Focus moves to the results area, and the next Tab reaches the results (the sort or the first card), not the header or the filters. |
| EK-3 | Sort with the keyboard only | `/education-and-training/events?fq=job` | 1. Tab to "Sort by". 2. Choose Relevance with the keyboard (open it with Space or Alt+Down, move with the arrows, confirm with Enter). | **1.** Focus is visible on the dropdown. **2.** Moving through the options doesn't reload the page until the choice is confirmed; after confirming, the address has `sort_by=sr` and keeps `fq=job`. |
| EK-4 | Dates with the keyboard | `/education-and-training/events` | Tab to "From", type D+7, Tab to "To", type D+14, then Tab to "Filter" and press Enter. | The address has `fs=<D+7>` and `fe=<D+14>`, both boxes keep their dates, and every card is within the range. |
| EK-5 | An event page with the keyboard only | an event with more than 3 other dates | 1. Tab through the page from the h1 to the end of the main content. 2. Tab to "See More" and press Enter. 3. Tab to the accommodation phone number's tooltip button and press Enter, then Esc. | Focus is visible at every stop. **1.** "Log In or Create Account", the Offered By link, the phone link (when it is a link), the tooltip button, every "View" link and every Similar Events link are reached, in the order on screen. **2.** All rows show and focus moves to the 4th row's "View" link. **3.** The tooltip opens and Esc closes it. |
| EK-6 | The carousel with the keyboard only | `/` | 1. Tab into "Upcoming Events". 2. Tab to "Next" and press Enter. 3. Tab to a dot button and press Enter. | **1.** Only links in the cards that are on screen are reached; no link in a hidden or copied slide is. **2.** The carousel moves on. **3.** That slide shows. |
| EK-7 | Every control has a name | `/education-and-training/events`, then an event with more than 3 other dates | Read the accessibility tree of each page (on the search, at desktop and at phone width). | **1.** Every text box, dropdown, checkbox, button and link in the filters, the search form, the sort, the cards and the pager has a non-empty name; Event Name, Location, Distance, Sort by, From and To have labels (not only hints), and the phone's "Filters" button is named "Filters". **2.** On the event page, "See More" says how many more times it shows, each "View" link names its date, and the tooltip button names what it explains. **3.** Every card link's name has the event's title, date, start time and the same place as its visible location line. |
| EK-8 | Headings | `/education-and-training/events`, then an event with more than 3 other dates | Read the headings of each page. | **1.** Each page has exactly one level-1 heading: "Events" on the search, "<title> <date>" on the event page. **2.** On the search, each event's title is a heading, all at the same level below level 1 (see Open questions); the filter groups are named groups (Topic, Format, Type, Date Range). **3.** On the event page, Date, Time, Location, Offered By, "Additional times are offered for this event:" and "Similar Events" are level-2 headings. **4.** No level is skipped on the way down. |

## Good to know

- **Two forms on the search.** The sidebar (filters, "Filter") and the
  search form (Event Name, Location, Distance, "Search") are separate forms,
  and "Sort by" is a third. Each sends only its own fields plus hidden
  copies of the others', so EU-2 checks that nothing is dropped.
- **Distance is sent in kilometres:** 10 mi is `16.09`, 40 mi `64.4`,
  100 mi `160.93`.
- **The pager counts from 0:** page 2 is `page=1`.
- **The display window** is 45 days from now, to the minute, in
  America/Chicago. An event that started earlier today is gone from the
  listings.
- **Card dates** read "November 12, 2026" on the search and "Thursday,
  November 12th, 2026" on the homepage, location pages and Similar Events.
- **The homepage carousel** adds copies of its slides for looping; count
  only the real ones (`.slick-slide:not(.slick-cloned)` on QA).

## Mobile

On the phone (`functional-mobile`, Pixel 7) these run too: EV-1, EV-3, EV-4,
EF-3 and EU-4 (through the "Filters" drawer and the phone's "Reset"
button), ED-1, ED-4, ED-6, EH-1, EH-5 and EH-7. Every other case is
`@desktop-only`: what it checks happens on the server, so once is enough.
EM-1 to EM-4 set their own 390 × 844 size and the EK cases are keyboard
cases, so both run on desktop only. On the phone each case also checks that
the page doesn't scroll sideways.

## Expected result

| Project | Cases |
|---|---|
| `functional-desktop` | EV-1 to EV-8, EF-1 to EF-11 (EF-1 is 6 tests, EF-4 step 1 is 3), EO-1 to EO-5, EU-1 to EU-6 (EU-5 is 1 test per row), EI-1 to EI-6, EX-1 to EX-4, ED-1 to ED-11, EH-1 to EH-7, EM-1 to EM-4, EK-1 to EK-8 |
| `functional-mobile` | EV-1, EV-3, EV-4, EF-3, EU-4, ED-1, ED-4, ED-6, EH-1, EH-5, EH-7 |

## Not covered

- **Registering, the waitlist, and what a logged-in job seeker sees** on an
  event page: functional-events-registration.
- **Creating, changing or cancelling events** (including making one private
  or cancelled to test it): functional-events-scheduling. EI-4 and EI-5 use
  ones that already exist.
- **"Submit an Event"** and how an external event gets published:
  functional-events-external-submissions.
- **Where LoginMN sends the visitor after logging in** (back to the event?).
  ED-10 stops at the LoginMN page.
- **The exact distance of each event.** The cards don't show one, so EF-8,
  EF-9, EO-2 and EH-3 use offices that are clearly near or far.
- **A full accessibility audit** (colour contrast, zoom to 400%, screen
  reader testing).

## Open questions

1. **The page's own search and filter forms don't filter on QA**
   (2026-11-12): they add `form_id=toolshed_search_filter_form` to the
   address, and the results stay unfiltered. EV-4, EF-1 to EF-5, EF-8, EF-9,
   EF-11, EU-2 and EM-2 expect the forms to filter, so they fail until this
   is fixed. Is there a ticket? The smoke FL cases open the filtered
   address directly, so they don't see it.
2. **An external event more than 45 days ahead (EX-3).** External events
   are not limited to the 45-day window (decided 2026-11-12). Can the team
   keep an active external event dated more than 45 days ahead on QA and
   Stage, so EX-3 can run?
3. **A past occurrence's page (EI-6)** still says "Please create an account
   or log in to register for this event." Should it say the event has
   passed and not invite registration? EI-6 doesn't check this until it is
   answered.
4. **Known private and cancelled or draft occurrences (EI-4, EI-5).** A
   visitor can't tell which occurrences are private, cancelled or draft.
   Can the team name one of each on QA, Stage and Production (or keep
   `Playwright test` ones on QA and Stage)? On QA, "Applications 101" at
   Aitkin appears to be private: is it? Should a visitor be able to open a
   private occurrence's page by its address, as they can on QA?
5. **Online events and distance (EF-9, EH-4).** Online and hybrid events
   showed for every location and distance, on the search and on the
   homepage. Is that intended (as it is for appointments)?
6. **Hybrid wording.** The hybrid Job Club's card says "Minneapolis, MN and
   Online" on the search and "Minneapolis, MN or Online" on its location
   page and in the link names. Which is right? ED-5 expects the search's
   "and"; the location page isn't checked.
7. **Bad values (EU-5).** On QA `sort_by=bogus` empties the results,
   `page=999` shows "Showing 46-59 of 59" with no cards, and
   `fp[radius]=abc` shows "No results found." with "10 mi". EU-5 expects
   the friendlier behaviour in its table; confirm.
8. **Event card titles as headings (EK-8).** On QA the cards' titles are
   links, not headings, so screen reader users can't jump between events.
   Should they be headings, as job titles are on Job Search?
9. **The firewall and EU-6.** A request with markup in the address gets
   "403 Forbidden", and after a few of them the firewall refused every
   request from the browser for about 20 seconds. Is that a rate rule? Is
   the same firewall on Stage and Production? Until this is known the plan
   isn't `Parallel: yes`; if EU-6 can't trip a block for other tests, the
   plan can be.
10. **Phone width.** At 390 × 844 the search page was 383 px wide in a
    375 px client area. EM-1 expects no sideways scrolling; confirm on a
    real phone width once the test runs.

## Suggested files

```
tests/
  functional/events/
    search.spec.ts                       # EV-1 .. EV-8
    search-filters.spec.ts               # EF-1 .. EF-11, EO-1 .. EO-5
    search-address.spec.ts               # EU-1 .. EU-6
    listing-rules.spec.ts                # EI-1 .. EI-6
    external-events.spec.ts              # EX-1 .. EX-4
    occurrence-page.spec.ts              # ED-1 .. ED-11
    homepage-location-events.spec.ts     # EH-1 .. EH-7
    search-detail-responsive.spec.ts     # EM-1 .. EM-4
    search-detail-accessibility.spec.ts  # EK-1 .. EK-8
    helpers/
      events-test-data.ts                # per-environment IDs (private, cancelled, external) and the ID probing in "Login and test data"
  pages/
    events-search.page.ts                # reuse and extend: both forms, the drawer, all cards across pages, card tags and location line
    event-occurrence.page.ts             # blocks, Additional times and See More, Similar Events
```

The spec files don't depend on each other or on running in order.
