# [Smoke] - External Events - Test Plan

Status: implemented
Implemented test: tests/smoke/external-events/visitor.spec.ts, tests/smoke/external-events/submit-and-review.spec.ts

## Overview

A quick check after each deploy that the external events flow still works,
one pass each: what a visitor sees ("Submit an Event" form, the link to it,
an external event's page), an employer submitting an event, and an admin
reviewing it, publishing it and seeing it on the Events search and its own
page.

The visitor cases (XV) only read, so they run on QA, Stage and Production.
The submission and review cases (XS, XA) create and publish an event, so
they run on QA and Stage only.

The cases come from the external events notes in
[](../events/functional-events-search-detail.md) (EX cases) and
[](../events/functional-events-scheduling.md) ("Add External Sessions",
External Events, Webform Submissions). The in-depth version is
functional-events-external-submissions (Events part 5, not written yet).

## Login

| **XV and XS cases** | Visitor, not logged in |
|---|---|
| **XA cases** | Admin role |
| **Events search and event page checks in XA cases** | Visitor, not logged in |

## Test cases

XV-1 to XV-3 are in `visitor.spec.ts`. XS-1 and XA-1 to XA-4 are in
`submit-and-review.spec.ts`: they share the submission and its external
event, so they run in order with one worker. XA-4 deletes them, and if an
earlier case fails, the same deletion runs after the last case.

| ID | Test | Page | Steps | Expected result | Required login | Prod |
|---|---|---|---|---|---|---|
| XV-1 | "Submit an Event" form loads | `/form/external-event` | Open the page as a visitor. | 1. The h1 is "Submit an Event", with a "Back to Events list" link to `/education-and-training/events` and the text "All submitted events will be reviewed by a staff member before appearing on the calendar." 2. "Event Information" has Event Name, Hosted By, Date (today by default), Start Time, End Time, Event Type (offering "Job Club" and "Job Fair or Networking Event"), Description, Link to Event Information, Accommodation Phone Number, and Format with "In Person" and "Online". 3. "Submitter Details" has Submitter Name and Submitter Email. 4. A CAPTCHA and a "Submit" button show, and no error message. | | Yes |
| XV-2 | "Submit event" link leads to the form | `/education-and-training/events` | 1. Open the page as a visitor. 2. Click the visible "Submit event" link. | 1. A visible "For Employers" heading with "Do you have an upcoming job fair or networking event? Submit your event to be posted directly on our events page." and a "Submit event" link. 2. `/form/external-event` opens with the h1 "Submit an Event". | | Yes |
| XV-3 | An external event's page loads | the first card on the Events search (also `?fy[784]=784`) that links to `/events/external/…` or `/events/event-external/<id>`, else `/events/event-external/1` | Open the page as a visitor; skipped with a reason if neither opens an external event. | 1. The address is `/events/external/<label>` (an `/events/event-external/<id>` address redirects there). 2. The h1 is the event's name followed by its date ("<Weekday>, <Month> <D>, <YYYY>"). 3. DATE, TIME, LOCATION and OFFERED BY show with values, and a "Learn more" link goes to another site in a new tab. 4. There is no "Log In or Create Account" button and no registration message. | | Yes |
| XS-1 | Visitor submits an event | `/form/external-event` | Don't log in. 1. Fill in "Event Information" as in [Test data](#test-data) and tick "In Person". 2. Fill in the address and "Submitter Details", tick "I'm not a robot" and click "Submit". 3. Read the submitter's Mailinator inbox. **Cleanup:** XA-4. | 1. The "In Person" fieldset shows Street Address Line 1, City, State (with "Minnesota" chosen) and ZIP Code. 2. The confirmation page `/form/external-event/confirmation` shows "New submission added to Submit an Event.", with no error message. 3. Within 2 minutes, one email with the subject "CareerForce event submission confirmation" arrives; its body thanks the submitter for requesting to have the event, with the event's name, posted on CareerForce.MN.gov, says it will be reviewed within 1-2 business days, and gives 651-259-7500 and careerforce@state.mn.us. | | No: creates a submission that staff review |
| XA-1 | The submission waits for review | `/admin/content/events/webform-submissions` | Use the submission from XS-1. 1. Search for its name and apply the filter. 2. Open the row's operations. 3. As a visitor, open the Events page searched for the name (`?fq=<name>`). **Cleanup:** XA-4. | 1. One row: Event Date & Time "<D+7 as MM/DD/YYYY> - 10:00 AM - 11:00 AM", the name, Host "Playwright Test Host", Submitter Email `playwright-ext-<timestamp>@mailinator.com`, Status "Pending Review". 2. The operations include "View Submission" and "Draft an external event". 3. No card has the name. | `admin` | No: reads test data that only exists on QA and Stage |
| XA-2 | Draft an external event from the submission | `/admin/content/events/webform-submissions` | 1. Click "Draft an external event" on the row. 2. Leave "Save as" at Draft and click "Save". 3. Open `/admin/content/events/external-session?n=<name>`. 4. Search Webform Submissions for the name again. 5. As a visitor, open the Events page searched for the name. **Cleanup:** XA-4. | 1. "Add external session" opens with the Webform Submission field showing the submission, and Event Name, Hosted by, Event Type, Description, Date, Start time, End time, Link to Event Information, the phone number, In Person, the address, Submitter Name and Submitter Email filled in with the XS-1 values; "Save as" is Draft. 2. A status message confirms the save, with no error message. 3. The event is listed once with Status "Draft", Host "Playwright Test Host" and Submitter Email `playwright-ext-<timestamp>@mailinator.com`, and its operations include "View Event" and "View Submission". 4. The submission's Status is "Draft". 5. No card has the name. | `admin` | No: creates an external event |
| XA-3 | Publish the external event | `/admin/content/events/external-session?n=<name>` | 1. Edit the event, set its moderation state to Active and click "Save". 2. Search Webform Submissions for the name. 3. As a visitor, open the Events page searched for the name. 4. Open the card. 5. Read the submitter's Mailinator inbox. **Cleanup:** XA-4. | 1. A status message confirms the save, and the External Events list shows the event with Status "Active". 2. The submission's Status is "Accepted". 3. Within a minute, one card has the name, linking to `/events/external/<label>`, with the date D+7, "10:00 AM to 11:00 AM", the location "Saint Paul, MN" and the tags "In Person" and "Job Fair or Networking Event". 4. The h1 is the name followed by D+7's date; TIME is "10:00 AM - 11:00 AM", LOCATION has "100 Test Street" and "Saint Paul, MN 55101", OFFERED BY is "Playwright Test Host", ACCOMMODATION PHONE NUMBER is "555-555-0100", "Learn more" goes to `https://example.com` in a new tab, and there is no "Log In or Create Account". 5. Within 2 minutes, one email with the subject "Your event has been approved on CareerForce.MN.gov" arrives; its body says the request has been approved and the event is currently displayed, and the event's name links to the event's page on the environment under test (`/events/external/<label>`). | `admin` | No: publishes an event visitors can see |
| XA-4 | Delete the test event and submission | `/admin/content/events/external-session?n=<name>` | Runs last; each step is skipped when there is nothing with the name to delete. 1. Click "Delete" on the event and confirm. 2. Search Webform Submissions for the name, click "Delete" on the submission and confirm. 3. As a visitor, open the event's page address and the Events page searched for the name. | 1. A status message confirms the deletion, and External Events lists no event with the name. 2. A status message confirms the deletion, and Webform Submissions lists no submission with the name. 3. The page answers 404 "Page Not Found", and no card has the name. | `admin` | No: deletes test data |

## Test data

Synthetic. D is today in America/Chicago. The submission (XS-1), and the
external event drafted from it (XA-2), use:

- **Event Information:** Event Name `Playwright test <timestamp>`, Hosted By
  `Playwright Test Host`, Date D+7, Start Time `10:00 AM`, End Time
  `11:00 AM`, Event Type "Job Fair or Networking Event", Description
  `Synthetic event created by an automated smoke test.`, Link to Event
  Information `https://example.com`, Accommodation Phone Number
  `555-555-0100`, Format "In Person" only.
- **In Person address:** Street Address Line 1 `100 Test Street`, City
  `Saint Paul`, State "Minnesota", ZIP Code `55101`.
- **Submitter Details:** Submitter Name `Playwright Test`, Submitter Email
  `playwright-ext-<timestamp>@mailinator.com`, a new public Mailinator inbox
  for each run so emails from other runs never match. Like the team's other
  test accounts, it is a public inbox anyone can read, so the data stays
  synthetic.
- **Reading the inbox:** the test polls Mailinator's public API,
  `GET https://www.mailinator.com/api/v2/domains/public/inboxes/playwright-ext-<timestamp>`
  (no token; it answers `{"msgs":[…],"domain":"public","to":…}`), with
  Playwright's `request`, not a browser, every 5 seconds for up to 2
  minutes, then opens the message by its ID to read the body. Mailinator
  rate-limits public inboxes (429), so the helper waits and retries.
  Checked on QA on 2026-11-17: both emails arrived within the 2 minutes.
- **The event's page address** is `/events/external/playwright-test-<timestamp>`
  (the alias pattern is `/events/external/[label]`); the test reads it from
  the "View Event" operation rather than building it.
- **Cleanup:** XA-4 deletes the external event and the submission. When an
  earlier case fails, the tests delete whatever has the name after the last
  case, so nothing is left behind.

## Good to know

Checked on QA as a visitor and as `admin` on 2026-11-16, without saving
anything. The review workflow and the emails are from the mn-careerforce
source (`config/sync/webform.webform.external_event.yml`,
`cf_external_events`, `cf_views_bulk_operations`).

- **The admin can review everything:** on QA it is a System Administrator,
  so it can view, draft, publish and delete external event submissions and
  external events.
- **CAPTCHA on QA and Stage:** the team is moving QA and Stage to Google's
  reCAPTCHA test keys, so ticking "I'm not a robot" always passes with no
  image challenge (Google shows a "for testing purposes only" note in the
  widget). On 2026-11-17 QA still served the site key `6LdjClsU…`, not
  Google's test key (`6LeIxAcTAAAA…`). Production keeps its real key.

### What a visitor sees

- **Events page** `/education-and-training/events`: "Showing 1-15 of 57";
  no external event cards on page 1. An h2 "For Employers" with "Do you
  have an upcoming job fair or networking event? Submit your event to be
  posted directly on our events page." and a "Submit event" link to
  `/form/external-event`. The block is in the page twice
  (`careerforce_skin_eventswebformcta` and `..._mobile`); only one is
  visible at a time.
- **"Submit an Event"** `/form/external-event` (h1 "Submit an Event"): a
  "Back to Events list" link to `/education-and-training/events`, then
  "Fill out this form to add your job fair or networking event to our
  calendar. All submitted events will be reviewed by a staff member before
  appearing on the calendar. …" with links "CareerForce location" and
  "Employer Engagement Specialist".
  - Fieldset "Event Information": Event Name, Hosted By, Date (a date input,
    default today, min today, max today + 60 days), Start Time and End Time
    (text inputs with a time picker), Event Type (a select: "- Select -",
    "Job Club", "Job Fair or Networking Event"), Description (a CKEditor 5
    editor), Link to Event Information (hint "This must be an external URL
    such as https://example.com."), Accommodation Phone Number (hint "Enter
    10 digit phone number, example: 555-555-5555"), Format (checkboxes "In
    Person", "Online").
  - Fieldset "In Person" (Street Address Line 1 and 2, City, State with
    Minnesota preselected, ZIP Code) is hidden until "In Person" is ticked.
  - Fieldset "Submitter Details": Submitter Name, Submitter Email (hint
    "Work email preferred.").
  - A "CAPTCHA" group with Google reCAPTCHA ("I'm not a robot"), then
    "Submit".
- **External event page:** `/events/event-external/1` redirects to
  `/events/external/external-event`, h1 "External Event Wednesday,
  September 16, 2026" (past). Tags "IN PERSON JOB CLUB CAREER EXPLORATION
  NETWORKING", the description, "Learn more" to `https://example.com`
  (`target="_blank"`, `rel="noreferrer"`), DATE, TIME "10:00 PM - 10:15
  PM", LOCATION (an address in Saint Paul, MN 55109, with a Google map),
  OFFERED BY "Me", ACCOMMODATION PHONE NUMBER "555-555-5555", and "Similar
  Events" (4 occurrence cards). No login prompt.

### What the admin sees

- **The form as admin** shows no CAPTCHA (the admin skips it) and no
  Workflow or External Event field.
- **Webform Submissions** `/admin/content/events/webform-submissions` (h1
  "Externally Submitted"; tabs Catalog Items, Sessions, Occurrences,
  External Events, Webform Submissions): filters Search (`combine`, "Search
  by event name or host."), Status (`webform_submission_value_5`: Draft,
  Pending Review, Accepted, Declined, Marked Spam), Submitter Email, Event
  Date From, Event Date To. Columns Event Date & Time ("10/05/2026 - 10:00
  AM - 11:30 AM"), Event Name, Host, Submitter Email, Submitted Date & Time,
  Status, Operations. Bulk actions "Create Draft", "Decline Submission",
  "Mark Spam", "Delete selected entities / translations". QA had 1
  submission ("Test Company Hiring Event", Pending Review).
- **A Pending Review submission's operations:** "View Submission"
  (`/admin/structure/webform/manage/external_event/submission/<sid>`), Edit,
  "Draft an external event"
  (`/events/event-external/add?field_webform_submission=<sid>`), Notes,
  Resend, Delete (`…/submission/<sid>/delete`), "Workflow: Declined",
  "Workflow: Marked Spam". The submission page shows every field, "External
  Event {Empty}", "Workflow Pending Review" and a "Transition?" select
  (Declined, Marked Spam).
- **"Draft an external event"** opens "Add external session", prefilled
  from the submission: Webform Submission (disabled, the submission's
  label), Event Name, Hosted by, Event Type, Event Topics checkboxes,
  Description, Date, Start time and End time (15-minute selects), Link to
  Event Information, the phone number (labelled "Accomodation Phone
  Number"), Event Format, Address (Street Address Line 1 and 2, City,
  State, ZIP Code), Submitter Name, Submitter Email, "Save as" (Draft,
  Active, Cancelled; default Draft), Revision log message, URL alias
  (automatic), Authoring information, and "Save".
- **External Events** `/admin/content/events/external-session` (h1
  "External Events"): "Add external session" (`/events/event-external/add`);
  filters Event Name (`n`), Hosted by (`h`), Status (`s`: Draft, Active,
  Cancelled), Submitter Email (`e`), Event Date From (`df`), Event Date To
  (`dt`); columns Created on, Event Date & Time, Event Name, Host, Status,
  Submitter Email, Operations; bulk actions "Modify field values" and
  "Delete external session". The one event (`External Event`, Active) had
  "View Event", Edit (`/events/external/<label>/edit`) and Delete
  (`/events/external/<label>/delete`).

### From the app source

- **After Submit:** the confirmation page `/form/external-event/confirmation`
  with the webform default "New submission added to Submit an Event." and
  "Back to form". A handler emails the submitter (`submitter_email`)
  "CareerForce event submission confirmation": "Thank you for requesting to
  have your event, **<event name>**, posted on CareerForce.MN.gov. We will
  review your request within 1-2 business days and contact you if we need
  additional information." and the Information and Assistance contacts
  651-259-7500 and careerforce@state.mn.us.
- **Approval email:** on the workflow transition to Accepted, a handler
  emails the submitter "Your event has been approved on
  CareerForce.MN.gov": "Your request to have your event posted on
  CareerForce.MN.gov has been approved. Your event, **<event name>**, is
  currently displayed.", where the name links to the event's absolute URL,
  then "Need to update your event listing? …" and a link to
  `https://careerforce.mn.gov/post-a-job`.
- **Review workflow** (webform workflow "External Event Submissions"): a
  new submission is Pending Review. Saving an external event drafted from
  it (the "Draft an external event" operation, which passes
  `field_webform_submission=<sid>`) links the two both ways and moves the
  submission to Draft; the bulk "Create Draft" builds the external event
  itself and redirects to External Events. Publishing the external event
  (moderation state Active) moves the submission to Accepted and emails
  the submitter. The external event's moderation states are Draft
  (unpublished), Active (published) and Cancelled (unpublished).
- **Operations:** a submission linked to an event gets "View Event"; an
  external event drafted from a submission gets "View Submission".
- **Search:** external events are in the Search API index
  `general_site_content`, which indexes items as soon as they are saved
  (`index_directly: true`); unpublished items are left out.
- **Deleting** a submission doesn't delete its external event (nothing
  implements the delete hook), so cleanup deletes both.

## Mobile

XV-1 to XV-3 run on desktop and on a phone. XS-1 and the XA cases submit or
review an event, so they are tagged `@desktop-only` (and `@no-prod`): a
phone run would make the same changes again.

## Not covered

- **External event cards on the Events search and the 45-day window:** EP-1
  in [](smoke-events.md). External event cards, their page, and external
  events not being limited to 45 days, in depth: EX-1 to EX-4 in
  [](../events/functional-events-search-detail.md).
- **In depth, in functional-events-external-submissions** (Events part 5,
  to be written):
  - The form's validation: each required field, the phone pattern ("Please
    enter a phone number formatted as: 555-555-5555"), the ZIP pattern
    ("Please enter a valid 5 digit zip code."), "End time must be after
    start time.", the Date limits (today to today + 60 days), the Start and
    End Time limits (5:00 AM to 11:00 PM, 15-minute steps), and "The
    selected event type is not allowed."
  - An Online-only submission (no address), and an event with both
    formats.
  - Decline, Mark Spam and back to Pending Review; the bulk "Create Draft"
    action; saving straight as Active; cancelling an Active external event;
    editing a published event.
  - Which roles can see and review submissions (Event Manager, Job Services
    Administrator, Site Admin, System Admin) and which can delete them.
  - External events in Similar Events, distance sorting, and external
    events more than 45 days ahead (EX-3).
- **Other emails.** The tests check only the confirmation (XS-1) and
  approval (XA-3) emails; the full wording, and the emails a declined or
  spam submission gets, are for part 5. Mailinator is a stand-in until the
  team has its own test mailbox.
- **The external event page on a phone beyond XV-3, and accessibility:**
  [](../events/functional-events-search-detail.md) and part 5.

## Open questions

1. **XV-3 on Production.** No external event showed in the Events search on
   QA, so XV-3 falls back to `/events/event-external/1`, which only QA is
   known to have. Is there an external event on Stage and Production the
   test can rely on, or should XV-3 skip there when the search has none?
