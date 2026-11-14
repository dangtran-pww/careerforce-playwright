# [Smoke] - Events - Test Plan

Status: partially implemented
Implemented test: tests/smoke/events/listing.spec.ts, tests/smoke/events/filters.spec.ts
Pending cases: EP-1 to EP-3, EA-1 to EA-3, ER-1, ER-2, ES-1 — ready to generate

Devices: EP-1 to EP-4 run on desktop and on a phone. EP-5 to EP-7 are tagged `@desktop-only`: the filtering happens on the server, so checking it once on desktop is enough. Every other case logs in as `admin` or `jobseeker`, changes data, and is tagged `@desktop-only` (and `@no-prod`).

A quick check after each deploy that the main events flows still work, one pass each: what visitors see, an admin scheduling an event, a job seeker registering and cancelling, and attendance with its service record. The cases come from the team's manual post-deploy checklist on Confluence, "Prod DEED Smoke Testing 11/05/2026" (events section), and the online-only card check from [MNDEED-9620](https://portland-webworks.atlassian.net/browse/MNDEED-9620) (open). The in-depth versions are the functional Events plans in [test-suites/events/](../events/suite.md).

Already covered elsewhere, so not repeated here:

- Location pages load: LV-1 in [smoke-public-site.md](smoke-public-site.md). "Upcoming Events" lists at least 1 item: HP-1.
- Events search sort and filters after a reindex, and Similar Events: AM-4 (and AM-3) in [smoke-admin-maintenance.md](smoke-admin-maintenance.md).

## Running it

```bash
npm run login:manual -- admin
npm run login:manual -- jobseeker
BASE_URL=https://qa.careerforce.link npx playwright test tests/smoke/events --project=smoke-desktop

# Only the visitor checks (prod-safe), desktop and phone:
BASE_URL=https://qa.careerforce.link npx playwright test tests/smoke/events --grep "EP-" --project=smoke-desktop --project=smoke-mobile

# Production: the no-prod cases are left out
BASE_URL=https://careerforce.mn.gov npx playwright test tests/smoke/events --project=smoke-desktop
```

Log in as both roles just before the run. The server ends a session that has made no request for 15 minutes (900 seconds since its last ordinary request; see [smoke-auto-logout.md](smoke-auto-logout.md)).

## Scope

- **Visitor (EP, prod-safe):** the Events page and an event page, the Events filters, the 45-day display window, event cards on the homepage and a location page, and the online-only card location (MNDEED-9620).
- **Admin (EA, no-prod):** create a catalog item, schedule a short recurring session from it, and remove the test events afterwards.
- **Job seeker (ER, no-prod):** register for one of the session's occurrences, then cancel.
- **Attendance (ES, no-prod):** an admin adds the job seeker to another occurrence, marks them attended, and a service record appears.
- The no-prod cases share one catalog item and session, so they run in order with one worker. EA-3 removes the test events last, also in `finally`.

## Login and test data

| | |
|---|---|
| **Visitor** | EP cases, and the visitor checks inside EA-2 and EA-3, use a logged-out browser context. |
| **`admin`** | `playwright/.auth/<env>/admin.json` (see [smoke-admin-maintenance.md → Login](smoke-admin-maintenance.md#login)). On QA it is a System Administrator, so it can schedule at any location without being a group member. |
| **`jobseeker`** | `playwright/.auth/<env>/jobseeker.json`. A job seeker with a complete Tier 2 profile (registering needs Tier 2). Its user ID is read from the address `/user` redirects to. |
| **Environments** | EP cases: QA, Stage and Production. Everything else: QA and Stage only. |

Test data, all titled `Playwright test <timestamp>` and synthetic:

- **Catalog item** (EA-1): Event Name `Playwright test <timestamp>`, a short description, Services "Resume Writing Assistance", Sponsor "Local Only", Topic "Resumes", Event Type "Workshop", Status Active.
- **Session S** (EA-2): Service Location "CareerForce in Aitkin", Format "In Person", Meeting Location "Same as Service Location", Accommodation Phone Number `555-555-0100`, Facilitator and Moderator as filled in, Available Seats 10, Status Active, 10:00 AM to 11:00 AM, recurring weekly on Monday to Friday from the next weekday at least 2 days ahead, until 7 days after that. Its 1st occurrence is used by ER-1 and ER-2, its 2nd by ES-1.

## What the site has

Checked on QA as a visitor on 2026-11-12, without saving anything:

- **Events page** `/education-and-training/events`: 59 events, 15 per page ("Showing 46-59 of 59" on the last page). The last card was December 25, 2026, inside the window (D+45 = December 27).
- **Online-only event:** "Creative Job Search: Job Search Over 55" (for example `/events/event-occurrence/445`). Its search card has the format tag "ONLINE" only and the location "Online"; its event page shows LOCATION "Online" and OFFERED BY "CareerForce in Bemidji". The same event's cards on the homepage "Upcoming Events" carousel and on `/careerforce-location/careerforce-bemidji` (Events section) show "Bemidji, MN or Online". The hybrid "Job Club" shows "Minneapolis, MN and Online" on its search card.
- **Homepage "Upcoming Events"** is a carousel (`view-display-id-upcoming_events`) with a "Distance from" location filter; the slides are cloned, so each card appears twice in the page. Cards link to `/events/event-occurrence/<id>`.
- **Location page events:** the Bemidji page's "Events" section (`view-display-id-block_events_by_service_location`) shows 6 cards a page, a pager, and "Find a filterable list of all events" linking to `/education-and-training/events`.
- **Event page as a visitor:** "Please create an account or log in to register for this event." and "Log In or Create Account"; when other dates exist, "Additional times are offered for this event:" with "View" links and "See More".

Checked on QA as `admin` on 2026-11-12 (see [functional-events-scheduling.md → What the site has](../events/functional-events-scheduling.md#what-the-site-has) for the full forms), without saving anything:

- **Catalog item list** `/admin/content/events/event-catalog-item` ("Event Catalog"): filters Name (`n`), Status, Sponsor; each item has "Schedule" (`/happenings/catalog-item/<id>/schedule`). Add form `/admin/content/add/event-catalog-item` ("Add Catalog Item"): Event Name, Services, Sponsor, Topics, Event Type and Description are required; Status Inactive or Active.
- **Session form** `/happenings/catalog-item/<id>/schedule` ("Schedule <item> session"): Date, Start Time, End Time, "This is a recurring event" (then "Repeats every", Weeks or Months, "Until", Monday to Friday, "Preview Occurrence Dates"), Service Location (autocomplete), Format, Meeting Location, Accommodation Phone Number, Facilitator, Moderator, Available Seats, "This is a private event", Status (Draft, Active), "Save".
- **Session list** `/admin/content/events/event-session` ("Event Sessions"): filter Event Name (`label`) and Status; columns include Event Session, Status, Repeats on ("Weekly on Monday, Tuesday, Wednesday, Thursday or Friday"), Registrants and Seats; bulk actions "Activate Session" and "Cancel Session". The occurrence list `/admin/content/events/event-occurrence` has no filters.
- **Session page:** an occurrence table (Occurrence, Facilitator, Status, Registrants, Seats, Operations).
- **Deleting and cancelling:** a session with any registration, even a cancelled one, has no Delete (it answers 403), so it can only be cancelled. The edit page of a cancelled session or occurrence answers 403.

From the KB (`docs/kb/events/`, `docs/kb/services/`, `docs/kb/job-seeker-tools/`) and the mn-careerforce source, not checked on a running site (the `jobseeker` session had expired):

- **Registration** (job seeker, Tier 2): "Register" reserves a seat and opens `/events/event-occurrence/<id>/registration` ("Confirm Your Registration", button "Complete Registration"), then `/registration-success`. The event page then shows "You are registered for this event." and "Cancel Registration". A job seeker who isn't Tier 2 is sent to the next profile step with "Please complete your profile to continue registering for events." and `destination` set to `/registration`. Tier 2 steps: Education and Employment, Equal Opportunity, Military and Veterans, Income and Public Assistance.
- **Cancel** opens a dialog "Cancel Event Registration", "Are you sure you would like to cancel your event registration?", "Yes"; then "Your registration has been cancelled." and a redirect to `/user/<uid>/events_appointments`.
- **Attendees tab** `/events/event-occurrence/<id>/attendees` ("<occurrence> - Attendees", "Displaying X-Y of Z"): "+ Add Attendee" (disabled "No seats available" when full), "+ Add to Waitlist" (disabled "Seats are available, waitlist not open" when not full). The add form has "First name, last name, or email" (offers Tier 2 users only) and a Format choice. Row operations: Registered → Mark Attended, Mark Canceled, Resend Confirmation; Waitlisted → Mark Registered, Mark Canceled; Canceled → Mark Registered; Attended → Record Additional Service, Undo Attendance. Messages: "Registration canceled successfully.", "Attendance marked successfully. Service record created.", "Attendance has been undone and the attendee is now Registered. Service record deleted."
- **Dashboards:** the job seeker dashboard `/user/<uid>` has an events block (`job_seeker_dashboard_events`); "My Events & Appointments" `/user/<uid>/events_appointments` has "Upcoming Events" and "Past Events" with columns Date & Time, Event Name, Location, Status, Format, Actions. Staff see the same tab for a job seeker as "Events and Appointments". Location is "Online" or the event's location (the Meeting Location when set).
- **Services tab** `/user/<uid>/services`: staff only, lists the job seeker's service records; marking an event attendee attended creates one automatically, copying the event's locations, facilitator and services.
- **Emails** (confirmation, cancellation, waitlist, occurrence cancelled, updated) are sent by the external Registration API from its own templates, not by Drupal.

## Test cases

All the cases are in one table, one area after another: what a visitor sees
(EP), an admin scheduling an event (EA), a job seeker registering and
cancelling (ER), and attendance with its service record (ES). The EP cases
need no login. EA logs in as `admin`, ER as `jobseeker`, and ES as both; see
"Login and test data". EA-3 runs last, in `finally`.

EP-4 to EP-7 were LV-2 and FL-1 to FL-3 in [smoke-public-site.md](smoke-public-site.md), and moved here so all the Smoke events checks are in one plan.

| ID | Test | Page | Steps | Expected result | Required login | Prod |
|---|---|---|---|---|---|---|
| EP-1 | Events stay within 45 days | `/education-and-training/events`, `/` | D is today in America/Chicago. 1. Open the Events page filtered from D+46 to D+365 (`?fs=<D+46>&fe=<D+365>`, dates as YYYY-MM-DD). 2. Open the Events page with no filter and go to its last page. 3. Open the homepage and read the date of every card in "Upcoming Events". | **1.** No card links to a CareerForce event (`/events/event-occurrence/<id>`): the page shows "No results found." or only external events (`/events/event-external/…` or `/events/external/…`). **2.** The last card's date is no later than D+45. **3.** No card's date is before D or later than D+45. | | Yes |
| EP-2 | Homepage and location pages feature events | `/`, a location page | Use the first LV-1 location page that has an "Events" section, else `/careerforce-location/careerforce-bemidji`; if none has one, the location steps are skipped with a reason. 1. On the homepage, read the first "Upcoming Events" card and open it. 2. Open the location page. 3. Open the first card in its "Events" section. | **1.** The card has a title, a date, a time and a location, and links to `/events/event-occurrence/<id>`; the event page has the same title and the card's date. **2.** The "Events" section lists at least 1 card with a title, date, time and location, and a "Find a filterable list of all events" link to `/education-and-training/events`. **3.** The event page opens, and its "Offered By" names the location page's location. | | Yes |
| EP-3 | Online-only event card shows "Online" (MNDEED-9620) | `/education-and-training/events?ff[virtual]=virtual`, `/`, a location page | Pick an online-only event: a card on the Online-filtered Events page whose format tags are "ONLINE" only (no "IN PERSON"), and whose event page shows LOCATION "Online". Skip with a reason if there is none. 1. Read the card's location line on the Events page. 2. Find a card for the same event (same title and date) on the homepage "Upcoming Events" or on the page of the location in its "Offered By", and read its location line. | **1.** The location line is "Online". **2.** The location line is "Online", the same as on the Events page: not "<City>, MN or Online" for an event that is online only. | | Yes |
| EP-4 | Events page lists events | `/education-and-training/events` | Don't register. 1. Open the page. 2. Click the first event. | **1.** The page title "Events" shows, with at least 1 event listed below it. The first event card has a title, a date, a start time and a place. **2.** The event's page has the event title, the sections "Date", "Time", "Location" and "Offered By", and a "Log In or Create Account" button. | | Yes |
| EP-5 | Events filters: Online vs In Person | `/education-and-training/events` | See [Filters](#filters). 1. Open the page with no filter. 2. Filter by Format "Online". 3. Filter by "In Person" instead. | **1.** At least 1 event is listed. **2.** "Online" stays ticked, with no more events than in step 1. **3.** The same for "In Person", and the results differ from step 2's (a different total, or different events on the first page). | | Yes |
| EP-6 | Events filters: two topics | `/education-and-training/events` | See [Filters](#filters). 1. Open the page with no filter. 2. Filter by Topic "Resumes". 3. Filter by "Job Search" instead. | **1.** At least 1 event is listed. **2.** "Resumes" stays ticked, with no more events than in step 1. **3.** The same for "Job Search", and the results differ from step 2's (a different total, or different events on the first page). | | Yes |
| EP-7 | Events filters: two event types | `/education-and-training/events` | See [Filters](#filters). 1. Open the page with no filter. 2. Filter by Event Type "Workshop". 3. Filter by "Job Club" instead. | **1.** At least 1 event is listed. **2.** "Workshop" stays ticked, with no more events than in step 1. **3.** The same for "Job Club", and the results differ from step 2's (a different total, or different events on the first page). | | Yes |
| EA-1 | Create an event catalog item | `/admin/content/add/event-catalog-item` | 1. Fill in the catalog item as in "Login and test data" and click "Save". 2. Open `/admin/content/events/event-catalog-item?n=<name>`. **Cleanup:** EA-3. | **1.** A status message confirms the save, with no error message. **2.** The catalog item is listed once, Active, with a "Schedule" operation. | `admin` | No: creates an event catalog item |
| EA-2 | Schedule a short recurring session | `/happenings/catalog-item/<id>/schedule` | Use the catalog item from EA-1. 1. Fill in session S as in "Login and test data", click "Preview Occurrence Dates", close the preview, and click "Save". 2. Open `/admin/content/events/event-session?label=<name>`, then the session's page. 3. As a visitor, search the Events page for the name (`?fq=<name>`). **Cleanup:** EA-3. | **1.** The preview lists one weekday from the start date to the Until date per line, with no Saturday or Sunday; after saving, no error message shows. **2.** The list shows the session once, Active, "Weekly on Monday, Tuesday, Wednesday, Thursday or Friday", with 10 seats; its page lists one occurrence for each of those weekdays. **3.** Every occurrence is listed, each linking to `/events/event-occurrence/<id>`. | `admin` | No: creates events visitors can see |
| EA-3 | Remove the test events | `/admin/content/events/event-session?label=<name>` | Runs last, in `finally`. 1. Cancel session S: tick it and run "Cancel Session" (it has had registrations, so it can't be deleted). 2. Edit the catalog item and set its Status to Inactive. 3. As a visitor, search the Events page for the name. | **1.** A status message confirms the action, and the session's Status is Cancelled. **2.** A status message confirms the save. **3.** No event with the name is listed. | `admin` | No: cancels test events |
| ER-1 | Register for an event | the 1st occurrence of S | 1. Open the occurrence and click "Register". 2. Click "Complete Registration". 3. Open the occurrence again. 4. Open the dashboard `/user/<uid>` and My Events & Appointments `/user/<uid>/events_appointments`. **Cleanup:** ER-2. | **1.** `/events/event-occurrence/<id>/registration` opens, titled "Confirm Your Registration", with "Complete Registration". **2.** `/events/event-occurrence/<id>/registration-success` opens, with no error message. **3.** The page shows "You are registered for this event." and "Cancel Registration", and no "Register". **4.** Both list the occurrence under upcoming events with Status "Registered". | `jobseeker` | No: registers for an event |
| ER-2 | Cancel the registration | the 1st occurrence of S | Use the registration from ER-1. 1. On the occurrence's page, click "Cancel Registration". 2. Click "Yes". 3. Open the dashboard `/user/<uid>`. 4. Open the occurrence's page. | **1.** A dialog shows "Cancel Event Registration" and "Are you sure you would like to cancel your event registration?" **2.** "Your registration has been cancelled." shows on `/user/<uid>/events_appointments`, where the occurrence has Status "Canceled". **3.** The dashboard's events block no longer lists the occurrence. **4.** "Register" shows again, and "You are registered for this event." doesn't. | `jobseeker` | No: cancels a registration |
| ES-1 | Mark an attendee attended and a service record appears | the 2nd occurrence of S | The job seeker isn't registered for it. 1. As the admin, on the occurrence's Attendees tab, click "+ Add Attendee", type the job seeker's email, pick them from the suggestions, choose "In Person", and click "Add Attendee". 2. Click "Mark Attended" on the job seeker's row. 3. As the job seeker, open My Events & Appointments. 4. As the admin, open the job seeker's Services tab `/user/<uid>/services`. **Cleanup:** click "Undo Attendance" (expect "Attendance has been undone and the attendee is now Registered. Service record deleted."), then "Mark Canceled". | **1.** The job seeker is listed with Status "Registered" and Format "In Person". **2.** "Attendance marked successfully. Service record created." shows, and the row has Status "Attended". **3.** The occurrence is listed with Status "Attended". **4.** A service record for the occurrence's date is listed. | `admin`, `jobseeker` | No: registers a job seeker and creates a service record |

## Filters

EP-5 to EP-7 check that a filter actually filters, the same way as the FL cases in [smoke-public-site.md → Filters](smoke-public-site.md#filters). Each opens the Events page with no filter, then with filter X, then with filter Y, and expects at least 1 event unfiltered, no more events for X or Y than unfiltered, and X and Y to show different results (a different total, or different events on the first page). An empty result is fine, and so is a filter that matches everything (on QA, every event is In Person); only X and Y showing the very same results fails. Exact counts are never checked. Every filter is in the page address (for example `?ff[virtual]=virtual`, `ft[791]=791`, `fy[785]=785`), so the tests open that address rather than clicking the form.

## Not covered

In depth, in the functional Events plans ([test-suites/events/](../events/suite.md)):

- **Search, filters, what the search leaves out (private, cancelled, past events), external events and the event page:** [functional-events-search-detail.md](../events/functional-events-search-detail.md).
- **Scheduling in depth:** draft and cancelled sessions, seat changes, recurrence and Until, occurrence overrides, the location's Event Scheduler, alternate locations, private events, delete vs cancel and permissions: [functional-events-scheduling.md](../events/functional-events-scheduling.md).
- **Registration in depth:** the Tier 1 → Tier 2 hand-off, an admin cancelling a registration or an occurrence, and the veteran waitlist: functional-events-registration (to be written).
- **The Attendees tab in depth:** functional-events-attendees (to be written).

Also not covered here:

- **Emails.** The checklist expects an email for a registration and a cancellation. The Registration API sends them and the tests have no mailbox to read, so they stay a manual check after ER-1 and ER-2 until there is one (see Open questions).
- Appointments: [smoke-appointments](smoke-appointments.md).

## Open questions

- **Emails.** Is there a test mailbox the Registration API can send to for the `jobseeker` account (for example a Mailpit or a shared inbox the tests can read)? If so, the email checks can move into ER-1 and ER-2.
- **Search indexing.** Are new occurrences indexed as soon as they are saved, or only on cron? EA-2 and EA-3 search the Events page right after a save.
- **Service records (ES-1).** Is sending service records to the State's activity system switched on for QA or Stage? If it is, ES-1 sends one each run (and deletes it on Undo Attendance).
- **Leftover data.** A session with registrations, even cancelled ones, can't be deleted, so EA-3 cancels it and sets the catalog item to Inactive. Is a cancelled `Playwright test` session and an inactive catalog item left on QA and Stage each run acceptable?

## Suggested files

```
tests/
  smoke/events/
    listing.spec.ts           # EP-4 (implemented, desktop and phone)
    filters.spec.ts           # EP-5 .. EP-7 (implemented, desktop only)
    public.spec.ts            # EP-1 .. EP-3 (desktop and phone)
    01-schedule.spec.ts       # EA-1, EA-2 (creates the shared catalog item and session S)
    02-register.spec.ts       # ER-1, ER-2
    03-attendance.spec.ts     # ES-1
    04-cleanup.spec.ts        # EA-3, also run in finally
  pages/
    event-session-form.page.ts   # schedule a session, the recurrence widget
    event-occurrence.page.ts     # register, cancel dialog, status messages
    event-attendees.page.ts      # add attendee, mark attended, undo
    my-events.page.ts            # dashboard events block and My Events & Appointments rows
```

The numbered files share the catalog item and session S (pass their IDs through a small JSON file in `test-results/` or a shared fixture), so the plan needs one worker.
