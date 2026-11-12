# [Functional] - Events - Scheduling - Test Plan

Status: ready to generate
Implemented test: —
Prod: No: creates, changes, cancels and deletes event catalog items, sessions, occurrences and locations that visitors see, and OG-5 and DL-2 register the `jobseeker` account for an event.

Devices: desktop only. Every case changes data, so every test is tagged `@desktop-only` and `@no-prod`, and the admin screens aren't tested on a phone.

## Overview

Part 2 of 5 of the functional plans for Events. It tests how staff build
events: event catalog items (add, edit, required fields, the list and its
filters, delete rules); sessions (every field, Service Location and Meeting
Location, Format, seats, private, and the "Date and time" widget with a
single date, weekly and monthly repeats, Until, the weekday-only rule, the
50-day limit and "Preview Occurrence Dates"); how occurrences are generated
and regenerated, and what changing the Until date does to them, including
the warning when registrations would be cancelled; occurrence overrides;
the Draft, Active and Cancelled states of sessions and occurrences;
scheduling from a location's own menu; alternate locations; private events;
deleting versus cancelling; and which roles may do what.

The other parts:

- [functional-events-search-detail](functional-events-search-detail.md)
  (part 1: what a visitor sees on the Events search, the event pages, the
  homepage and location pages). This plan links to its cases for the
  visitor side instead of repeating them.
- functional-events-registration (part 3, not written yet: job seeker
  registration, Tier 2 gating, waitlist, cancel, My Events & Appointments,
  printing),
- functional-events-attendees (part 4, not written yet: the staff
  Attendees tab, attended, service records, undo, resend, bulk),
- functional-events-external-submissions (part 5, not written yet:
  "Submit an Event" and review).

This plan is the in-depth version of the quick admin checks in the Smoke
suite: EA-1 to EA-3 (catalog item, a short recurring session, cleanup) in
[smoke-events.md](../smoke/smoke-events.md). Some
overlap is expected; the case IDs here are its own.

Every case creates its own data, named `Playwright test <timestamp>`, and
removes it in `finally` (see [Cleanup](#cleanup)), so no case depends on
another and the cases can run in any order. The plan is still not
`Parallel: yes`: it changes data that visitors and other plans see, and two
cases register the shared `jobseeker` account.

Where the cases come from: the request for this part (the scope above), the
knowledge base (`docs/kb/events/event-content-model.md`,
`docs/kb/events/occurrence-generation-and-recurrence.md`, `docs/kb/locations/`)
and the app source, and what QA showed on 2026-11-12.

## Running it

First time? Do the [one-time setup](../README.md#one-time-setup).

```bash
npm run login:manual -- admin
npm run login:manual -- jobseeker
BASE_URL=https://qa.careerforce.link npx playwright test tests/functional/events/catalog-items.spec.ts tests/functional/events/session-form.spec.ts tests/functional/events/recurrence.spec.ts tests/functional/events/occurrence-generation.spec.ts tests/functional/events/overrides.spec.ts tests/functional/events/moderation-states.spec.ts tests/functional/events/location-scheduler.spec.ts tests/functional/events/alternate-locations.spec.ts tests/functional/events/private-events.spec.ts tests/functional/events/delete-cancel.spec.ts tests/functional/events/scheduling-permissions.spec.ts --project=functional-desktop
```

QA and Stage only; never Production. Log in as both roles just before the
run: on QA a session ends after about 15 minutes without a request. The PM
cases for roles that have no saved login yet are skipped with that reason
(see [Open questions](#open-questions)).

Add `--ui` to [watch it run](../README.md#watching-a-run), or put
`SCREENSHOT=on` in front to
[save a screenshot of every test](../README.md#screenshots-of-every-test).

## Scope

- **In:** the admin side of events: catalog items, sessions, the date
  widget and its preview, occurrence generation, overrides, moderation
  states, the location event scheduler and Location Events, alternate
  locations, private events, deleting and cancelling, and access by role.
  Where a case changes what visitors see, it checks the change in a
  logged-out browser and links to the part 1 case that checks the page in
  depth.
- **Out:** registering, the waitlist and what the job seeker sees (part 3;
  OG-5 and DL-2 only register to create a registration); the Attendees tab
  and service records (part 4); external events (part 5); appointments,
  which share the occurrence machinery but have their own plans.

## Checked in every case

These hold after every step of every case, and a case fails if one doesn't:

- **No JavaScript error** from the site's own scripts in the browser
  console. Failed loads of other sites' files (Google Tag Manager, the AWS
  firewall's `challenge.js`) are ignored.
- **No failed request** to the site itself (no 4xx or 5xx answer from the
  CareerForce host), except where a case expects one (an access denied
  page, a 404).
- **No raw error on the page:** no "The website encountered an unexpected
  error", no PHP or Drupal error message, no stack trace. Drupal's red
  form error messages are expected where a case says so.

## Login and test data

| | |
|---|---|
| **`admin`** | `playwright/.auth/<env>/admin.json`. On QA this is a "System Administrator" account, which passes every permission check, so it doesn't need to be a member of any group. |
| **`jobseeker`** | `playwright/.auth/<env>/jobseeker.json`, a job seeker with a complete Tier 2 profile. Only OG-5 and DL-2 use it, to register for one occurrence. |
| **Other roles** | PM-3 to PM-7 need logins that don't exist yet: `event-manager`, `job-service-manager`, `job-service-admin`, `location-admin` and `content-manager` (see [Open questions](#open-questions)). Until they exist, those cases are skipped with that reason. |
| **Visitor** | A second, logged-out browser context, for the "as a visitor" steps. |
| **Locations** | "CareerForce in Aitkin" (location 883 in group 813 on QA; `/careerforce-location/careerforce-aitkin`) and "CareerForce in Bloomington" (location 7). The test looks them up by name on each environment. |

Words used in the cases:

- **D** is today and **now** the time now, in America/Chicago (the site's
  timezone). **W** is the first Monday at least 7 days after D, so every
  case starts its session in the future on a weekday. W+4 is that Friday.
- **N** is the case's own name, `Playwright test <timestamp>`.
- **The case's catalog item** is created as in CI-1 step 2: Event Name N,
  Services "Resume Writing Assistance", Sponsor "Local Only", Topic
  "Resumes", Event Type "Workshop", Description `Playwright test
  description <timestamp>`, Status Active.
- **Schedule a session** means: open `/happenings/catalog-item/<id>/schedule`
  for the case's catalog item and fill in Service Location "CareerForce in
  Aitkin" (picked from the suggestions), Format "In Person", Accommodation
  Phone Number `555-555-5555`, the first name in Facilitator, Available
  Seats 10, Start Time 10:00 AM and End Time 11:00 AM, Status Active, plus
  whatever the case says (date, recurrence, other values), then click
  "Save" and wait for the batch page to finish.
- **The session's row** is its row in `/admin/content/events/event-session?label=<N>`.
  **The session page** is that row's "View" link
  (`<location address>/location-events/<label>/<session id>`), which lists
  the session's occurrences (Occurrence, Facilitator, Status, Registrants,
  Seats, Operations).
- **The search** is `/education-and-training/events?fq=<N>` opened by the
  address, all pages (part 1's EV-4 and its Open question 1 explain why the
  address and not the search form).

## Cleanup

Every case ends with this in `finally`, whatever happened, and only touches
items named with its own N:

1. For each session named N (from `/admin/content/events/event-session?label=<N>`,
   any status): if its row has a "Delete" operation, delete it (deleting a
   session deletes its occurrences). If it has none, because an occurrence
   has a registration, cancel the `jobseeker`'s registration and set the
   session to Cancelled (a session with any registration can't be deleted;
   see [Open questions](#open-questions)).
2. Delete the catalog item named N.
3. For an alternate location named N: untick it under "Alternative
   Locations" on every location it was ticked on, then delete it from
   `/group/<group>/location`.
4. Set back anything else the case changed on existing content (for
   example a catalog item's status).

A cleanup step that fails is reported with the case, so leftover data is
seen.

## What the site has

Checked on QA with the saved `admin` session (a System Administrator) on
2026-11-12, between 2:39 PM and 2:52 PM Central, without saving anything:
forms were opened and filled to read them, "Preview Occurrence Dates" was
used (it only reads), and no form was saved. The saved `jobseeker` session
had expired: every scheduling address sent it to the login page, the same
as a visitor.

**Manage Events** (`/admin/content/events`): links "Add Event Catalog
Items", "View Event Catalog Items", "View Event Sessions", "Add Event
Occurrences" (`/events/event-occurrence/add`), "View Event Occurrences",
"Add External Sessions", "View External Sessions", "View Webform
Submissions". The event lists share the tabs Catalog Items, Sessions,
Occurrences, External Events, Webform Submissions.

**Catalog items:**

- List `/admin/content/events/event-catalog-item` ("Event Catalog"): a
  button "Add event to catalog"; filters Name (`n`), Status (`s`: Active,
  Inactive, "- Any -", default "- Any -"), Sponsor (`p`: "- Any -", Job
  Service, Local Only), "Filter" and "Reset"; columns Catalog Item
  (sortable), Status, Sponsor, Date Added ("06-08-2026"), Operations
  ("Schedule" to `/happenings/catalog-item/<id>/schedule`, then View, Edit,
  Translate, Delete in "List additional actions"); 25 a page; a bulk action
  "Set catalog item as Active" / "Set catalog item as Inactive". Every item
  on QA was Active.
- Add form `/admin/content/add/event-catalog-item` ("Add Catalog Item"):
  Event Name (required; the browser blocks Save with "Please fill out this
  field." when it is empty), Services (required; 29 checkboxes, such as
  "Resume Writing Assistance"), Sponsor (required; "- Select a value -",
  Job Service, Local Only), Topics (required; Career Exploration, Digital
  Skills, Interviewing, Job Search, Networking, Resumes), Event Type
  (required; Job Club, Job Fair or Networking Event, Workshop), Description
  (required; a rich text editor), URL alias (automatic), Authoring
  information, Status (Inactive, Active; Active chosen), "Save".
- Item page `/events/event-catalog-item/<id>`: tabs View, Edit, Delete,
  Revisions, Translate, Schedule; shows Event Name, Sponsor, Topics, Event
  Type, Description. Delete page: "Are you sure you want to delete the
  Catalog Item <name>?", "This action cannot be undone.", a delete button
  and "Cancel" (seen for an item that has sessions; not confirmed).

**Session form** (`/happenings/catalog-item/<id>/schedule`, "Schedule <item>
session"):

- "Event Information" shows the item's description and "Facilitated by
  <Sponsor>".
- Date (a date box, today filled in), Start Time and End Time ("- Select -",
  then 7:00 AM to 8:00 PM in 15-minute steps), "This is a recurring event".
  Ticking it shows "Repeats every" (a number, 1), Weeks or Months, "Until"
  (help: "The final occurrence of the session. When editing a session,
  setting to an earlier date will cancel occurrences after the new date
  and registrants will receive a cancellation email. Setting to a later
  date will extend the session so that new occurrences will be
  generated."), an "Advanced" part with Monday to Friday (none ticked; no
  Saturday or Sunday), and "Preview Occurrence Dates". Months adds First,
  Second, Third, Fourth, Fifth and Last.
- Service Location (required, an autocomplete; "Aitkin" offered "CareerForce
  in Aitkin", which then showed as "CareerForce in Aitkin (883)").
- Format (required): In Person, Online. In Person shows "Meeting Location";
  Online shows "Video Link" (then required; help "This must be an external
  URL such as https://example.com.") and "Additional Information"; both
  show all three.
- Meeting Location: "Same as Service Location" plus the Service Location's
  alternates: "CareerForce Downtown" for Aitkin, "Eden Prairie Library" for
  Bloomington. These are the ones ticked under "Alternative Locations" on
  the location's edit form.
- Accommodation Phone Number (required; "Enter 10 digit phone number,
  example: 555-555-5555"), Facilitator (required) and Moderator (both
  filled with staff names once a Service Location is chosen), Available
  Seats (required, a number), "This is a private event" ("Private events
  can only be used for specific situations approved by a CareerForce
  manager. Please confirm with your manager prior to scheduling a private
  event."), Status (Draft, Active; Draft chosen), URL alias, "Save".

**Preview Occurrence Dates** opens a dialog "Preview Occurrence Dates" with
"Close" and "This is a preview of occurrences that will be generated for the
session based on the entered recurrence settings. Only the next upcoming
occurrences will be generated immediately after saving the session. The rest
will be generated automatically as time passes.", then one line per date
("Monday, November 16, 2026 10:00 AM"). What it showed:

| Rule (10:00 AM) | Preview |
|---|---|
| Weekly, Monday to Friday, 2026-11-16 until 2026-12-31 | Every weekday from November 16 to December 31 (34 dates, including Thanksgiving and Christmas Day) |
| Every 2 weeks on Tuesday, until 2026-12-31 | November 17, December 1, 15 and 29 |
| Monthly, Third Wednesday, until 2027-06-30 | The third Wednesday of each month, November 18 to June 16 (8 dates, beyond 50 days) |
| Weekly, no day ticked, start Monday 2026-11-16, until 2026-12-12 | The Mondays November 16 to December 7 |
| Weekly, no day ticked, start Saturday 2026-11-14 | "No occurrences found." |
| Weekly on Monday, no Until | "No occurrences found." |
| Until (2026-11-10) before the start | "No occurrences found." |
| Start 2026-11-10 (past), weekly on Monday, until 2026-11-30 | Only the future Mondays: November 16, 23 and 30 |

**Session list** (`/admin/content/events/event-session`, "Event Sessions"):
filters Event Name (`label`), Status (`moderation_state_session`: "- Any -",
Draft, Active, Cancelled), Service Location (every CareerForce location),
Date From, Date To, "Filter"; "Displaying 1 - 25 of 171"; columns Date and
Time ("December 10, 2026 at 9:00 AM to 11:00 AM"), Event Session, Service
Location, Facilitator, Format ("In Person", "In Person, Online"), Status,
Repeats on ("Does not repeat", "Weekly on Monday", "Every 3 weeks on
Wednesday", "Weekly on Monday, Tuesday, Wednesday, Thursday or Friday",
"Monthly on the Third Wednesday"), Registrants, Seats, Operations (View,
then Edit and, only for some sessions, Delete); bulk actions "Activate
Session" and "Cancel Session". `?label=Applications+101&field_locations_primary_target_id=883`
narrowed it to the two Aitkin "Applications 101" sessions.

**Session page** (for example `/minneapolissouth/location-events/advanced-resume-writing/119`):
tabs View, Edit, Delete (when allowed), "Admin View Registrations",
Revisions; the tags and description; an occurrence table with bulk actions
"Cancel occurrences" and "Reassign Staff Member" and columns Occurrence,
Facilitator, Status, Registrants, Seats, Operations (View, and Edit except
for cancelled occurrences); then Repeats On, Ends On Date, Time, Location,
Offered By, Accommodation Phone Number. "Admin View Registrations" says
"Beta Functionality: …" and lists every registration from the Registration
API (Occurrence, User ID, Name, Email, Registration Status, Format, Date
Registered).

**Editing a session:**

- Every part of the date widget is disabled except Until; there is no
  "Preview Occurrence Dates"; Service Location is disabled. Format, Meeting
  Location, phone, Facilitator, Moderator, Available Seats and private can
  be changed.
- Status offers Draft, Active and Cancelled on a Draft session, and Active
  and Cancelled on an Active one.
- A Cancelled session has no Edit: its edit address answers 403 "Access
  denied" (the workflow has no move out of Cancelled), but it can still be
  deleted (session 114 at Aitkin).
- Delete: "Are you sure you want to delete the Session <name>?", "This
  action cannot be undone.", "Cancel". A session whose occurrences have a
  registration has no Delete, and its delete address answers 403, even
  when the Registrants column shows 0 (session 154 at Bloomington, whose
  Admin View Registrations lists registrations on past occurrences).

**Occurrences:**

- List `/admin/content/events/event-occurrence`: no filters; columns Session
  ID, Occurrence ID, Title, Session, Start, End, Facilitator (sortable),
  Operations; 25 a page, 19 pages.
- Edit form (`/events/event-occurrence/<id>/edit`, "Edit <name> <Weekday,
  Month D, YYYY>"): "You are making edits to a single occurrence. The
  changes you make will only affect this occurrence."; Label, Description,
  Session, Format, Start and End date and time, Service Location,
  Accommodation Phone Number, Available Seats and "This is a private event"
  are disabled. Meeting Location, Video Link, Additional Information,
  Facilitator, Moderator and the moderation state ("Change to") are
  disabled until their own "Override <field>" box is ticked (six boxes).
  "Change to" offers Active and Cancelled on an Active occurrence.
- A Draft occurrence shows "This Occurrence belongs to a draft Session.
  Activate the Session to alter the moderation state of the Occurrence.",
  with "Change to" (Draft, Cancelled) and its Override box disabled.
- A Cancelled occurrence has no Edit, and its edit address answers 403.
  Every occurrence's delete address answers 403.
- `/events/event-occurrence/add` opens an "Add occurrence" form.

**Location menu** (CareerForce in Aitkin): tabs View, Edit, Revisions,
Appointments, Event Scheduler, Location Events, Members, Announcements,
Content, Connections, Translate, and "Back to Group" (`/group/813`).

- Event Scheduler (`/careerforce-location/careerforce-aitkin/event-scheduler`,
  "Event Scheduler for CareerForce in Aitkin"): "Add event to catalog", a
  Name filter, columns Catalog Item, Date Added, Operations ("Schedule" to
  `/careerforce-location/careerforce-aitkin/event-scheduler/<item id>/schedule`),
  25 a page.
- Its schedule form: "Schedule <item> session for CareerForce in Aitkin",
  Service Location "CareerForce in Aitkin (883)" disabled, Status Draft or
  Active, Meeting Location "Same as Service Location" and "CareerForce
  Downtown".
- Location Events (`/careerforce-location/careerforce-aitkin/location-events`,
  "Location Events for CareerForce in Aitkin"): filters Event Name (`l`),
  Facilitator, Moderation state (`s`: Draft, Active, Cancelled), Date From,
  Date To; columns like the session list with "Location" for Service
  Location; `?s=cancelled` showed only the cancelled session.

**Group locations** (`/group/813/location`, "CareerForce Locations"): "Add
location"; columns Name, Address, Location type ("Alternative Location",
"CareerForce Location", "CareerForce Statewide or Virtual"), Publishing
status, Operations (View, Edit, Manage Availability, Delete). The group
holds locations all over the state.

- Add location (`/group/813/location/add`) offers Alternative Location,
  CareerForce Location and CareerForce Statewide or Virtual.
- "Add Alternative Location" (`/group/813/location/add/alt_location`):
  Publishing status (ticked), Name (required), Description, Address (Street
  Address Line 1 to 3, City, State with Minnesota chosen, ZIP Code), Phone
  (type Main, Fax, Other or TTY; number, "Please enter a 10 digit US phone
  number, numeric characters only."; Ext; "Add another item"), Authored by,
  URL alias, "Save".
- A location's edit form has "Alternative Locations": a checkbox for each
  of 47 alternate locations; on Aitkin only "CareerForce Downtown" (an
  address in Bemidji) was ticked.
- An alternate location's delete page: "Are you sure you want to delete the
  location CareerForce Downtown?", "This action cannot be undone.",
  "Cancel", with no word that Aitkin uses it.
- `/locations?search_api_fulltext=<name>&loc[loc][text]=` found
  "CareerForce in Aitkin" (1 result) but nothing for the alternates
  "CareerForce Downtown" or "Eden Prairie Library". Submitted through the
  page's own form, the Location box was filled with "Portland, ME, 04103"
  (the browser's location) and Aitkin was then not found, so the tests use
  the address with an empty Location.

**Private session:** the Aitkin "Applications 101" session 174 (weekly,
from November 13) has "This is a private event" ticked, which confirms part
1's guess about it; the other Aitkin "Applications 101" session (144) is
not private.

From the KB and the app source (`happenings`, `cf_happenings`, `rrule`,
`config/sync`), not checked on a running site:

- **Generation:** saving a new session queues one item per date and runs a
  batch "Generating occurrences", ending with "Occurrence generation
  complete."; saving an existing one re-saves every occurrence and
  generates new ones ("Updating and generating occurrences", "Occurrences
  updated and generated."). Dates are skipped when they are in the past,
  more than 50 days ahead, on a Saturday or Sunday, already exist, or when
  the session already has 51 upcoming occurrences, or is Cancelled. Daily
  cron (at most once every 24 hours) generates the later dates.
- **Validation on save:** "You may not schedule Sessions on Saturday or
  Sunday." (the date is a weekend day); "The start date/time must be in the
  future." (new sessions only); "End time must be after start time.";
  "Until date must be after start date."; Available Seats at least 1;
  Format, Service Location, Facilitator and Accommodation Phone Number
  required; Video Link required when Online is ticked.
- **Until changes:** moving Until later generates the new dates. Moving it
  earlier cancels every future occurrence after the new date (they become
  Cancelled, not deleted, and keep that state). When any of those has a
  registration in any status except Canceled, Save first shows "Changing
  this session's Until date to <Month D, YYYY> means cancelling upcoming
  occurrences for which users have already registered. Registrants will
  receive a cancellation email. Would you like to proceed?" with "Yes"
  (saves) and "No" (puts the old date back, saves nothing).
- **Overrides:** on every save an occurrence copies the session's
  description, moderation state and fields, except the ones its Override
  boxes are ticked for. Only Meeting Location, Video Link, Additional
  Information, Facilitator, Moderator and Moderation state can be
  overridden. Seats, Format, phone and private always follow the session.
- **Moderation:** workflow "Session" for sessions and occurrences: Draft
  (unpublished), Active (published), Cancelled (unpublished, nothing moves
  out of it). Draft can go to Draft, Active or Cancelled; Active to Active
  or Cancelled. A new session can only be Draft or Active. A Draft
  occurrence can't be set Active while its session is Draft ("Draft
  occurrences cannot be set to Active while the parent session is still
  Draft."). Visitors only see Active occurrences (part 1, EI-5).
- **Locations:** a saved session's Service Location can't be changed (the
  field is disabled, and a changed value is put back on save). An
  occurrence's location is its Meeting Location when set, otherwise its
  Service Location.
- **Deleting:** deleting a session deletes its occurrences. A session can't
  be deleted when any of its occurrences has a registration in the
  Registration API (checked live). Occurrences can never be deleted in the
  site. No rule was found that stops deleting a catalog item that sessions
  use, or an alternate location that sessions use.
- **Who can do what** (site roles in `config/sync/user.role.*.yml`, group
  roles in `group.role.workforce_center-*.yml`):

  | Role | Catalog items | Sessions | Alternate locations |
  |---|---|---|---|
  | Platform Manager (`site_admin`), System Administrator | add, edit, delete | add, edit, delete, every state | add, edit, delete |
  | Event Manager (`event_manager`) | add, edit, delete | add, edit, delete, every state, at any location | — |
  | Job Service Manager (`job_services_administrator`) | view only | add, edit, delete, every state, at any location | — |
  | Job Service Administrator (`job_services_admin`), as a group member | view only | add and edit, only at its assigned locations; no delete | — |
  | Content Management (`content_moderator`) | — | — | add, edit, delete in its groups |
  | Account Management (`user_manager`) | — | — | add and edit, no delete |
  | Location Administrator (`contributor`) | — | — | — |
  | Job seeker, visitor | view occurrences only | — | — |

## Test cases

"Page" is the address after the site name. Every case logs in as `admin`
unless its Required login says otherwise, creates its own catalog item named
N, and ends with [Cleanup](#cleanup). "A status message confirms the save"
means a green status message and no red error message.

### Catalog items

`tests/functional/events/catalog-items.spec.ts`

| ID | Test | Page | Steps | Expected result | Required login |
|---|---|---|---|---|---|
| CI-1 | Add a catalog item with every field | `/admin/content/add/event-catalog-item` | 1. Open the add form and read it. 2. Fill it in as "the case's catalog item" and click "Save". 3. Filter `/admin/content/events/event-catalog-item` by Name N. 4. Open the item's page from the list. **Cleanup:** delete the catalog item. | **1.** "Add Catalog Item" with Event Name, Services (29 checkboxes), Sponsor ("- Select a value -", Job Service, Local Only), Topics (the six topics), Event Type (Job Club, Job Fair or Networking Event, Workshop), Description, URL alias and Status, with Active chosen; Event Name, Services, Sponsor, Topics, Event Type and Description are marked required. **2.** A status message confirms the save. **3.** One row: N, Active, Local Only, today's date as MM-DD-YYYY, and a "Schedule" link to `/happenings/catalog-item/<id>/schedule`. **4.** The page shows Event Name N, Sponsor Local Only, Topic Resumes, Event Type Workshop and the description, with the tabs View, Edit, Delete, Revisions, Translate and Schedule. | `admin` |
| CI-2 | Required fields | `/admin/content/add/event-catalog-item` | 1. Click "Save" with the form empty. 2. Type N in Event Name and click "Save". 3. Filter the catalog list by Name N. **Cleanup:** delete any catalog item named N. | **1.** The browser stops the save on Event Name with its "Please fill out this field." message, and the page doesn't change. **2.** The form comes back with N kept and a red error for each of Services, Sponsor, Topics, Event Type and Description (Drupal's "<field> field is required."). **3.** No item named N is listed. | `admin` |
| CI-3 | Editing a catalog item renames its sessions and occurrences | the catalog item's edit form | Create the case's catalog item and schedule a session with Date W (not recurring). 1. Edit the catalog item: change Event Name to "N edited", Event Type to "Job Club", and save. 2. Open the session list filtered by "N edited" and the session page. 3. As a visitor, open the occurrence's page. | **1.** A status message confirms the save. **2.** The session's row and the session page show "N edited"; the occurrence is titled "N edited <Weekday, Month D, YYYY>". **3.** The h1 is "N edited <Weekday, Month D, YYYY>" and the tags include "Job Club" instead of "Workshop". | `admin` |
| CI-4 | The list's filters and making an item inactive | `/admin/content/events/event-catalog-item` | 1. Filter by Name N. 2. Tick N's row, choose "Set catalog item as Inactive" and click "Apply to selected items". 3. Filter by Name N with Status Active, then Inactive, then "- Any -". 4. Filter by Name N with Sponsor "Job Service", then "Local Only". 5. Open the Aitkin Event Scheduler and filter its Name by N. 6. Click "Reset" on the catalog list. **Cleanup:** delete the catalog item. | **1.** Only N is listed, with Status Active. **2.** A status message confirms the action and N's Status is Inactive. **3.** N isn't listed with Active; it is with Inactive and with "- Any -". **4.** N isn't listed with Job Service; it is with Local Only. **5.** N isn't offered for scheduling (see Open questions). **6.** Every filter is back to its default (empty Name, Status and Sponsor "- Any -"). | `admin` |
| CI-5 | Deleting a catalog item | the catalog item's delete page | 1. Create a second catalog item "N unused" and open its Delete page. 2. Click "Cancel". 3. Open the Delete page again and confirm. 4. For the case's catalog item N, schedule a Draft session with Date W, then open N's Delete page and confirm if it lets you. 5. Open the session page. **Cleanup:** delete the session, then N. | **1.** "Are you sure you want to delete the Catalog Item N unused?" and "This action cannot be undone." show, with a delete button and "Cancel". **2.** The item's page or the list opens, and the item is still listed. **3.** A status message confirms the delete, and the item is no longer listed; its page answers "Page Not Found". **4.** The delete is refused (no Delete, or a message saying sessions still use it), and N is still listed. **5.** The session page opens and still shows N's name and description. | `admin` |

### The session form

`tests/functional/events/session-form.spec.ts`

| ID | Test | Page | Steps | Expected result | Required login |
|---|---|---|---|---|---|
| SN-1 | Every field of a new session | `/happenings/catalog-item/<id>/schedule` | Open the form for the case's catalog item and read it without filling anything in. | **1.** The h1 is "Schedule N session"; "Event Information" shows the item's description and "Facilitated by Local Only". **2.** Date shows today; Start Time and End Time each offer "- Select -" and 7:00 AM to 8:00 PM in 15-minute steps (53 times); "This is a recurring event" is not ticked, and "Repeats every", "Until", the days and "Preview Occurrence Dates" are hidden. **3.** Service Location (empty, required), Format (In Person and Online, neither ticked, required), Accommodation Phone Number (required, with "Enter 10 digit phone number, example: 555-555-5555"), Facilitator (required), Moderator, Available Seats (required) and "This is a private event" (not ticked, with its "Private events can only be used for specific situations approved by a CareerForce manager…" help) show. **4.** Meeting Location, Video Link and Additional Information are hidden. **5.** Status offers Draft and Active only, with Draft chosen, and a "Save" button shows. | `admin` |
| SN-2 | The Service Location sets the Meeting Location and staff choices | `/happenings/catalog-item/<id>/schedule` | 1. Tick In Person, type "Aitkin" in Service Location and pick "CareerForce in Aitkin". 2. Open Aitkin's edit form (`/careerforce-location/careerforce-aitkin/edit`, without saving) and read which "Alternative Locations" are ticked. 3. Back on the schedule form, change Service Location to "CareerForce in Bloomington". | **1.** The suggestion list offers "CareerForce in Aitkin", and the box then shows "CareerForce in Aitkin (<id>)". Meeting Location offers "Same as Service Location" first (chosen) and then Aitkin's alternate locations; Facilitator and Moderator list staff names. **2.** The ticked "Alternative Locations" are exactly the Meeting Location choices from step 1 after "Same as Service Location" (on QA "CareerForce Downtown"). **3.** Meeting Location changes to "Same as Service Location" and Bloomington's alternate locations (on QA "Eden Prairie Library"), and no Aitkin alternate is offered. | `admin` |
| SN-3 | Format shows the right fields | `/happenings/catalog-item/<id>/schedule` | 1. Tick In Person only. 2. Untick it and tick Online only. 3. Tick both. | **1.** Meeting Location shows; Video Link and Additional Information are hidden. **2.** Video Link (marked required, with "This must be an external URL such as https://example.com.") and Additional Information show; Meeting Location is hidden. **3.** All three show. | `admin` |
| SN-4 | What a new session refuses | `/happenings/catalog-item/<id>/schedule` | One test per row of [the table below](#sn-4-values): schedule a session as usual (single date W unless the row says otherwise) with the row's change, and click "Save". **Cleanup:** delete any session named N that was saved. | For every row: **1.** The form comes back with the row's red error message next to its field and every other value kept. **2.** No batch page shows, and the session list filtered by N lists nothing. | `admin` |
| SN-5 | Schedule a single-date session | `/happenings/catalog-item/<id>/schedule` | 1. Schedule an Active session with Date W, not recurring, and save. 2. Open the session's row. 3. Open the session page. 4. As a visitor, open the occurrence's page, then the search. | **1.** The batch page "Generating occurrences" shows, then "Occurrence generation complete." **2.** One row: W at 10:00 AM to 11:00 AM, N, CareerForce in Aitkin, the facilitator, In Person, Active, "Does not repeat", 0 registrants and 10 seats. **3.** One occurrence, "N <Weekday, Month D, YYYY>" for W, Active, with 0 registrants and 10 seats; Repeats On, Time "10:00 AM - 11:00 AM", Location and Offered By "CareerForce in Aitkin". **4.** The page opens with h1 "N <Weekday, Month D, YYYY>" (its blocks are checked in part 1's ED-1); the search lists it (see Open questions on indexing). | `admin` |
| SN-6 | What can be changed on a saved session | the session's edit form | 1. Schedule an Active, weekly session on Monday from W until W+14, then open its edit form. 2. Schedule a Draft session with Date W and open its edit form. | **1.** Date, Start Time, End Time, "This is a recurring event", "Repeats every", Weeks/Months and the days are disabled and keep their values; Until is enabled; there is no "Preview Occurrence Dates"; Service Location shows "CareerForce in Aitkin" and is disabled; Format, Meeting Location, Accommodation Phone Number, Facilitator, Moderator, Available Seats and private can be changed; Status offers Active and Cancelled. The tabs are View, Edit, Delete, Admin View Registrations and Revisions. **2.** Status offers Draft, Active and Cancelled, with Draft chosen. | `admin` |
| SN-7 | Changing seats and staff on a session reaches every occurrence | the session's edit form | 1. Schedule an Active, weekly session Monday to Friday from W until W+11 (8 occurrences), then edit it: Available Seats 15, another Facilitator, Accommodation Phone Number `555-555-0100`, and save. 2. Open the session's row and the session page. 3. Open the first and last occurrences' edit forms. 4. As a visitor, open the first occurrence's page. | **1.** "Updating and generating occurrences" shows, then "Occurrences updated and generated." **2.** The row shows Seats 15 and the new facilitator; every occurrence on the session page shows the new facilitator and Seats 15, and there are still 8, all Active. **3.** Both show Available Seats 15, the new facilitator and the new phone number. **4.** "Accommodation Phone Number" shows (555) 555-0100. | `admin` |
| SN-8 | Holding a session at an alternate location | `/happenings/catalog-item/<id>/schedule` | 1. Schedule an Active session with Date W, Meeting Location set to Aitkin's first alternate location (on QA "CareerForce Downtown"), and save. 2. Open the session's row and the session page. 3. As a visitor, open the occurrence's page. | **1.** "Occurrence generation complete." shows. **2.** The row's Service Location is still "CareerForce in Aitkin"; the session page's Location shows the alternate location's name and address, and Offered By "CareerForce in Aitkin". **3.** Location shows the alternate location's name and address, and Offered By "CareerForce in Aitkin" (part 1's ED-3 checks the page in depth). | `admin` |
| SN-9 | An online session | `/happenings/catalog-item/<id>/schedule` | 1. Schedule an Active session with Date W, Format Online only, Video Link `https://example.com/playwright`, Additional Information `Playwright test note <timestamp>`, and save. 2. Open the session's row. 3. As a visitor, open the occurrence's page. | **1.** "Occurrence generation complete." shows. **2.** The row's Format is "Online". **3.** The tags start with "Online" and Location shows "Online" with no street address (as in part 1's ED-4). | `admin` |

#### SN-4 values

| Change | Error message |
|---|---|
| Date the first Saturday after D | "You may not schedule Sessions on Saturday or Sunday." |
| Date D-1 (yesterday; if that is a Saturday or Sunday, the last Friday before it) | "The start date/time must be in the future." |
| End Time 9:45 AM (before the 10:00 AM start) | "End time must be after start time." |
| Recurring weekly on Monday, Until W | "Until date must be after start date." |
| Available Seats 0 | An error on Available Seats saying it must be at least 1 |
| Available Seats left empty | "Available Seats field is required." |
| Accommodation Phone Number `12345` | An error on the phone number ("Enter 10 digit phone number, example: 555-555-5555") |
| Service Location left empty | "Service Location field is required." |
| Neither In Person nor Online ticked | "Format field is required." |
| Online ticked, Video Link empty | "Video Link field is required." |
| Online ticked, Video Link `not a link` | An error on Video Link saying it must be a valid URL |
| No Facilitator | "Facilitator field is required." |

### Dates, repeats and the preview

`tests/functional/events/recurrence.spec.ts`. RC-1 to RC-3 only fill in the
form and use "Preview Occurrence Dates", which reads and saves nothing; each
checks at the end that no session named N exists.

| ID | Test | Page | Steps | Expected result | Required login |
|---|---|---|---|---|---|
| RC-1 | The repeat controls | `/happenings/catalog-item/<id>/schedule` | 1. Tick "This is a recurring event". 2. Choose Months. 3. Choose Weeks again, then untick "This is a recurring event". | **1.** "Repeats every" (1), a Weeks/Months choice on Weeks, "Until" with its help "The final occurrence of the session. When editing a session, setting to an earlier date will cancel occurrences after the new date and registrants will receive a cancellation email. Setting to a later date will extend the session so that new occurrences will be generated.", Monday to Friday (none ticked, and no Saturday or Sunday) and "Preview Occurrence Dates" show. **2.** First, Second, Third, Fourth, Fifth and Last show as well as the days. **3.** First to Last hide again; then every repeat control and the preview button hide. | `admin` |
| RC-2 | Preview a weekday rule | `/happenings/catalog-item/<id>/schedule` | 1. Set Date W, 10:00 AM to 11:00 AM, recurring weekly, Monday to Friday ticked, Until W+25, and click "Preview Occurrence Dates". 2. Click "Close". | **1.** A dialog "Preview Occurrence Dates" opens with "This is a preview of occurrences that will be generated for the session based on the entered recurrence settings. Only the next upcoming occurrences will be generated immediately after saving the session. The rest will be generated automatically as time passes." and 20 lines, one for each weekday from W to W+25 in order, each "<Weekday, Month D, YYYY> 10:00 AM", none on a Saturday or Sunday. **2.** The dialog closes, the form keeps every value, and no session named N exists. | `admin` |
| RC-3 | The preview for other rules | `/happenings/catalog-item/<id>/schedule` | One test per row of [the table below](#rc-3-values): set the row's rule (10:00 AM to 11:00 AM) and click "Preview Occurrence Dates". | For every row: **1.** The dialog lists exactly the row's dates, in order, or shows the row's message. **2.** Nothing is saved. | `admin` |
| RC-4 | A repeat without an Until date | `/happenings/catalog-item/<id>/schedule` | 1. Set Date W, recurring weekly with Monday ticked and Until empty, and click "Preview Occurrence Dates". 2. Fill in the rest of the session as usual and click "Save". 3. Open the session page, if the session was saved. | The preview and the save agree. **1.** Either the Mondays from W show (at least up to 50 days ahead), or a message says Until is needed; not "No occurrences found." for a rule that saving accepts. **2.** Either the save is refused with a message on Until, or the batch ends with "Occurrence generation complete." **3.** The Mondays from W to D+50 are listed, the same dates as the preview showed up to D+50. See Open questions. | `admin` |

#### RC-3 values

| Rule | Expected preview |
|---|---|
| Every 2 weeks on Tuesday, from W until W+56 | The Tuesdays W+1, W+15, W+29, W+43 |
| Monthly, Third Wednesday, from W until W+180 | The third Wednesday of each month from W's month (when it is on or after W) up to W+180, including dates more than 50 days ahead |
| Weekly with no day ticked, Date W (a Monday), until W+21 | The Mondays W, W+7, W+14, W+21 |
| Weekly with no day ticked, Date the Saturday W-2, until W+21 | "No occurrences found." |
| Weekly on Monday, Until W-7 (before the Date) | "No occurrences found." (saving it is refused, SN-4) |
| Weekly on Monday, Date D-14, until W+14 | Only the Mondays from today onward up to W+14; no past date |
| Weekly Monday to Friday, from W until D+90 | Every weekday from W to D+90, including the ones after D+50 that saving won't create yet (see OG-1) |

### Occurrence generation and the Until date

`tests/functional/events/occurrence-generation.spec.ts`

| ID | Test | Page | Steps | Expected result | Required login |
|---|---|---|---|---|---|
| OG-1 | A weekday session is generated up to 50 days ahead | `/happenings/catalog-item/<id>/schedule` | 1. Schedule an Active session, recurring weekly Monday to Friday from W until D+70, and save. 2. Open the session's row. 3. Open the session page. 4. As a visitor, open the search. | **1.** "Generating occurrences", then "Occurrence generation complete." **2.** Repeats on is "Weekly on Monday, Tuesday, Wednesday, Thursday or Friday". **3.** One Active occurrence for every weekday from W up to 50 days from now (D+50 is included only when the test runs after 10:00 AM), in date order, titled "N <Weekday, Month D, YYYY>", each with Seats 10 and Registrants 0; none on a Saturday or Sunday, none after D+50, no date twice. Ends On Date shows D+70. **4.** Every occurrence up to D+45 is listed and none after D+45 (part 1's EI-1 to EI-3 check the window in depth). | `admin` |
| OG-2 | A monthly session | `/happenings/catalog-item/<id>/schedule` | 1. Schedule an Active session, recurring monthly on the Third Wednesday from W until W+180, and save. 2. Open the session's row and the session page. | **1.** "Occurrence generation complete." **2.** Repeats on is "Monthly on the Third Wednesday"; the occurrences are exactly the third Wednesdays from W to D+50 (1 or 2), each Active. | `admin` |
| OG-3 | Moving Until later adds occurrences | the session's edit form | 1. Schedule an Active, weekly session on Monday from W until W+14 (3 occurrences) and note their IDs. 2. Edit it, set Until to W+35, and save. 3. Open the session page. | **1.** The session page lists the Mondays W, W+7 and W+14. **2.** "Updating and generating occurrences", then "Occurrences updated and generated." **3.** The Mondays from W to W+35 (or to D+50 if that is earlier) are listed, all Active; the first three keep their IDs, and no Monday is listed twice. | `admin` |
| OG-4 | Moving Until earlier cancels the later occurrences | the session's edit form | 1. Schedule an Active, weekly session Monday to Friday from W until W+11 (8 occurrences). 2. Edit it, set Until to W+4, and save. 3. Open the session page. 4. As a visitor, open the page of the occurrence on W+7, then the search. | **1.** Eight Active occurrences are listed. **2.** No warning shows (nobody is registered); "Occurrences updated and generated." **3.** All 8 are still listed: W to W+4 Active with an Edit operation, W+7 to W+11 Cancelled with no Edit. **4.** The visitor can't see the cancelled occurrence (as in part 1's EI-5), and the search lists only W to W+4. | `admin` |
| OG-5 | The warning before cancelling registered occurrences | the session's edit form | Schedule an Active, weekly session on Monday from W until W+21 (4 occurrences). As `jobseeker`, register for the W+21 occurrence ("Register", then "Complete Registration", as in smoke ER-1). 1. As the admin, edit the session, set Until to W+7, and click "Save". 2. Click "No". 3. Set Until to W+7 again, click "Save", then "Yes". 4. Open the session page. 5. As `jobseeker`, open the W+21 occurrence's page. **Cleanup:** cancel the registration, then the session can't be deleted, so set it to Cancelled. | **1.** The form comes back with a warning: "Changing this session's Until date to <Month D, YYYY of W+7> means cancelling upcoming occurrences for which users have already registered. Registrants will receive a cancellation email. Would you like to proceed?" and "Yes" and "No" buttons; no batch page shows, and the session page still lists 4 Active occurrences. **2.** The warning goes away, Until shows W+21 again, and nothing is saved. **3.** "Occurrences updated and generated." shows. **4.** W and W+7 are Active; W+14 and W+21 are Cancelled. **5.** The page no longer offers the event as one the job seeker is registered for (part 3 checks what it shows instead). | `admin`, `jobseeker` |

### Overrides on one occurrence

`tests/functional/events/overrides.spec.ts`

| ID | Test | Page | Steps | Expected result | Required login |
|---|---|---|---|---|---|
| OV-1 | What one occurrence can change | an occurrence's edit form | 1. Schedule an Active, weekly session on Monday from W until W+14 and open the W+7 occurrence's edit form from the session page. 2. Tick each "Override" box in turn. 3. Open `/events/event-occurrence/<id>/delete`. | **1.** "Edit N <Weekday, Month D, YYYY>" and "You are making edits to a single occurrence. The changes you make will only affect this occurrence." show. Label, Description, Session, Format, the start and end dates and times, Service Location, Accommodation Phone Number, Available Seats and "This is a private event" are disabled. There are exactly six Override boxes, none ticked: Meeting Location, Video Link, Additional Information, Facilitator, Moderator and Moderation state, and each of those fields is disabled. "Change to" offers Active and Cancelled. **2.** Each field becomes editable when its own box is ticked, and only then. **3.** The site answers 403 "Access denied"; the session page offers no Delete for any occurrence. | `admin` |
| OV-2 | An override survives a session edit | an occurrence's edit form | 1. Schedule an Active, weekly session on Monday from W until W+14 (Meeting Location "Same as Service Location"). On the W+7 occurrence, tick "Override Meeting Location" and pick Aitkin's first alternate location, tick "Override Facilitator" and pick another name, and save. 2. Edit the session: Available Seats 12, a third Facilitator, and save. 3. Open the session page and the W+7 occurrence's edit form. 4. As a visitor, open the W and W+7 occurrence pages. | **1.** A status message confirms the save. **2.** "Occurrences updated and generated." **3.** W and W+14 show the session's new facilitator; W+7 keeps its own facilitator and its overridden Meeting Location (both Override boxes still ticked); all three show 12 seats. **4.** W's Location is "CareerForce in Aitkin"; W+7's Location is the alternate location, and both say Offered By "CareerForce in Aitkin". | `admin` |
| OV-3 | Removing an override | an occurrence's edit form | Do OV-2 step 1 first. 1. On the W+7 occurrence, untick "Override Meeting Location" and save. 2. Open its edit form again. 3. As a visitor, open its page. | **1.** A status message confirms the save. **2.** Meeting Location is back to the session's ("Same As Service Location") and disabled; "Override Facilitator" is still ticked with its own name. **3.** Location shows "CareerForce in Aitkin". | `admin` |

### Draft, Active and Cancelled

`tests/functional/events/moderation-states.spec.ts`. The visitor checks here
only check that the occurrence is shown or hidden; part 1's EI-5 checks the
hidden page in depth.

| ID | Test | Page | Steps | Expected result | Required login |
|---|---|---|---|---|---|
| MS-1 | A Draft session | `/happenings/catalog-item/<id>/schedule` | 1. Schedule a session with Status Draft, weekly on Monday from W until W+7, and save. 2. Open the session page. 3. Open the W occurrence's edit form. 4. As the admin, open its page; then as a visitor open its page and the search. | **1.** "Occurrence generation complete." **2.** Two occurrences, both Draft. **3.** "This Occurrence belongs to a draft Session. Activate the Session to alter the moderation state of the Occurrence." shows; "Change to" (Draft, Cancelled) and "Override Moderation state" are disabled. **4.** The admin sees the page; the visitor is sent to the login page (or gets access denied), and the search doesn't list it. | `admin` |
| MS-2 | Activating a Draft session | the session's edit form | Do MS-1 step 1 first. 1. Edit the session, set Status to Active, and save. 2. Open the session page and the session's edit form. 3. As a visitor, open the W occurrence's page and the search. | **1.** "Occurrences updated and generated." **2.** Both occurrences are Active; Status now offers only Active and Cancelled. **3.** The page opens for the visitor and the search lists both dates. | `admin` |
| MS-3 | Cancelling an Active session | the session's edit form | 1. Schedule an Active, weekly session on Monday from W until W+7, then edit it, set Status to Cancelled, and save. 2. Open the session page and the session's row. 3. Open the session's edit address. 4. Open Aitkin's Location Events with Moderation state Cancelled. 5. As a visitor, open the W occurrence's page and the search. | **1.** A status message confirms the save. **2.** Both occurrences are Cancelled with no Edit operation; the row shows Cancelled and still has Delete (no registrations). **3.** 403 "Access denied": a cancelled session can't be edited. **4.** The session is listed. **5.** The visitor can't see the occurrence, and the search doesn't list it. | `admin` |
| MS-4 | Cancelling a Draft session directly | the session's edit form | 1. Schedule a Draft session with Date W, then edit it, set Status to Cancelled, and save. 2. Open the session page. | **1.** A status message confirms the save (Draft to Cancelled is allowed). **2.** The occurrence is Cancelled. | `admin` |
| MS-5 | Cancelling one occurrence | an occurrence's edit form | 1. Schedule an Active, weekly session on Monday from W until W+14. On the W+7 occurrence, tick "Override Moderation state", set "Change to" Cancelled, and save. 2. Edit the session, change Available Seats to 11, and save. 3. Open the session page and the W+7 occurrence's edit address. 4. As a visitor, open the W occurrence's page and the search. | **1.** A status message confirms the save. **2.** "Occurrences updated and generated." **3.** W+7 is still Cancelled, with no Edit, and its edit address answers 403; W and W+14 are Active with 11 seats. **4.** "Additional times are offered for this event:" lists W+14 and not W+7, and the search lists W and W+14 but not W+7. | `admin` |
| MS-6 | Bulk actions on sessions and occurrences | `/admin/content/events/event-session?label=<N>` | 1. Schedule a Draft session with Date W, and an Active weekly session on Monday from W until W+14. In the session list filtered by N, tick the Draft session, choose "Activate Session" and click "Apply to selected items". 2. On the weekly session's page, tick the W and W+7 occurrences, choose "Cancel occurrences" and apply (confirming if asked). 3. In the session list, tick the weekly session, choose "Cancel Session" and apply. | **1.** A status message confirms the action; the first session and its occurrence are Active. **2.** A status message confirms it; W and W+7 are Cancelled and W+14 is still Active. **3.** The session and W+14 are Cancelled. | `admin` |

### Scheduling from a location

`tests/functional/events/location-scheduler.spec.ts`

| ID | Test | Page | Steps | Expected result | Required login |
|---|---|---|---|---|---|
| LS-1 | The location's Event Scheduler | `/careerforce-location/careerforce-aitkin/event-scheduler` | 1. Open the page. 2. Filter Name by N. 3. Click "Back to Group". | **1.** The h1 is "Event Scheduler for CareerForce in Aitkin"; the location's tabs include Event Scheduler and Location Events; "Add event to catalog" links to `/admin/content/add/event-catalog-item`; the table has Catalog Item, Date Added and Operations, every row with a "Schedule" link to `…/event-scheduler/<item id>/schedule`. **2.** Only N is listed, with today's date and "Schedule". **3.** The Aitkin location's group page opens (`/group/<group>`; 813 on QA). | `admin` |
| LS-2 | Schedule from the location with the location locked | `/careerforce-location/careerforce-aitkin/event-scheduler` | 1. Click "Schedule" on N. 2. Read Service Location, Status and Meeting Location. 3. Fill in Format In Person, the phone, a Facilitator, Seats 8, Date W, 1:00 PM to 2:00 PM, Status Active, and save. 4. Open Aitkin's Location Events and the session's row. | **1.** The h1 is "Schedule N session for CareerForce in Aitkin". **2.** Service Location shows "CareerForce in Aitkin (<id>)" and can't be changed; Status offers Draft and Active; Meeting Location offers "Same as Service Location" and Aitkin's alternate locations only. **3.** "Occurrence generation complete." **4.** Location Events lists N with Location "CareerForce in Aitkin", W at 1:00 PM to 2:00 PM, Active and Seats 8; the session's row shows the same. | `admin` |
| LS-3 | Location Events filters | `/careerforce-location/careerforce-aitkin/location-events` | Schedule two sessions at Aitkin for N: a Draft one with Date W and an Active one with Date W+7. 1. Filter Event Name by N. 2. Add Moderation state Draft, then Active, then Cancelled. 3. Set Moderation state back to "- Any -" and Date From W+1. 4. Filter by Event Name N at Bloomington's Location Events. | **1.** Both sessions are listed, and no other name. **2.** Only the Draft one, then only the Active one, then neither. **3.** Only the W+7 one. **4.** Neither is listed. | `admin` |

### Alternate locations

`tests/functional/events/alternate-locations.spec.ts`. The alternate
location is named N, at a synthetic address: `100 Playwright Test Way`,
Aitkin, Minnesota, `56431`.

| ID | Test | Page | Steps | Expected result | Required login |
|---|---|---|---|---|---|
| AT-1 | Create an alternate location in the group | `/group/<Aitkin's group>/location/add` | 1. Open "Add location". 2. Click "Alternative Location" and read the form. 3. Fill in Name N and the address, keep "Publishing status" ticked, and save. 4. Open the group's locations list. | **1.** It offers Alternative Location, CareerForce Location and CareerForce Statewide or Virtual. **2.** "Add Alternative Location" with Publishing status (ticked), Name (required), Description, Address (Street Address Line 1 to 3, City, State with Minnesota chosen, ZIP Code), Phone (type Main, Fax, Other, TTY; number; Ext; "Add another item"), Authored by and URL alias. **3.** A status message confirms the save. **4.** N is listed with its address, Location type "Alternative Location" and Published, with View, Edit, Manage Availability and Delete. | `admin` |
| AT-2 | An alternate location isn't on the public locations list | `/locations` | Create the location as in AT-1. 1. As a visitor, open `/locations?search_api_fulltext=<N>&loc[loc][text]=`. 2. As a visitor, open `/locations?search_api_fulltext=Aitkin&loc[loc][text]=`. | **1.** "No results found." **2.** "CareerForce in Aitkin" is listed, and N isn't. | `admin` |
| AT-3 | It is offered as a Meeting Location once a location lists it | `/careerforce-location/careerforce-aitkin/edit` | Create the location as in AT-1. 1. Open the Aitkin schedule form for the case's catalog item and open Meeting Location. 2. On Aitkin's edit form, tick N under "Alternative Locations" and save. 3. Open the Aitkin schedule form again, schedule an Active session with Date W and Meeting Location N, and save. 4. As a visitor, open the occurrence's page. 5. Open the Bloomington schedule form for the catalog item and open Meeting Location. **Cleanup:** as in [Cleanup](#cleanup), including unticking N on Aitkin. | **1.** N isn't offered. **2.** A status message confirms the save, and the other ticked alternate locations are still ticked. **3.** N is offered; "Occurrence generation complete." **4.** Location shows N and "100 Playwright Test Way", "Aitkin, MN 56431"; Offered By shows "CareerForce in Aitkin". **5.** N isn't offered. | `admin` |
| AT-4 | Deleting an alternate location | the location's delete page | Create the location as in AT-1 and a second one, "N unused", the same way. Tick N on Aitkin and schedule an Active session with Date W at Meeting Location N, as in AT-3. 1. Open "N unused"'s Delete page, then confirm. 2. Open N's Delete page and confirm if it lets you. 3. As a visitor, open the occurrence's page. 4. Open Aitkin's edit form. | **1.** "Are you sure you want to delete the location N unused?" and "This action cannot be undone." show; after confirming, a status message confirms the delete and the group's list no longer has it. **2.** Either the delete is refused with a message that sessions use N, or it goes through. **3.** The page opens with no error; Location shows N (when the delete was refused) or "CareerForce in Aitkin" (when it went through), never an empty location. **4.** "Alternative Locations" has no box for a deleted location. | `admin` |

### Private events

`tests/functional/events/private-events.spec.ts`. These cases check the
search and the Aitkin location page; part 1's EI-4 checks the homepage and
Similar Events for an existing private event.

| ID | Test | Page | Steps | Expected result | Required login |
|---|---|---|---|---|---|
| PR-1 | A private session stays out of public listings | `/happenings/catalog-item/<id>/schedule` | 1. Schedule an Active session with Date W and "This is a private event" ticked, and save. 2. As a visitor, open the search, and Aitkin's location page (every page of its "Events"). 3. As the admin, open the occurrence's page and its edit form. | **1.** "Occurrence generation complete." **2.** No card links to the occurrence. **3.** The page opens; "This is a private event" is ticked and disabled on the occurrence. | `admin` |
| PR-2 | Making a public session private, and back | the session's edit form | 1. Schedule an Active, weekly session on Monday from W until W+7, not private; as a visitor, open the search. 2. Edit the session, tick "This is a private event", and save; as a visitor, open the search. 3. Untick it and save; as a visitor, open the search. | **1.** Both dates are listed. **2.** "Occurrences updated and generated."; neither date is listed. **3.** Both dates are listed again. | `admin` |

### Deleting and cancelling

`tests/functional/events/delete-cancel.spec.ts`

| ID | Test | Page | Steps | Expected result | Required login |
|---|---|---|---|---|---|
| DL-1 | Delete a session nobody registered for | the session's delete page | 1. Schedule an Active, weekly session on Monday from W until W+7 and note its occurrence IDs. 2. Click "Delete" on the session's row. 3. Click "Cancel". 4. Delete it again and confirm. 5. Open each occurrence's page. | **1.** The row has a Delete operation. **2.** "Are you sure you want to delete the Session N?" and "This action cannot be undone." show, with a delete button and "Cancel". **3.** The session is still listed. **4.** A status message confirms the delete, and the session list filtered by N is empty. **5.** Each answers 404 "Page Not Found". | `admin` |
| DL-2 | A session with a registration can only be cancelled | the session's row | Schedule an Active, weekly session on Monday from W until W+7. As `jobseeker`, register for the W occurrence (as in smoke ER-1). 1. As the admin, open the session's row and the session page. 2. Open the session's delete address. 3. Edit the session, set Status to Cancelled, and save. 4. Open the session page. **Cleanup:** cancel the registration; the session stays Cancelled (see Open questions). | **1.** The row has no Delete; the session page's W occurrence shows Registrants 1. **2.** 403 "Access denied". **3.** A status message confirms the save. **4.** Both occurrences are Cancelled. | `admin`, `jobseeker` |
| DL-3 | A cancelled session with no registrations can be deleted | the session's delete page | 1. Schedule an Active session with Date W, then set it to Cancelled. 2. Delete it from its row and confirm. | **1.** The row still has Delete. **2.** A status message confirms the delete, and the session list filtered by N is empty. | `admin` |

### Who can schedule

`tests/functional/events/scheduling-permissions.spec.ts`. Each case is
skipped with a reason while its login doesn't exist. "Refused" means the
site answers 403 "Access denied" (or, for a visitor, sends them to the login
page) and shows no form. Where a case needs an item or session, the admin
creates it first and removes it in `finally`.

| ID | Test | Page | Steps | Expected result | Required login |
|---|---|---|---|---|---|
| PM-1 | A visitor can't reach any scheduling page | see Expected result | Open each address without logging in. | Each sends the visitor to `/user/login?destination=<the address>`: `/admin/content/events`, `/admin/content/events/event-catalog-item`, `/admin/content/add/event-catalog-item`, `/admin/content/events/event-session`, `/admin/content/events/event-occurrence`, `/happenings/catalog-item/<id>/schedule`, `/careerforce-location/careerforce-aitkin/event-scheduler`, `/careerforce-location/careerforce-aitkin/location-events`, `/events/event-occurrence/<id>/edit`, `/group/<group>/location/add/alt_location`. | |
| PM-2 | A job seeker can't schedule | see PM-1 | Open each PM-1 address. | Each is refused with 403 "Access denied", and no form or list shows. | `jobseeker` |
| PM-3 | An Event Manager runs the catalog and schedules anywhere | `/admin/content/add/event-catalog-item` | 1. Add the case's catalog item. 2. Schedule an Active session with Date W from Aitkin's Event Scheduler, and open Bloomington's Event Scheduler. 3. Delete the session, then the catalog item. | **1.** A status message confirms the save. **2.** "Occurrence generation complete."; Bloomington's Event Scheduler opens with "Schedule" links. **3.** Both deletes are confirmed by a status message. | `event-manager` |
| PM-4 | A Job Service Manager schedules but doesn't manage the catalog | `/careerforce-location/careerforce-aitkin/event-scheduler` | The admin creates the case's catalog item. 1. Open `/admin/content/add/event-catalog-item` and the catalog item's edit and delete addresses. 2. Schedule an Active session with Date W from Aitkin's Event Scheduler. 3. Edit the session's seats, then delete the session. | **1.** All three are refused, and the Event Scheduler shows no "Add event to catalog". **2.** "Occurrence generation complete." **3.** Both are confirmed by a status message. | `job-service-manager` |
| PM-5 | A Job Service Administrator only schedules at their own location | `/careerforce-location/careerforce-aitkin/event-scheduler` | The account is a member of Aitkin's group with Aitkin as its assigned location. The admin creates the case's catalog item and an Active Bloomington session with Date W. 1. Schedule an Active session with Date W from Aitkin's Event Scheduler. 2. Edit that session's seats and save. 3. Open the session's delete address. 4. Open Bloomington's Event Scheduler, and the Bloomington session's edit address. 5. Open `/admin/content/add/event-catalog-item`. | **1.** "Occurrence generation complete." **2.** "Occurrences updated and generated." **3.** Refused. **4.** Both are refused. **5.** Refused. | `job-service-admin` |
| PM-6 | A Location Administrator can't schedule | `/careerforce-location/careerforce-aitkin/event-scheduler` | As a Location Administrator for Aitkin, open Aitkin's Event Scheduler, Location Events and `/happenings/catalog-item/<id>/schedule`. | Each is refused. | `location-admin` |
| PM-7 | Content Management adds and deletes alternate locations | `/group/<Aitkin's group>/location/add/alt_location` | 1. Create the alternate location as in AT-1. 2. Delete it from the group's locations list. | **1.** A status message confirms the save, and the list shows it. **2.** A status message confirms the delete. | `content-manager` |

## Good to know

- **Finding what a case created.** A new session's address isn't known in
  advance: the test finds it with `/admin/content/events/event-session?label=<N>`
  and follows the row's links. The occurrence list has no filters, so
  occurrences are read from the session page.
- **The batch page** runs in the browser after "Save"; wait for the status
  message ("Occurrence generation complete." or "Occurrences updated and
  generated.") rather than a fixed time. A long weekday session sends one
  Registration API call per occurrence, so allow a minute.
- **Dates in forms** are typed as YYYY-MM-DD into date boxes; times are
  picked by their text ("10:00 AM").
- **The 51-occurrence limit can't be reached** through the form: with
  weekdays only and 50 days ahead, a session gets at most 36 occurrences
  when it is saved. See Not covered.
- **Service Location suggestions:** type part of the name, wait for the
  list and click the suggestion; typing the full name without picking it
  leaves the field without an ID.

## Mobile

None. Every case changes data and uses admin screens, so all are
`@desktop-only` and run only in `functional-desktop`.

## Expected result

| Project | Cases |
|---|---|
| `functional-desktop` | CI-1 to CI-5, SN-1 to SN-9 (SN-4 is 1 test per row), RC-1 to RC-4 (RC-3 is 1 test per row), OG-1 to OG-5, OV-1 to OV-3, MS-1 to MS-6, LS-1 to LS-3, AT-1 to AT-4, PR-1, PR-2, DL-1 to DL-3, PM-1 to PM-7 (PM-3 to PM-7 skipped until their logins exist) |
| `functional-mobile` | None |

## Not covered

- **Emails.** Shortening Until on registered occurrences (OG-5) and
  cancelling a session or occurrence with registrants send emails through
  the Registration API. There is no mailbox the tests can read, so they
  stay a manual check (see Open questions).
- **The 51-occurrence limit** (`generate_max_count`): unreachable through
  the form with weekdays only and the 50-day limit.
- **Cron generation:** occurrences after the first 50 days come from the
  daily cron. The tests don't wait a day or run cron; OG-1 checks only
  what the save creates.
- **"Add occurrence"** (`/events/event-occurrence/add`), a form for adding a
  single occurrence by hand, and "Reassign Staff Member" on the session page.
- **Revisions and translations** of catalog items and sessions.
- **The Account Management group role**, which can add and edit alternate
  locations but not delete them: no login is planned for it.
- **Visitor pages in depth:** part 1. **Registration, cancellation by the job
  seeker and the waitlist:** part 3. **The Attendees tab:** part 4.
- **External events:** part 5.

## Open questions

1. **Logins for other roles (PM-3 to PM-7).** Only `admin` (a System
   Administrator, who passes every check) and `jobseeker` exist. Can the team
   create QA and Stage accounts for an Event Manager, a Job Service Manager,
   a Job Service Administrator who is a member of Aitkin's group with Aitkin
   as assigned location, a Location Administrator for Aitkin, and a Content
   Management user, saved as `event-manager`, `job-service-manager`,
   `job-service-admin`, `location-admin` and `content-manager`? The
   expected results for them come from the role and group permission config,
   not from a running site.
2. **Deleting a catalog item that sessions use (CI-5).** No rule in the
   source stops it, and the delete page opened for an item with sessions.
   CI-5 expects the delete to be refused while sessions use the item. Is
   that right, and what should happen to the sessions?
3. **Deleting an alternate location that sessions use (AT-4).** The delete
   page for "CareerForce Downtown", which Aitkin uses, gave no warning.
   Should it be refused, or should occurrences fall back to the Service
   Location? AT-4 accepts either, but not a broken page.
4. **A repeat without Until (RC-4).** The preview showed "No occurrences
   found." for weekly on Monday with Until empty, and Until isn't required.
   What does saving it do, and should Until be required for a recurring
   session?
5. **Inactive catalog items in the Event Scheduler (CI-4).** Should an
   Inactive catalog item still be offered for scheduling? CI-4 expects not.
   No item on QA was Inactive to check.
6. **A cancelled occurrence's edit page.** The site shows "This Occurrence
   has been cancelled. The moderation state cannot be changed." on the edit
   form of a cancelled occurrence, but on QA that edit page answers 403 for
   the admin (the workflow allows no move out of Cancelled), so the message
   is never seen. MS-3 and MS-5 expect the 403. Is that intended?
7. **Session delete and "Registrants".** A session can't be deleted when any
   occurrence has a registration in any status, including past and
   cancelled ones, even when Registrants shows 0. So OG-5 and DL-2 leave a
   Cancelled `Playwright test` session on QA and Stage every run. Is that
   acceptable, or can the Registration API data for test sessions be
   removed?
8. **Search indexing.** SN-5, OG-1, OG-4, MS-2, MS-3, MS-5 and PR-2 search
   right after a save. Are occurrences indexed on save, or only on cron? If
   on cron, those steps need a wait or a different check.
9. **Emails.** Is there a test mailbox the Registration API can send to for
   the `jobseeker` account, so OG-5 and DL-2 can check the cancellation
   emails?
10. **Bulk "Cancel occurrences" (MS-6).** What does it ask and say? It wasn't
    run on QA. MS-6 expects a status message and the chosen occurrences
    Cancelled.

## Suggested files

```
tests/
  functional/events/
    catalog-items.spec.ts            # CI-1 .. CI-5
    session-form.spec.ts             # SN-1 .. SN-9
    recurrence.spec.ts               # RC-1 .. RC-4
    occurrence-generation.spec.ts    # OG-1 .. OG-5
    overrides.spec.ts                # OV-1 .. OV-3
    moderation-states.spec.ts        # MS-1 .. MS-6
    location-scheduler.spec.ts       # LS-1 .. LS-3
    alternate-locations.spec.ts      # AT-1 .. AT-4
    private-events.spec.ts           # PR-1, PR-2
    delete-cancel.spec.ts            # DL-1 .. DL-3
    scheduling-permissions.spec.ts   # PM-1 .. PM-7
    helpers/
      scheduling-data.ts             # N, D and W; create a catalog item and a session; the Cleanup steps, run in finally
  pages/
    catalog-item-form.page.ts        # add/edit form, list filters, bulk action, delete page
    event-session-form.page.ts       # reuse from smoke-events if it exists: fields, Service Location autocomplete, rrule widget, preview dialog, batch wait, Until warning
    event-session.page.ts            # session list row, session page occurrence table and bulk actions
    event-occurrence-edit.page.ts    # override boxes and fields
    location-events.page.ts          # Event Scheduler and Location Events
    group-locations.page.ts          # add alternate location, Alternative Locations on a location, delete
```
