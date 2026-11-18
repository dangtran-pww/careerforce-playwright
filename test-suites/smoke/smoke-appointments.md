# [Smoke] - Appointments - Test Plan

Status: implemented
Implemented test: tests/smoke/appointments/public.spec.ts, tests/smoke/appointments/session.spec.ts

## Overview

A quick check after each deploy that the main appointments flows still
work, one pass each: what visitors see in the appointment search, an admin
creating a short appointment session, a job seeker booking and cancelling,
an admin adding and cancelling an attendee, attendance with its service
record, and an admin cancelling a slot.

The AP cases only read, so they run on QA, Stage and **Production**. The
AA, AB and AS cases create, book and cancel appointments visitors could
book, so they run on QA and Stage only.

The cases come from the team's manual post-deploy checklist on Confluence,
"Prod DEED Smoke Testing 11/05/2026" (appointments section). The in-depth
versions are the functional plans in
[test-suites/appointments/](../appointments/suite.md): so far
[](../appointments/functional-appointments-search.md); the scheduling,
booking and attendance plans are still to be written.

## Login

| **AP cases** | Visitor, not logged in |
|---|---|
| **AA, AB and AS cases** | Admin role and Job seeker role, as in the Required login column |
| **Visitor checks in AA, AB and AS cases** | Visitor, not logged in |
| **Accounts touched** | The job seeker account: AB-1 books a slot, AS-1 and AS-2 register it on slots, and AS-2 adds a service record. AB-2 cancels the booking, AS-1 cancels its registration, and AS-2 undoes the attendance (which deletes the service record) and cancels the registration. |

## Test cases

AP-1 and AP-2 are in `public.spec.ts`. The other cases are in
`session.spec.ts`; they share session S, so they run in order, one at a
time, in the table's order but with AA-3 last: AA-1, AA-2, AB-1, AB-2,
AS-1, AS-2, AS-3, AA-3. A case run on its own creates S first. D is today
in America/Chicago. See [Test data](#test-data) for session S and its
slots.

| ID | Test | Page | Steps | Expected result | Required login | Prod |
|---|---|---|---|---|---|---|
| AP-1 | Appointment search lists open times | `/connect-careerforce/schedule-an-appointment` | Don't book. 1. Open the page. 2. If today has no time, click the next days in the strip (then Next Week) until one shows a location card with at least 1 time. | 1. The title "Schedule an Appointment" shows, with the Location, Distance From and Format filters, a Monday to Friday strip, and "Available appointments for <today>" (or the next Monday at the weekend). 2. At least 1 location card shows a location name, an address and at least 1 time button; each time button shows a time and at least one of "online", "phone", "in person", and links to `/appointments/<id>/booking`. | | Yes |
| AP-2 | Nothing more than 8 days ahead is offered | `/connect-careerforce/schedule-an-appointment` | 1. Open every enabled day in the strip, this week and every week Next Week reaches, with `?start=<date>`, and read the date of each time button. 2. Open `?start=<date>` for each weekday from D+9 to D+14. | 1. Every time button's date is from D to D+8. 2. Each day shows "There are no appointments available on this day." and no time button. | | Yes |
| AA-1 | Create a short appointment session | `/group/<group>/location/<location>/location-appointments` (CareerForce in Aitkin) | 1. Open the location's Appointments tab and click "Create appointment". 2. Fill in session S as in [Test data](#test-data) and click "Save". 3. Open the Appointments tab filtered to each slot's day (Date From and Date To that day; one range over all the days pages unreliably once earlier runs' cancelled slots share the times). **Cleanup:** AA-3. | 1. The "Create appointment" form opens, with Service Location "CareerForce in Aitkin (883)" already filled in. 2. "The appointment session Appointment session #<id> has been created." shows on the session page, with no error message; the page lists one slot at 3:00 PM for each weekday from the start date to the Until date (no Saturday or Sunday), each Active, with the chosen Staff Member and no registrant. 3. Each of those slots is listed once, with Status "Active", the chosen Staff Member, Available Formats "Online, Phone, In person" and no Registrant. | `admin` | No: creates appointments visitors can book |
| AA-2 | The session's slots show in the search only within 8 days | `/connect-careerforce/schedule-an-appointment` | Use session S from AA-1. As a visitor: 1. Open `?start=<date>` for each slot of S dated D+7 or earlier. 2. Open `?start=<date>` for each slot of S dated D+9 or later. | 1. On each day, the "CareerForce in Aitkin" card has a "3:00 pm" time button showing "online phone in person" and linking to that slot's `/appointments/<id>/booking`. 2. No time button links to a slot of S. | | No: reads the slots AA-1 created |
| AA-3 | Remove the test slots | the session page of S | Runs last. If an earlier case fails, the tests still cancel what is left afterwards. 1. Tick every slot of S that isn't Cancelled, choose "Cancel occurrences" and click "Apply to selected items". 2. On `/admin/content/appointments/appointment-session`, tick session S, choose "Cancel Session" and apply it (it has had bookings, so it has no Delete). 3. As a visitor, open `?start=<date>` on the search for each slot of S dated D+8 or earlier. | 1. A status message confirms the action, with no error message, and every slot of S has Status "Cancelled". 2. Session S has Status "Cancelled". 3. No time button links to a slot of S. | `admin` | No: cancels test appointments |
| AB-1 | Book an appointment | slot 1 of S | 1. Open the search at `?start=<slot 1's date>` and click the "CareerForce in Aitkin" "3:00 pm" time. 2. Choose "Phone", type `555-555-0101`, tick "Resumes" and "Job Search", and click "Complete Booking". 3. Open the dashboard `/user/<uid>`. 4. Open My Events & Appointments `/user/<uid>/events_appointments`. 5. As the admin, open the session page of S. **Cleanup:** AB-2. | 1. `/appointments/<id>/booking` opens, titled "Book Your Appointment", with "Select a format" (Online, Phone, In Person), the topics list, "Complete Booking", and slot 1's date and "3:00 PM". 2. `/appointments/<id>/booking-success` opens, titled "Your Appointment is Booked!", with "A confirmation email was sent to <email>.", a "My Dashboard" link and slot 1's date and time, and no error message. 3. "Upcoming Events & Appointments" lists slot 1's date and time under Appointments, not "You are not registered for any upcoming appointments." 4. Under Upcoming, Appointments lists slot 1 with Status "Registered", Format "Phone" and "View or Cancel". 5. Slot 1's row shows the job seeker as Registrant with Registration Status "Registered". | `jobseeker`, `admin` | No: books an appointment |
| AB-2 | Cancel the appointment booking | slot 1 of S | Use the booking from AB-1. 1. On My Events & Appointments, click "View or Cancel" for slot 1. 2. Click "Cancel registration". 3. Click "Yes, cancel my registration". 4. Open the dashboard `/user/<uid>`. 5. As a visitor, open the search at `?start=<slot 1's date>`. | 1. Slot 1's page opens with its date and time, and "Cancel registration". 2. "Cancel Appointment" shows, with "Are you sure you would like to cancel your appointment?", "Yes, cancel my registration" and "No, keep my registration". 3. "Your appointment registration has been cancelled." shows on `/user/<uid>/events_appointments`, and Upcoming no longer lists slot 1. 4. The dashboard's Appointments no longer lists slot 1. 5. The "CareerForce in Aitkin" card offers the "3:00 pm" time for slot 1 again. | `jobseeker` | No: cancels a booking |
| AS-1 | Staff add an attendee to a slot and cancel the registration | slot 2 of S | The job seeker isn't booked on it. 1. As the admin, on slot 2's page, click "Add attendee". 2. Type the job seeker's email, pick them from the suggestions, choose "In Person", and click "Register". 3. As the job seeker, open My Events & Appointments. 4. As the admin, on slot 2's page, click "Cancel registration", then "Yes, cancel my registration". 5. Open slot 2's page. | 1. "Add Attendee to Appointment - <slot 2's weekday, Month d, yyyy>" opens, with "First name, last name or email", Format (Online, Phone, In Person) and "Register". 2. "User registered for appointment successfully." shows on slot 2's page, which names the job seeker, shows Registration Status "Registered" and an in-person Selected Format, and offers "Cancel registration", "Resend Confirmation" and "Mark Attended" but not "Add attendee". 3. Under Upcoming, Appointments lists slot 2 with Status "Registered" and Format "In Person". 4. "Your appointment registration has been cancelled." shows, with no error message. 5. The page shows "No one has registered for this appointment." and "Add attendee" again. | `admin`, `jobseeker` | No: registers the job seeker for an appointment |
| AS-2 | Mark an attendee attended and a service record appears | slot 3 of S | As the admin, add the job seeker to slot 3 as in AS-1 step 2, with "Online". 1. On slot 3's page, click "Mark Attended". 2. Choose the session's Staff Member, tick "Resume Writing Assistance", and click "Save". 3. Open the job seeker's Services tab `/user/<uid>/services`. **Cleanup:** on slot 3's page click "Undo Attendance" (expect "Attendance has been undone and the registrant is now Registered. Service record deleted."), then "Cancel registration" and "Yes, cancel my registration". | 1. "Add Service Record - <first> <last>" opens at `…/appointments/<slot 3 id>/add-service-record`, with Service Location "CareerForce in Aitkin" (not editable) and Format "Online" already set. 2. "Service recorded for <first> <last>" shows on slot 3's page, with no error message; Registration Status reads "User has been marked attended" (the slot page's wording for Attended), "Undo Attendance" shows and "Mark Attended" doesn't. 3. "Recorded Services" lists a record with "Resume Writing Assistance" and the Date of Service from step 2. | `admin` | No: registers the job seeker and creates a service record |
| AS-3 | Cancel a slot and it leaves the search | slot 4 of S | Slot 4 is unbooked and dated D+7 or earlier. 1. As a visitor, open the search at `?start=<slot 4's date>`. 2. As the admin, on the session page of S, tick slot 4, choose "Cancel occurrences" and click "Apply to selected items". 3. As a visitor, open the search at `?start=<slot 4's date>` again. | 1. The "CareerForce in Aitkin" card offers a "3:00 pm" time linking to slot 4's booking page. 2. A status message confirms the action, with no error message, and slot 4 has Status "Cancelled". 3. No time button links to slot 4. | `admin` | No: cancels an appointment visitors could book |

## Test data

Synthetic, marked `Playwright test <timestamp>`.

- **Session S** (AA-1), at "CareerForce in Aitkin"
  (`/group/813/location/883/location-appointments` on QA; the test finds
  the location's Appointments tab by name on each environment): Date is
  the next weekday at least 2 days ahead (the start date), Start Time
  "3:00 PM", "This is a recurring appointment" ticked, Repeats every 1
  Weeks, Until D+14, Days of week Monday to Friday, Available Formats
  Online, Phone and In person, Meeting Location "Same as Service
  Location", Video Link `https://example.com/playwright-test-meeting`
  (required once Online is ticked), Additional Information
  `Playwright test <timestamp>` (the session form has no title field, so
  this marks the test data), Accommodation Phone Number `555-555-0100`,
  Staff Member the first one offered, Status Active. The session's label is
  "Appointment session #<id>"; the test keeps the ID from the address it
  lands on after saving.
- **Slots of S:** one 30-minute slot at 3:00 PM on each weekday from the
  start date to the Until date. With a start date at least 2 days ahead,
  at least 4 of them fall on or before D+7. Slot 1 (the first) is used by
  AB-1 and AB-2, slot 2 by AS-1, slot 3 by AS-2, slot 4 by AS-3.
- **Booking details:** format Phone with phone `555-555-0101`, topics
  "Resumes" and "Job Search" (AB-1); format In Person (AS-1) and Online
  (AS-2) for the attendees the admin adds.
- **Service record** (AS-2): Staff Member the session's, Services "Resume
  Writing Assistance". Deleted by Undo Attendance.
- **Job seeker:** its user ID is read from the address `/user` goes to, and
  its email from the booking success page in AB-1 ("A confirmation email
  was sent to …").
- **Cleanup:** AA-3 cancels the slots and the session. If an earlier case
  fails, the tests cancel whatever is left afterwards; if "Save" was
  clicked but the session page never came, they find S by its Additional
  Information marker.

## Good to know

- **The admin account** is a System Administrator on QA, so it can manage
  appointments at any location without being a group member. It is not
  offered as a Staff Member (see [Open questions](#open-questions)).
- **The job seeker account** has a complete Tier 2 profile: booking needs
  Tier 2.
- **AP-2 and AA-2 check the 8-day window in different ways:** AP-2 checks
  the date of every time the search offers, and AA-2 checks the window
  with slots the test created. AW-3 and AW-5 in
  [](../appointments/functional-appointments-search.md) check that "Next
  Week" stops at the window and that days beyond it are empty.

### Search

Checked on QA as a visitor on 2026-11-12 (a Thursday), without saving
anything.

- **Search** `/connect-careerforce/schedule-an-appointment` ("Schedule an
  Appointment"): "APPOINTMENT SEARCH FILTERS" with Location, Distance From
  (10 to 100 mi), Format (Online, Phone, In person) and "Filter"; a Monday
  to Friday strip with "Previous Week" and "Next Week"; days before today
  are disabled; the heading "Available appointments for <weekday, Month d,
  yyyy>". An empty day shows "There are no appointments available on this
  day. Try adjusting your filters or selecting another day." Other days
  without slots are labelled "<date>. No results on this date."
- **Results:** one card per location ("CareerForce in Aitkin" with its
  address), with a button per open time ("10:45 am", the date and the
  formats in lower case, e.g. "online phone in person") linking to
  `/appointments/<id>/booking`. A day is chosen with `?start=YYYY-MM-DD`.
- **8-day window:** on 2026-11-12, the week of November 16 had "Next Week"
  disabled. Bloomington session #328 has Active, unbooked slots on
  November 16, 18, 20, 23, 25, 27 and later; the search offered the ones
  on November 16 and 20 (D+4, D+8) but none on `?start=2026-11-23` (D+11)
  or after.

### Staff screens

Checked on QA as the admin on 2026-11-12, without saving anything.

- **Location Appointments tab** `/group/813/location/883/location-appointments`
  (shown as `/careerforce-location/careerforce-aitkin/location-appointments`),
  "Appointments for CareerForce in Aitkin": "Create appointment"
  (`/careerforce-location/careerforce-aitkin/appointments-session/add`),
  filters Registrant, Staff Member, Date From, Date To and "Apply"; bulk
  actions "Reassign Staff Member", "Cancel Occurrences" and "Cancel
  Registrations"; columns Date and Time, Registrant, Registration Status,
  Location, Staff Member, Available Formats, Status, Operations ("View" to
  `/careerforce-location/careerforce-aitkin/location-appointments/<session>/<slot>`).
- **Create appointment form** ("Create appointment"): Date (required,
  defaults to today), Start Time (required, 15-minute steps from 7:00 AM),
  "This is a recurring appointment" (then Repeats every, Weeks or Months,
  Until, an "Advanced" section, Days of week Monday to Friday, "Preview
  Occurrence Dates"), Service Location (required, pre-filled "CareerForce
  in Aitkin (883)"), Available Formats (Online, Phone, In person), In
  Person: Meeting Location ("Same as Service Location" or "CareerForce
  Downtown"), Online: Video Link and Additional Information, Accommodation
  Phone Number (required), Staff Member (required; the location's group
  members, "Heather Anderson" first on Aitkin), Status (Draft, Active,
  Cancelled), "Save". There is no title field. No End Time: slots are 30
  minutes.
- **Session page** `/careerforce-location/<location>/location-appointments/<session>`
  ("Appointment session #<id>"): Edit, "Admin View Registrations", bulk
  actions "Reassign Staff Member" and "Cancel occurrences", a slot table
  (Occurrence, Staff Member, Status, Location, Registrant, Registration
  Status, Operations: View, Edit, and "Cancel registration" / "Resend
  Confirmation" on booked slots), then REPEATS ON ("Weekly on Monday,
  Wednesday or Friday"), ENDS ON DATE, TIME, FORMAT, LOCATION,
  ACCOMMODATION PHONE NUMBER.
- **Session list** `/admin/content/appointments/appointment-session`
  ("Appointment Sessions"): filter Status; columns ID, Location, Staff
  Member, Status, Created; bulk actions "Activate Session" and "Cancel
  Session". A session whose slots have never been booked has a Delete
  operation; one with registrations hasn't (session #326 vs #327).
- **Slot page, open slot** (slot 521): title "Appointment - Friday,
  November 13, 2026", "Add attendee", "Go to main session", "No one has
  registered for this appointment.", then DATE, TIME, LOCATION (formats
  and location), OFFERED BY, ACCOMMODATION PHONE NUMBER.
- **Slot page, booked slot** (slot 522, past): title "Appointment - <first>
  <last>", "Cancel registration" and "Mark Attended" (no "Resend
  Confirmation", as the slot is past), Selected Format, Registration Status
  "Registered".
- **Add attendee** `…/<slot>/add-attendee` ("Add Attendee to Appointment -
  Friday, November 13, 2026"): "First name, last name or email"
  (required), Format (Online, Phone, In Person), "What phone number can we
  reach you at?", "Register".
- **Cancel registration** `…/<slot>/cancel-registration`: "Cancel
  Appointment", "Are you sure you would like to cancel your appointment?",
  "Yes, cancel my registration" and "No, keep my registration". The
  session page's link adds `?source=admin`; the slot page's doesn't.
- **Mark Attended** `/careerforce-location/careerforce-aitkin/appointments/<slot>/add-service-record`
  ("Add Service Record - <first> <last>"): Date of Service (defaults to
  today), Services (20 checkboxes, "Resume Writing Assistance" among
  them), Service Location "CareerForce in Aitkin (883)" (locked), Format
  (pre-set to the booked format), Staff Member (empty), Meeting Location
  (locked), "Save" and "Cancel".
- **Slot edit** `…/<slot>/edit`: each overridable field has an "Override …"
  box; the status is "Change to" Active or Cancelled.
- **Admin dashboard** `/user/<uid>`: "My Upcoming Events & Appointments"
  with Appointments "You have no assigned appointments." and "View more
  events and appointments". It lists only slots whose Staff Member is the
  logged-in user (`block_staff_dashboard_appointments` in
  `views.view.appointment_occurrences`).
- **Job seeker's tabs as staff:** `/user/<uid>/services` ("You're
  currently viewing <name>'s Services", "Recorded Services", "Record
  service", "There are no recorded services."); `/user/<uid>/events_appointments`
  titled "Events and Appointments" for staff.

### Job seeker screens

Checked on QA as the job seeker on 2026-11-12, without booking anything.

- **Dashboard** `/user/<uid>`: "Upcoming Events & Appointments" with Events
  and Appointments ("You are not registered for any upcoming
  appointments.") and a "Schedule an Appointment" quick link.
- **Booking page** `/appointments/521/booking` ("Book Your Appointment"):
  "What to know before" (arrive early; "you will receive a confirmation
  email"), "Select a format" (Online, Phone, In Person), "What phone number
  can we reach you at?", "What topics would you like to focus on? You may
  choose up to three." (Career Exploration, Digital Skills, Interviewing,
  Job Search, Networking, Resumes, Other with a text box), "Complete
  Booking", then the slot's DATE, TIME, LOCATION.
- **My Events & Appointments** `/user/<uid>/events_appointments`:
  "Upcoming" ("View printable version", Events, Appointments) and "Past" on
  the same page. Past Appointments columns: Date & Time, Location, Status,
  Format. A past Phone appointment shows a phone number in its Location
  column. `/user/<uid>/past_events_appointments` answers 403 "Access
  denied".

### From the source

From the mn-careerforce source (`cf_appointments`, `appointments`), not
checked on a running site.

- **Search window:** the search lists slots whose start is after now and
  no later than now + 8 days (`views.view.book_an_appointment`,
  `'+8 day'`). Booked and past slots are hidden.
- **Session saved:** "The appointment session Appointment session #<id> has
  been created.", then the session page. A start in the past gives "The
  start date/time must be in the future." Slots are created Monday to
  Friday, up to 32 days ahead.
- **Booking:** "Complete Booking" leads to `/appointments/<id>/booking-success`,
  "Your Appointment is Booked!", "A confirmation email was sent to
  <email>.", a "My Dashboard" link and the slot's details. Only the person
  who booked sees it; others are redirected. A phone number is required
  only for Phone.
- **Upcoming appointments** (dashboard block and My Events & Appointments)
  list only bookings with status Registered or Waitlisted, each with "View
  or Cancel" linking to the slot page, where the job seeker has "Cancel
  registration".
- **Cancel registration:** "Your appointment registration has been
  cancelled.", then `/user/<registrant uid>/events_appointments`, or the
  location's Appointments tab when the link had `?source=admin`.
- **Add attendee:** "User registered for appointment successfully.", back
  on the slot page. Offered only on an active, unbooked slot that hasn't
  ended.
- **Mark Attended:** offered when the booking is Registered. Saving the
  form gives "Service recorded for <first> <last>", sets the booking to
  Attended and returns to the slot page. **Undo Attendance** asks "Are you
  sure you want to undo attendance for this appointment?" in a browser
  confirm, then "Attendance has been undone and the registrant is now
  Registered. Service record deleted."
- **Cancelling:** "Cancel occurrences" sets the ticked slots to Cancelled.
  "Cancel Session" doesn't cancel slots that are already Active.
- **Emails** (booking confirmation, cancellation, slot cancelled) are sent
  by the external Registration API from its own templates, not by Drupal.

## Mobile

AP-1 runs on desktop and on a phone. AP-2 is tagged `@desktop-only`: the
8-day window is applied on the server, so checking it once on desktop is
enough. Every other case logs in, changes data and is tagged
`@desktop-only`: a phone run would make the same changes again.

## Not covered

- **Already in other smoke plans:** after a reindex, some day in the
  appointment search has a slot and a format filter works: AM-3 in
  [](smoke-admin-maintenance.md). Location pages load: LV-1 in
  [](smoke-public-site.md).
- **Search in depth:** the day strip, week navigation, filters, distance,
  Reset, booking links and what the search leaves out (booked, past,
  cancelled, held slots): [](../appointments/functional-appointments-search.md).
- **Scheduling in depth** (functional-appointments-scheduling, to be
  written): form validation, Draft sessions and slots, recurrence and
  Until, shortening a schedule with bookings, single-slot overrides,
  Reassign Staff Member, delete vs cancel, Cancel Session, and who can
  schedule.
- **Booking in depth** (functional-appointments-booking, to be written):
  the Tier 1 hand-off with "Continue Booking" and the 15-minute hold, the
  full, already booked and reserved messages, partner and staff accounts,
  phone and topic validation, "Other" topics, the success page for other
  users, the printable version.
- **Staff tools in depth** (functional-appointments-attendance, to be
  written): Resend Confirmation, late attendees on ended slots, "Cancel
  Registrations" in bulk, Admin View Registrations, statuses, permissions
  by role.
- **Staff dashboard block.** The checklist expects the appointment on the
  admin or staff dashboard. That block lists only slots whose Staff Member
  is the logged-in user, and the admin account isn't offered as a Staff
  Member at Aitkin, so it stays a manual check until there is a staff
  login that is (see [Open questions](#open-questions)).
- **Emails.** The checklist expects an email when a job seeker books
  (AB-1), when they cancel (AB-2), when an admin cancels a registration
  (AS-1) and when an admin cancels a booked slot. The cancelled-slot email
  must refer to the appointment, not an event
  ([MNDEED-9748](https://portland-webworks.atlassian.net/browse/MNDEED-9748)).
  The Registration API sends them and the tests have no mailbox to read,
  so they stay a manual check until there is one (see
  [Open questions](#open-questions)). For the cancelled-slot email, book
  the job seeker on a test slot before cancelling it.
- **Events:** [](smoke-events.md).

## Open questions

1. **Emails.** Is there a test mailbox the Registration API can send to for
   the job seeker account (for example a Mailpit or a shared inbox the
   tests can read)? If so, the email checks, including MNDEED-9748's
   subject wording, can move into AB-1, AB-2, AS-1 and a booked-slot
   version of AS-3.
2. **Staff dashboard.** Can the admin account be added to the Aitkin
   location group (so it is offered as a Staff Member), or can the team
   provide a staff login that is? Then AA-1 can pick it and check the "My
   Upcoming Events & Appointments" block on its dashboard.
3. **Search indexing.** Are new, booked, cancelled and cancelled-booking
   slots reindexed as soon as they are saved, or only on cron? AA-2, AB-2,
   AS-3 and AA-3 search right after a change.
4. **Service records (AS-2).** Is sending service records to the State's
   activity system switched on for QA or Stage? If it is, AS-2 sends one
   each run, and Undo Attendance may fail when the State's system returns
   an error.
5. **Date of Service.** The Mark Attended form defaults Date of Service to
   today, not the appointment's date, and leaves Staff Member empty
   although the slot has one. Is that intended? AS-2 doesn't check either
   default.
6. **Past appointments page.** `/user/<uid>/past_events_appointments`
   answers 403 for the job seeker; past appointments show in the "Past"
   section of `/user/<uid>/events_appointments`. Is the 403 intended, or
   should that page still work?
7. **Leftover data.** Session S has had bookings, so it can't be deleted;
   AA-3 cancels its slots and the session. Is a cancelled session at
   Aitkin left on QA and Stage each run acceptable?
