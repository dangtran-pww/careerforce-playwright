# [Functional] - Appointments - Search - Test Plan

Status: ready to generate
Implemented test: —

## Overview

Part 1 of 4 of the functional plans for Appointments. It tests what a
visitor sees of appointments: the public search at
`/connect-careerforce/schedule-an-appointment` (the page on first load, the
Monday to Friday week strip, picking a day, Previous and Next Week, weekend
dates, the 8-day booking window, the Location, Distance From and Format
filters alone and together, location suggestions, results grouped by
location with one button per open time, the times the search hides, bad and
odd values in the address, the filters and the day kept together, Reset and
empty days), where a time button and the booking addresses lead for a
visitor, the other public pages that link to the search, and the page at
phone width, with the keyboard and for screen readers.

The other parts (not written yet):

- functional-appointments-scheduling (admin: the session form and its
  validation, recurrence and Until, Draft / Active / Cancelled, single-slot
  overrides, shortening a schedule, delete and cancel, who can schedule),
- functional-appointments-booking (job seeker: the booking form, Tier 1
  hand-off and the 15-minute hold, full / already booked / reserved
  messages, partner and staff accounts, the success page, My Events &
  Appointments and cancelling),
- functional-appointments-attendance (staff: add attendee, cancel
  registration, Resend Confirmation, Mark Attended and Undo Attendance,
  late attendees, bulk actions, permissions by role).

This plan is the in-depth version of the quick visitor checks in the Smoke
suite: AP-1 and AP-2 in [smoke-appointments.md](../smoke/smoke-appointments.md)
(open times are listed; every offered date is from D to D+8 and D+9 to D+14
are empty), and AM-5 with its "Appointments search cases" in
[smoke-admin-maintenance.md](../smoke/smoke-admin-maintenance.md) (default
day, pick a day, week navigation, each format on its own, two formats, the
format narrowing a day, the last location moving first, the radius hiding a
far in-person-only time while phone and online times stay, Reset, an empty
day beyond the window, the booking link's address). Those aren't repeated
here; the cases below go further (to the minute, every day of the strip,
weekend dates, suggestions, combined filters, odd values, keyboard and
screen readers). Some overlap is expected; the case IDs here are its own.

Every case runs as a visitor who isn't logged in and changes nothing, so the
whole plan is safe on QA, Stage and Production. It is **not** marked
`Parallel: yes`, although it only reads the site: what it checks is the
open slots on the site, which the smoke-appointments plan and parts 2 to 4
book, cancel and create on QA and Stage, so a case that compares a filtered
day with the same day unfiltered could see a slot come or go between the
two reads (Rule 3, point 2). AU-4 also sends markup in the address, which
the firewall can answer with "403 Forbidden" and then block the browser for
a short time (see
[functional-events-search-detail → Open questions](../events/functional-events-search-detail.md#open-questions)).

Where the cases come from: the request for this part (the scope above), the
knowledge base `docs/kb/appointments/` and the app source, and what QA
showed on 2026-11-12.

## Login

| | |
|---|---|
| **Role** | None. A visitor who isn't logged in. No saved session is loaded. |
| **Accounts touched** | None. AE-1 follows a time button to the site's "Log In or Register" page and stops there. Nothing is booked. |

## Scope

- **In:** everything a visitor can see or do with appointments without
  logging in: the search page, its address, the visitor's hand-off to the
  login page, and the public links to the search.
- **Out:** scheduling (functional-appointments-scheduling), booking as a job
  seeker and anything behind a login (functional-appointments-booking), and
  staff actions on a slot (functional-appointments-attendance). Events: the
  Events plans.
- **Read-only:** no case books, holds, submits or logs in. The only form
  used is the search's filter form, which only reads (GET). No time button
  is followed further than the login page.

## Checked in every case

These hold after every step of every case, and a case fails if one doesn't:

- **No JavaScript error** from the site's own scripts in the browser
  console. Failed loads of other sites' files (Google Tag Manager, the AWS
  firewall's `challenge.js`) are ignored; both failed in the planning
  browser on QA.
- **No failed request** to the site itself (no 4xx or 5xx answer from the
  CareerForce host), except where a case expects one (AE-2, AU-4).
- **No raw error on the page:** no "The website encountered an unexpected
  error", no PHP or Drupal error message, no stack trace.

## Login and test data

No account is needed. The cases use whatever appointment times the site
has, and never check an exact count or a fixed location. A few cases need a
particular kind of time; the test finds one as described, or uses the
environment's entry in the table below, and is skipped with the reason when
there is none.

| What | How the test finds it | On QA (2026-11-12) |
|---|---|---|
| D and "now" | Today and the time now in America/Chicago, the site's timezone. The window runs from now to now + 8 days, to the minute. | D = Thursday 2026-11-12, about 4:00 PM; the window ends Friday 2026-11-20 at about 4:00 PM |
| Reference day | The first linked day of the strip (this week, then next week) whose page has at least 1 time button. | 2026-11-13: Aitkin 10:45 am and Bloomington 8:30 am, both "online phone in person" |
| Day with 2 or more locations | The first day of the strip (this week, then next) with 2 or more location cards. | 2026-11-13 (Aitkin, Bloomington); 2026-11-19 (Duluth, Faribault) |
| Time that lacks a format | The first time button, on any day of the strip, that doesn't list all three formats. | Bloomington 7:00 am "phone" (11-16, 11-18, 11-20); Faribault 10:00 am and 2:00 pm "phone in person" (11-17); Faribault 9:30 am "phone" (11-19) |
| Day with no time in one format | The first day of the strip with times where no time lists that format. | 2026-11-17 has no "online" time |
| In-person-only time | The first time button on any day of the strip that lists only "in person". | None |
| Far city | For a location, a city at least 50 miles from it: Duluth for a Twin Cities or southern location, Bloomington (55437) for Duluth, Aitkin, Bemidji or northern locations. | — |
| Day in the strip marked empty | A linked day whose name ends in ". No results on this date." | 2026-11-12 once another day is selected (no time left today after 4:00 PM) |
| Times beyond the window | Per environment, from the team or the admin check in smoke-appointments. | Bloomington session #328 has Active, unbooked times on 2026-11-23, 11-25 and 11-27 (seen as `admin` for smoke-appointments) |
| Booked, Draft and Cancelled times in the window | Per environment, from the team (a visitor can't tell them apart: every booking address sends a visitor to the login page). | None known. Slot 522 is booked but past. See Open questions. |
| Time with several seats | Per environment, from the team: one time and place with 2 or more open slots, ideally with different formats. | None known. See Open questions. |

## What the site has

Checked on QA as a visitor (no login) on 2026-11-12, between about 3:55 PM
and 4:30 PM Central, without saving or booking anything.

**Search page** (`/connect-careerforce/schedule-an-appointment`, title
"Schedule an Appointment | CareerForce"):

- h1 "Schedule an Appointment"; breadcrumb "Home" > "Connect With
  CareerForce".
- Sidebar "Appointment Search Filters" (h2): "Location" (a combobox,
  `location[loc][text]`, no hint, `maxlength` 255, plus a hidden
  `location[loc][latlng]`), "Distance From" (`location[radius]`, 10 mi to
  100 mi in 10 mi steps, sent in km: 10 mi `16.09`, 40 mi `64.4` (the
  default), 100 mi `160.93`), the text "Phone and Online appointments
  outside your selected radius will appear in search results.", a "Format"
  group with "Online", "Phone" and "In person" checkboxes
  (`format[online]=online`, `format[phone]=phone`,
  `format[in_person]=in_person`), and a "Filter" button. A "Reset" button
  shows only when the address has a value (a day, a filter); it isn't there
  on first load.
- The week strip: a month h2 ("November", or "November/December" when the
  week spans two months), then a list named "Appointment booking dates":
  "Previous Week", Monday to Friday, "Next Week". Each day shows its short
  weekday and day number to the eye and its full date ("Friday, November
  13, 2026") to screen readers. Days before today are plain text "<date>,
  disabled". The selected day is plain text (`aria-current="date"`); today
  also shows "Today". Other days are links to `?start=YYYY-MM-DD` that keep
  every other value in the address, and a day with no times is named
  "<date>. No results on this date." (this follows the filters: with
  Online on 11-17, 11-16, 11-18 and 11-20 were marked). A disabled arrow is
  plain text "Previous Week, disabled" / "Next Week, disabled".
- On 2026-11-12: the strip showed November 9 to 13 with today selected,
  Previous Week disabled and Next Week to `?start=2026-11-16`. The week of
  November 16 had Previous Week to `?start=2026-11-13` (the Friday, not
  today) and Next Week disabled. So the strip reached two weeks.
- A visually hidden h2 "Available appointments for <Weekday, Month D,
  YYYY>", then the results or "There are no appointments available on this
  day. Try adjusting your filters or selecting another day."
- Each location is a card: h3 with its name ("CareerForce in Faribault"),
  then a link per time, then its street address ("201 Lyndale Avenue South
  Suite 1 Faribault, MN 55021"). A time link goes to
  `/appointments/<id>/booking`; it shows the time ("10:00 am"), the date
  ("Tuesday, November 17, 2026", in a `time` element) and a list of formats
  in the order online, phone, in person; its accessible name is all of that
  ("10:00 am Tuesday, November 17, 2026 phone in person"), without the
  location's name. Times in a card were earliest first. With no location
  chosen, cards were in alphabetical order (Aitkin, Bloomington; Duluth,
  Faribault).
- Times on QA, all in the window: 11-13 Aitkin 10:45 am and Bloomington
  8:30 am (all formats); 11-16, 11-18, 11-20 Bloomington 7:00 am (phone);
  11-17 Faribault 10:00 am and 2:00 pm (phone, in person); 11-19 Duluth
  1:00 pm (all) and Faribault 9:30 am (phone). Today (11-12, after 4:00 PM)
  had none. `?start=2026-11-23` was empty with every day marked "No results
  on this date", although session #328 has open times on 11-23, 11-25 and
  11-27. No in-person-only time was in the window.
- **The form works:** ticking Online on 11-19 and clicking "Filter" led to
  `?start=2026-11-19&location[loc][text]=&location[loc][latlng]=&location[radius]=64.4&format[online]=online`,
  kept the day, left Duluth only, and kept Online ticked. The strip's links
  then carried the same values.
- Format results by the address: Online on 11-17 was empty; In person on
  11-17 kept both Faribault times; Online + Phone on 11-19 kept both
  locations.
- Location: typing "Dulu" opened a list of suggestions ("Duluth, MN",
  "Dubuque, IA"; the box has `aria-expanded="true"` and `aria-owns` a
  listbox); picking "Duluth, MN" filled the box and left
  `location[loc][latlng]` empty. Duluth + 10 mi on 11-19 put Duluth first
  and kept Faribault's phone-only 9:30 am. 55437 + 10 mi on 11-13 put
  Bloomington first and kept Aitkin (all formats). In person + 55437 + 10
  mi on 11-19 listed Duluth's 1:00 pm (it also offers online and phone).
  Moorhead + 10 mi on 11-16 kept Bloomington's phone time.
- Reset (on a filtered 11-19) led to the address with nothing after it:
  today, Location empty, 40 mi, nothing ticked.
- Odd values by the address: `start=notadate` and `start=2026-13-45` showed
  today as on first load; `start[]=2026-11-19` showed 11-19;
  `start=2026-11-14` (Saturday) showed the strip of 9 to 13 November with
  no day selected, the heading "Available appointments for Saturday,
  November 14, 2026" and the empty message; `start=2026-11-15` (Sunday)
  showed the strip of 16 to 20 November with no day selected, the heading
  for Sunday and the empty message; `start=2026-11-02` (a past week) showed
  that week with every day disabled, Previous Week disabled, Next Week a
  link, and the empty message; `start=2027-01-04` showed that week with
  Previous Week a link, Next Week disabled, every other day marked "No
  results", and the empty message.
- `location[radius]=abc` (with Duluth), `format[bogus]=bogus` and a
  300-character location each showed an error message twice ("The
  submitted value abc in the Distance From element is not allowed.", "The
  submitted value bogus in the Format element is not allowed.", "location
  cannot be longer than 255 characters but is currently 300 characters
  long."), no week strip at all, and the empty message.
  `format[online]=phone` showed Online ticked but listed Faribault's
  phone-only time too. `location[loc][text]=zzqxqzz` with 10 mi showed no
  message, both 11-19 locations, in the order Faribault, Duluth.
  `page=5` on 11-19 showed the empty message although the day has times.
- `location[loc][text]=<b>x</b>` loaded (200) with `<b>x</b>` as plain
  text in the box; `C++ & "R&D"` showed exactly in the box, with no
  message, and both 11-13 locations.
- A visitor clicking a time (521) went to
  `/user/login?destination=/appointments/521/booking`, "Log In or Register"
  with "Log In or Register with LoginMN". `/appointments/522/booking` (a
  booked, past slot) did the same. `/appointments/99999999/booking` and
  `/appointments/abc/booking`: 404 "Page Not Found". `/appointments/521`:
  404. `/appointments/521/booking-success` sent the visitor to the search.
- At 390 × 844: the sidebar is hidden behind a "Filters" button (no
  `aria-expanded`); the drawer has "Close filters", Location, Distance
  From, the formats, "Filter" and "Reset"; focus moved into it when it
  opened, and Esc closed it and put focus back on "Filters". The page was
  383 px wide in a 375 px client area. The strip's days and arrows and the
  time buttons fitted.
- Tab order on desktop: the header and menus, "Skip to main content", the
  breadcrumb, Location, Distance From, the three formats, "Filter", the
  strip's linked days, then the arrows that are links. Text boxes and
  buttons show an outline on focus, checkboxes a ring. Pressing Enter on
  "Next Week" loaded the next week and put focus on "Previous Week" (Next
  Week was then disabled).

**Links to the search:** `/connect-careerforce` ("Connect With
CareerForce") has "Sign up for a 1:1 appointment" in its content and
"Schedule an Appointment" in its section menu (`#secondary-nav`, also on
`/locations`, hidden there); the Events search has "Book an appointment"
in its quick links and "Book now" in its "Book a 1:1 appointment with a
Career Specialist" promo. The homepage, `/programs-services` and the
Aitkin and Bloomington location pages have no link to the search.

From the KB (`docs/kb/appointments/`) and the app source
(`config/sync/views.view.book_an_appointment.yml`,
`search_api.index.appointment_occurrences`,
`happenings.occurrence_manager_settings.appointments_session`, the
`cf_appointments` module and the theme), not checked on a running site:

- The search is view `book_an_appointment`, page `page_1`, on Search API
  index `appointment_occurrences`. Its fixed filters: start after now; start
  no later than `+8 day` from now; the happenings future-window filter with
  `display_limit_days_in_future: 8`. Results are grouped by location
  (`location_id`) and sorted by distance from the chosen location, then by
  location name; times in a group by start. The pager is 15 a page.
- The index leaves out a slot that is booked (`field_registrant` set) or
  whose end has passed (`SearchIndexingSubscriber`), and unpublished slots
  (`entity_status`): Draft and Cancelled are unpublished, Active is
  published.
- Slots at the same time and place show as one time
  (`LocationAppointmentHelper`): the first slot's link, with the formats of
  all of them combined. When one of them is saved, the others are
  reindexed (`SearchApiHooks`).
- The day (`start`) is a facet. A missing or invalid date (round-trip check
  of `Y-m-d`) uses today, or the next Monday when today is Saturday or
  Sunday (`SearchApiApptWeekRange::getDefaultActiveItem`). A valid weekend
  date is used as is. The strip is the Sunday to Saturday week of the day
  with the weekend days removed. Previous Week goes to the Friday before
  the strip's Monday and is disabled when the strip has today or an earlier
  day; Next Week goes to the next Monday and is disabled when that Monday
  is more than 8 days after today
  (`BefDaysInWeekBookAnAppointment`).
- The "Available appointments for" heading uses `start` from the address,
  or today when there is none (`ResultsHeading`). On a weekend with no
  `start`, it would name the Saturday or Sunday while the strip shows the
  next Monday (see AW-7).
- The Location filter: `require_valid: false`, so a location that can't be
  found should give "The location "<text>" could not be resolved and was
  ignored." and no distance filter. Suggestions come from Google Places,
  biased to Minnesota. The radius applies only to in-person-only slots;
  phone and online slots show at any distance (confirmed by the team, see
  AM-5).
- After a week arrow is used, `days-in-week-focus.js` puts focus back on
  that arrow, or on the first link of the strip when the arrow is now
  disabled.
- The booking page needs a login (`_user_is_logged_in`), so a visitor is
  sent to `/user/login?destination=…`. The success page sends anyone but
  the person who booked to the search page or their own appointments.
- The KB says: "Dates: a week view, Monday to Friday. On a weekend it opens
  on the next Monday." and "What's hidden: booked and past times." The
  source also hides Draft and Cancelled times.

## Test cases

"Page" is the address after the site name. "The search" is
`/connect-careerforce/schedule-an-appointment`. "Filter" means filling or
ticking the sidebar (on a phone, the "Filters" drawer) and clicking its
"Filter" button; "by the address" means opening the address directly. "A
time" is a time button in a location card. "Within the window" means
starting later than now and no later than now + 8 days. Dates such as D+8
are calendar days from D. Counts are never compared with a number written
here; a filtered day is compared with the same day unfiltered, read in the
same test.

The cases are in one table, one area after another. Their tests are in
`tests/functional/appointments/`:

- **AQ (first load and results):** `search.spec.ts`.
- **AW (week strip and the booking window):** `week-strip.spec.ts`.
- **AF (filters):** `filters.spec.ts`. Each filter is used through the
  page's form, then compared with the same values opened by the address.
- **AH (what the search hides):** `hidden-slots.spec.ts`. A visitor can't
  tell a booked, Draft or Cancelled slot from an open one (every booking
  address sends a visitor to the login page), so these cases use slots the
  team names per environment.
- **AU (the address):** `search-address.spec.ts`. AU-3's values are in
  [Test data](#au-3-values).
- **AE (where a time leads, and links to the search):** `entry-points.spec.ts`.
- **APW (at phone width):** `search-responsive.spec.ts`. Each case sets the
  browser to 390 × 844 pixels and checks that no page in it scrolls
  sideways.
- **AK (keyboard and accessibility):** `search-accessibility.spec.ts`.
  Keyboard cases use only Tab, Shift+Tab, Enter, Space, Esc and the arrow
  keys. "Focus is visible" means the focused control shows an outline, ring
  or other change that isn't there when it isn't focused.

| ID | Test | Page | Steps | Expected result |
|---|---|---|---|---|
| AQ-1 | Everything is on the page when it first loads | `/connect-careerforce/schedule-an-appointment` | Open the search with nothing after it, on a weekday (on a weekend see AW-7), and look at the whole page. | The page shows: **1.** The title "Schedule an Appointment \| CareerForce" and the h1 "Schedule an Appointment". **2.** "Appointment Search Filters" with an empty "Location" box, "Distance From" at "40 mi" offering 10 mi to 100 mi in 10 mi steps, the text "Phone and Online appointments outside your selected radius will appear in search results.", a "Format" group with "Online", "Phone" and "In person", none ticked, a "Filter" button, and no "Reset". **3.** The strip: the month, then Monday to Friday of this week; days before today are not links and are named "<date>, disabled"; today shows "Today" and is the selected day (not a link); "Previous Week" is disabled. **4.** "Available appointments for <today as Weekday, Month D, YYYY>". **5.** Either at least 1 location card, or "There are no appointments available on this day. Try adjusting your filters or selecting another day." and no card. |
| AQ-2 | Each location card and time shows correctly | the reference day | Open the reference day and read every card. | Each card has: **1.** A heading with the location's name. **2.** A street address ending in "MN" and a 5-digit ZIP. **3.** At least 1 time. Each time shows a time like "10:45 am", the selected day's date like "Friday, November 13, 2026", and 1 to 3 of "online", "phone", "in person" (in that order, none twice); it links to `/appointments/<id>/booking`. |
| AQ-3 | Order, and one button per time | each linked day of the strip, this week and next | Open each day that has times and read every card. | On every day: **1.** Each location has one card. **2.** In each card the times are earliest first, and no two have the same time (several seats at one time show as one). **3.** No booking address appears twice on the page. **4.** With no location chosen, the cards are in alphabetical order of their names. |
| AQ-4 | Several seats at one time show as one time | the environment's time with several seats | Open its day (skipped with a reason where none is known). | **1.** Its location's card has one time button for that time. **2.** The button lists every format offered by any of its seats (for example "online phone in person" when one seat is online and another phone and in person). |
| AQ-5 | A day the strip marks as empty | the day in the strip marked empty | Click it (skipped with a reason if no linked day is marked). | **1.** The address has `start=<that day>` and the heading names it. **2.** "There are no appointments available on this day. Try adjusting your filters or selecting another day." shows, with no card. **3.** The filters and the strip are still there and can be used. |
| AW-1 | Picking a day in the week strip | `/connect-careerforce/schedule-an-appointment` | 1. Click the first linked day in the strip. 2. Click today ("Today"), if today is still a link. | **1.** The address has `start=<that day>`; the heading is "Available appointments for <that day>"; that day is now the selected day (not a link, `aria-current="date"`), and today is a link; every time shows that day's date. **2.** Today is selected again and the heading names today. |
| AW-2 | Next Week and Previous Week | `/connect-careerforce/schedule-an-appointment` | Runs while Next Week is a link on first load (always on a weekday). 1. Click "Next Week". 2. Click "Previous Week". | **1.** The address has `start=<next Monday>`; the strip shows next Monday to Friday with Monday selected, and the month heading names the month (or both months when the week spans two); "Previous Week" is a link; every time shows Monday's date. **2.** The strip shows this week again, with a day that isn't before today selected (on QA, the Friday); "Previous Week" is disabled. |
| AW-3 | The strip stops at the booking window | `/connect-careerforce/schedule-an-appointment` | 1. Read "Next Week" on first load. 2. Click "Next Week" while it is a link, and read it on each week reached. | **1.** "Next Week" is a link when next Monday is no more than 8 days after D, and "Next Week, disabled" (not a link) otherwise. **2.** Every week reached starts on a Monday no more than 8 days after D, and the last one has "Next Week, disabled". |
| AW-4 | The booking window to the minute | `?start=<D>`, then `?start=<D+8>` | 1. Open today by the address. 2. Open D+8 by the address (skipped when D+8 is a Saturday or Sunday). | **1.** Every time is later than now: none that has started already today. **2.** Every time is no later than now's time of day (8 days from now), and the first weekday after D+8 has no time (see AP-2). |
| AW-5 | Beyond the window by the address | `?start=<first Monday more than 8 days after D>` | 1. Open it by the address. 2. Open each day of the environment's known times beyond the window (on QA, session #328's 2026-11-23, 11-25, 11-27); skipped where none are known. | **1.** The page loads with that week's strip, "Previous Week" a link and "Next Week" disabled; every day of the strip is marked "No results on this date" or selected; the empty message shows and no time. **2.** Each day shows the empty message, and no time links to a known slot. |
| AW-6 | A past week by the address | `?start=<Monday of last week>` | Open it by the address. | **1.** The strip shows that week, and every day is "<date>, disabled", not a link. **2.** No time shows; the empty message shows. **3.** "Next Week" is a link, and following it shows a week that includes today or a later day. |
| AW-7 | On a weekend the search opens on the next Monday | `/connect-careerforce/schedule-an-appointment` | Open the search with nothing after it, on a Saturday or Sunday in America/Chicago (skipped with that reason on a weekday). | **1.** The strip shows next Monday to Friday, with Monday selected. **2.** The heading is "Available appointments for <next Monday>", not the Saturday or Sunday. **3.** Every time shows Monday's date. |
| AW-8 | A weekend date by the address opens the next Monday | `?start=<next Saturday>`, then `?start=<next Sunday>` | Skipped if the next Monday is more than 8 days after D. 1. Open the Saturday by the address. 2. Open the Sunday by the address. | Each time the page shows the following Monday, as on a weekend with no date (AW-7): that Monday's week in the strip with Monday selected, the heading "Available appointments for <that Monday>", and that Monday's times or the empty message. **1.** For the Saturday. **2.** For the Sunday. |
| AW-9 | "No results on this date" tells the truth | each linked day of the strip, this week and next | 1. Read each linked day's name, then open it. 2. Add `format[online]=online` (or the format the day in "Day with no time in one format" lacks) and do the same. | **1.** A day named "<date>. No results on this date." shows the empty message, and a day named without it shows at least 1 time. **2.** The same holds with the filter. |
| AF-1 | Each format filter through the form | a day with a time that lacks the format | One test per format (Online, Phone, In person), on a day that has a time without that format (else the reference day): note the day's times, tick the format and click "Filter". | **1.** The address keeps `start=<the day>` and adds `format[<format>]=<format>`; the box stays ticked and the day stays selected. **2.** Every time lists that format; every time of the unfiltered day that lists it is still there; the ones that don't are gone. **3.** The times are the same as opening that address. |
| AF-2 | Format filters combined | the day with 2 or more locations | 1. Tick Online and Phone and click "Filter". 2. Tick all three and click "Filter". | **1.** Both stay ticked; every time lists online or phone, and the times are exactly those of the Online-only and Phone-only results together. **2.** The times are the same as the unfiltered day. |
| AF-3 | A format with no time that day | the day with no time in one format | Tick that format and click "Filter" (skipped with a reason if there is no such day). | **1.** The empty message shows, with no card. **2.** The format stays ticked and the day stays selected. **3.** The strip's days are named "No results on this date" by the filtered results (as in AW-9). |
| AF-4 | Location and distance through the form | the day with 2 or more locations | 1. Type the city of the last card (for example "Aitkin, MN") in Location without picking a suggestion, choose "10 mi" and click "Filter". 2. Choose "100 mi" and click "Filter". | **1.** The address keeps the day and has `location[loc][text]=<city>` and `location[radius]=16.09`; the form shows both; that location's card is now first; every time of the unfiltered day that lists phone or online is still there. **2.** The address has `location[radius]=160.93` and the form shows "100 mi"; the same or more times than step 1, and that card is still first. |
| AF-5 | Location suggestions | the reference day | 1. Type "Dulu" in Location, one letter at a time. 2. Pick "Duluth, MN". 3. Click "Filter". | **1.** Within a few seconds a list opens under Location; every suggestion contains "Dulu", "Duluth, MN" is among them, and the box says it is expanded (`aria-expanded="true"`). **2.** The box shows "Duluth, MN" and the list closes. **3.** The address has `location[loc][text]=Duluth, MN`; the Duluth card is first if Duluth has a time that day; the page shows times or the empty message. |
| AF-6 | The radius and an in-person-only time | the day of an in-person-only time | Skipped with a reason if none (none on QA on 2026-11-12). The basic hide-and-show is AM-5. 1. Search that day with a far city and "10 mi". 2. The same city with "100 mi". 3. The time's own city with "10 mi". | **1.** The in-person-only time is gone; every time that lists phone or online is still there. **2.** The time is back when its location is within 100 miles of the far city, and still gone otherwise. **3.** The time is listed and its card is first. |
| AF-7 | "In person" with a far location | the day of a time that lists in person and phone or online | Tick In person, type a far city ("55437" for Duluth), choose "10 mi" and click "Filter" (skipped with a reason if there is no such day; on QA, 2026-11-19 Duluth 1:00 pm). | See Open questions. **1.** No time from a location more than about 10 miles from the city is listed, even when it also offers phone or online: a visitor who asks for in-person times near them isn't offered one far away. **2.** Either the empty message or nearby times show, and In person stays ticked. |
| AF-8 | The filters, the day and the week stay together | the reference day | 1. Tick In person, type "55437", choose "100 mi" and click "Filter". 2. Click another linked day in the strip. 3. Click "Next Week" (skipped if disabled). 4. Click "Previous Week". | After every step the address and the form hold everything chosen so far, every time lists in person, and the times are the same as opening an address with only those values. **1.** The day, `format[in_person]`, the location and 100 mi. **2.** The new day, with the filters kept. **3.** Next Monday, with the filters kept. **4.** A day of this week, with the filters kept. |
| AF-9 | Reset clears the filters | `?start=<reference day>&format[in_person]=in_person&location[loc][text]=55437&location[radius]=160.93` | Click "Reset" (on a phone, the "Reset" button below "Filters"). | **1.** The address is `/connect-careerforce/schedule-an-appointment` with nothing after it. **2.** Location is empty, Distance From shows "40 mi", nothing is ticked, and "Reset" is gone. **3.** The page is the same as on first load (AQ-1): today selected and today's times. |
| AH-1 | A booked time isn't offered | the day of the environment's booked slot in the window | Skipped with a reason where none is known. 1. Open its day. 2. Open its day with each of its formats as a filter. | **1.** No time links to the booked slot; if it was the only seat at that time and place, that time isn't shown. **2.** The same with each filter. |
| AH-2 | A Draft time isn't offered | the day of the environment's Draft slot in the window | Open its day (skipped with a reason where none is known). | No time links to the Draft slot; if it was the only seat at that time and place, that time isn't shown. |
| AH-3 | A Cancelled time isn't offered | the day of the environment's Cancelled slot in the window | Open its day (skipped with a reason where none is known). | No time links to the Cancelled slot; if it was the only seat at that time and place, that time isn't shown. |
| AH-4 | A time with one seat booked stays, with the open seats' formats | the environment's time with several seats, one of them booked | Open its day (skipped with a reason where none is known). | **1.** The time is still listed once. **2.** It lists only the formats of its open seats, and links to an open seat, not the booked one. |
| AU-1 | A search opened from a link | `?start=<reference day>&format[phone]=phone&location[loc][text]=55437&location[radius]=160.93` | Open the address in a fresh browser that has never visited the site. | **1.** The form shows every value: "55437", "100 mi" and Phone ticked; the reference day is selected and named in the heading. **2.** Either the empty message shows, or every time lists phone and shows the reference day's date. |
| AU-2 | Back and Forward keep the search | `/connect-careerforce/schedule-an-appointment` | 1. Pick the reference day. 2. Tick Online and click "Filter". 3. Click "Next Week" (or another day when it is disabled). 4. Click Back twice, then Forward twice. | **1.** The reference day is selected. **2.** Online is ticked and the day is kept. **3.** The new week or day is selected and Online is kept. **4.** Each Back and Forward shows that step's address, its selected day, its form values and the same times as when it was first shown; no form shows the values of a different step. |
| AU-3 | Bad values in the address | See [the table below](#au-3-values) | One test per row: open the search with the row's value by the address. | **1.** The page loads with no raw error. **2.** What the row says. |
| AU-4 | Markup and special characters in Location | `/connect-careerforce/schedule-an-appointment` | 1. Type `C++ & "R&D"` in Location and click "Filter". 2. Open `?location[loc][text]=<b>x</b>` by the address. 3. Type `<script>alert(1)</script>` in Location and click "Filter". | No alert or other dialog opens at any step, and the page gains no `<script>`, `<b>` or `<img onerror>` from the value. The firewall's "403 Forbidden" page is a pass. **1.** The box shows `C++ & "R&D"` exactly, with no `&amp;` or `&quot;`, and times or the empty message show. **2.** The box shows `<b>x</b>` as text and nothing on the page is bold from it. **3.** When the search page loads, the box shows the characters as plain text. |
| AE-1 | A time button sends a visitor to log in | the reference day | Click the first time, without logging in and without going further than the site's login page. | **1.** The browser lands on `/user/login?destination=/appointments/<id>/booking`, where `<id>` is the time's slot. **2.** "Log In or Register" and "Log In or Register with LoginMN" show. **3.** No booking form, "Complete Booking" or booking message shows. |
| AE-2 | A booking address that doesn't exist | `/appointments/99999999/booking`, then `/appointments/abc/booking` | Open each. | **1.** Each answers 404 with "Page Not Found". **2.** No empty booking page and no login page shows. |
| AE-3 | The booking success page for a visitor | `/appointments/<first time's id on the reference day>/booking-success` | Open it by the address. | **1.** The visitor is sent to the search (or the login page), not shown "Your Appointment is Booked!". **2.** No one's booking details show. |
| AE-4 | Public links to the search | `/connect-careerforce`, then `/education-and-training/events` | 1. On `/connect-careerforce`, click "Sign up for a 1:1 appointment". 2. On `/connect-careerforce`, click "Schedule an Appointment" in the section menu. 3. On the Events search, click "Book an appointment". 4. On the Events search, click "Book now" in "Book a 1:1 appointment with a Career Specialist". | Each time the search opens as on first load (AQ-1), with nothing after its address. **1.** From the content link. **2.** From the section menu. **3.** From the quick link. **4.** From the promo. |
| APW-1 | The search at phone width | the reference day | 1. Look at the page. 2. Tap another linked day. 3. Tap "Next Week" (skipped if disabled). | No sideways scrolling and nothing cut off. **1.** The strip's five days and both arrows, "Filters", "Reset", the cards, their times and addresses fit the width; the sidebar filters are hidden. **2.** That day is selected and its times fit. **3.** Next week's strip and times fit. |
| APW-2 | The filters drawer at phone width | the reference day | 1. Tap "Filters". 2. Tick In person and tap "Filter". 3. Tap "Filters", then press Esc. 4. Tap "Filters", then tap "Close filters". | **1.** The drawer opens with "Close filters", Location, Distance From, the formats, "Filter" and "Reset", all visible without sideways scrolling; focus moves into it, and "Filters" tells screen readers it is expanded (`aria-expanded="true"`). **2.** The address keeps the day and has `format[in_person]=in_person`; every time lists in person. **3.** The drawer opens with In person still ticked; Esc closes it and focus goes back to "Filters", which now says collapsed. **4.** "Close filters" closes it, and focus goes back to "Filters". |
| APW-3 | Location suggestions at phone width | the reference day | 1. Tap "Filters" and type "Dulu" in Location. 2. Tap "Duluth, MN", then "Filter". | **1.** The suggestions open within the drawer's width and can be tapped. **2.** The address has `location[loc][text]=Duluth, MN` and the drawer is closed. |
| AK-1 | Filter with the keyboard only | the reference day | 1. Tab from the top of the page to Location and type "55437". 2. Tab to Distance From and choose "100 mi" with the arrow keys. 3. Tab to "In person" and press Space. 4. Tab to "Filter" and press Enter. | Focus is visible at every stop, and the stops follow the order on screen. **1.** Location is reached and takes the text. **2.** The dropdown shows "100 mi" and the page doesn't reload. **3.** In person is ticked. **4.** The address keeps the day and has the location, `location[radius]=160.93` and `format[in_person]=in_person`. |
| AK-2 | The strip with the keyboard only | `/connect-careerforce/schedule-an-appointment` | 1. Tab to the first linked day and press Enter. 2. Tab to "Next Week" and press Enter (skipped if disabled). | Focus is visible at every stop; past days and disabled arrows are not Tab stops. **1.** That day is selected. **2.** Next week loads, and focus is on "Next Week", or, when it is now disabled, on a link in the strip, not at the top of the page. |
| AK-3 | Location suggestions with the keyboard | `/connect-careerforce/schedule-an-appointment` | 1. Tab to Location and type "Dulu". 2. Press the Down arrow, then Enter. 3. Type "Bloom", then press Esc. | **1.** The suggestions open. **2.** The highlighted suggestion is put in the box ("Duluth, MN" when it is first) and the list closes, without submitting the form. **3.** The list closes and focus stays in Location. |
| AK-4 | Every control has a name | the reference day, at desktop and phone width | Read the accessibility tree. | **1.** Location and Distance From have labels; the formats are a group named "Format" with checkboxes named "Online", "Phone" and "In person"; "Filter", "Reset", "Filters" and "Close filters" are named buttons. **2.** The strip is a list named "Appointment booking dates"; each linked day is named by its full date ("Friday, November 13, 2026"), with ". No results on this date." when it has no times; past days read "<date>, disabled"; the selected day has `aria-current="date"`; a disabled arrow reads "Previous Week, disabled" or "Next Week, disabled". **3.** Each time link's name has its time, its date and its formats. |
| AK-5 | Appointment search headings are in order | the reference day | Read the page's headings. | **1.** Exactly one level-1 heading: "Schedule an Appointment". **2.** "Appointment Search Filters", the month, and "Available appointments for <the selected day>" are level-2 headings (the last may be visually hidden). **3.** Each location's name is a level-3 heading under "Available appointments for". **4.** No level is skipped on the way down. |

## Test data

### AU-3 values

| Value added to the address | Expected result |
|---|---|
| `start=notadate`, then `start=2026-13-45` | The same page as first load (today, or the next Monday on a weekend): the strip, the heading and the times. |
| `start[]=<reference day>` | The reference day, or today, with the strip and the heading naming the same day. |
| `start=<reference day>&location[loc][text]=Duluth&location[radius]=abc` | The week strip, the filters and the reference day still show. Either the value is ignored (Distance From shows "40 mi" and the times are those of Duluth at 40 mi), or a message naming Distance From shows once (not twice). |
| `start=<reference day>&format[bogus]=bogus` | The week strip, the filters and the reference day still show. Either the value is ignored (nothing ticked, the day's unfiltered times), or a message naming Format shows once. |
| `start=<reference day>&format[online]=phone` | What is ticked matches the times listed: either Online isn't ticked and the day's unfiltered times show, or Online is ticked and every time lists online. |
| `start=<reference day>&location[loc][text]=<300 × "a">&location[radius]=16.09` | The week strip, the filters and the reference day still show; a message saying Location is too long shows once, or the location is ignored. |
| `start=<reference day>&location[loc][text]=zzqxqzz&location[radius]=16.09` | "The location "zzqxqzz" could not be resolved and was ignored." shows, and the times are the same, in the same order, as the reference day with no location. |
| `start=<reference day>&page=5` | The reference day's times (the same as with no `page`), not the empty message. |

## Good to know

- **The form and the strip are on the page twice** (the sidebar and the
  phone drawer); use the visible copy. `tests/pages/appointments-search.page.ts`
  already handles this.
- **Distance is sent in kilometres:** 10 mi is `16.09`, 40 mi `64.4`,
  100 mi `160.93`.
- **The window** is to the minute in America/Chicago: a time on D+8 later
  than the current time of day isn't offered, and a time earlier today is
  gone.
- **Previous Week** goes to the Friday before the strip's Monday, so going
  back from next week selects this week's Friday.
- **Times' formats** are lower case on the time buttons ("in person") and
  capitalised on the form ("In person").

## Mobile

On the phone (`functional-mobile`, Pixel 7) these run too: AQ-1, AQ-2,
AW-1, AW-2, AF-1, AF-4, AF-9 (through the "Filters" drawer and its "Reset"
button) and AE-1, AE-4. Every other case is `@desktop-only`: what it checks
happens on the server, so once is enough. APW-1 to APW-3 set their own 390 ×
844 size and the AK cases are keyboard cases, so both run on desktop only
(AK-4 sets the phone width itself). On the phone each case also checks that
the page doesn't scroll sideways.

## Not covered

- **Booking** (the booking form, Tier 2, holds, full and reserved messages,
  the success page, cancelling): functional-appointments-booking. AE-1
  stops at the login page.
- **Creating, changing or cancelling slots** to give this plan the data it
  needs (an in-person-only time, a Draft or Cancelled slot, several seats at
  one time): functional-appointments-scheduling. AQ-4, AF-6, AF-7 and AH-1
  to AH-4 use slots that already exist.
- **How fast a change reaches the search** (a new, booked or cancelled slot
  being reindexed): smoke-appointments AA-2, AB-2, AS-3 and the later parts.
- **Where LoginMN sends the visitor after logging in** (back to the booking
  page?): functional-appointments-booking.
- **The exact distance of each location.** The cards don't show one, so
  AF-4, AF-6 and AF-7 use locations that are clearly near or far.
- **Paging.** The view shows 15 times a page, but no day on QA had more than
  2, and the page has no visible pager; see Open questions.
- **A full accessibility audit** (colour contrast, zoom to 400%, screen
  reader testing).

## Open questions

1. **Weekend dates (AW-7, AW-8).** The KB says the search opens on the next
   Monday at the weekend. With no date that is what the source does, but
   the "Available appointments for" heading would still name the Saturday
   or Sunday. With a weekend date in the address, QA showed the heading for
   the weekend day, no selected day, and this week's strip for a Saturday
   but next week's for a Sunday. AW-7 and AW-8 expect the next Monday in
   all of these; confirm.
2. **Bad values (AU-3).** On QA a bad Distance From, a bad format or a
   location over 255 characters showed an error message twice and removed
   the week strip, so the visitor can't pick another day; `page=5` showed
   the empty message on a day with times; `format[online]=phone` ticked
   Online but didn't filter. AU-3 expects the friendlier behaviour in its
   table; confirm.
3. **A location that can't be found (AU-3).** The source should show "The
   location "zzqxqzz" could not be resolved and was ignored.", but QA showed
   no message and changed the order of the cards (so it appears the
   geocoder resolved "zzqxqzz" to somewhere). What should a visitor see?
4. **"In person" with a far location (AF-7).** On QA, In person + 55437 +
   10 mi listed Duluth's 1:00 pm time, because it also offers phone and
   online. Should a visitor who asks only for in-person times see it? AF-7
   expects not.
5. **Known slots per environment (AQ-4, AW-5, AH-1 to AH-4).** A visitor
   can't tell booked, Draft or Cancelled slots from open ones. Can the team
   name, on QA, Stage and Production, a booked, a Draft and a Cancelled slot
   within the window, a time with several seats (one of them booked), and
   times beyond the window? Or keep `Playwright test` ones on QA and Stage
   (functional-appointments-scheduling could create them, but this plan
   doesn't depend on another plan's data).
6. **No in-person-only time on QA (AF-6).** None was in the window on
   2026-11-12, so AF-6 (and AM-5's radius case) are skipped. Can QA keep
   one?
7. **Reset and the day (AF-9).** Reset goes back to today and drops the
   chosen day. Should it keep the day and clear only the filters? AF-9
   expects today, as QA does.
8. **Time links' names (AK-4).** A time link reads "10:00 am Tuesday,
   November 17, 2026 phone in person", without the location. It sits under
   the location's heading, so AK-4 doesn't require the location in the
   name. Should it have it, for screen reader users tabbing through times?
9. **Links from other pages.** The homepage and the location pages don't
   link to the search, and a location page doesn't say whether it offers
   appointments. Is that intended? AE-4 covers the links that exist.
10. **Paging.** The view is set to 15 times a page with a full pager. Is
    there ever a pager on this page, and should a busy day show every time?
11. **Phone width (APW-1).** At 390 × 844 the page was 383 px wide in a
    375 px client area, as on the Events search. APW-1 expects no sideways
    scrolling.
12. **The "Filters" button (APW-2)** has no `aria-expanded`, as on the
    Events search. APW-2 expects it.

## Suggested files

```
tests/
  functional/appointments/
    search.spec.ts                 # AQ-1 .. AQ-5
    week-strip.spec.ts             # AW-1 .. AW-9
    filters.spec.ts                # AF-1 .. AF-9
    hidden-slots.spec.ts           # AH-1 .. AH-4
    search-address.spec.ts         # AU-1 .. AU-4
    entry-points.spec.ts           # AE-1 .. AE-4
    search-responsive.spec.ts      # APW-1 .. APW-3
    search-accessibility.spec.ts   # AK-1 .. AK-5
    helpers/
      appointments-test-data.ts    # per-environment slot IDs (booked, Draft, Cancelled, several seats, beyond the window), D/now in America/Chicago, the reference-day and day-finding helpers
  pages/
    appointments-search.page.ts    # reuse and extend: the drawer, Reset, suggestions, strip day names and states, week arrows, times per card in order
```

The spec files don't depend on each other or on running in order.
