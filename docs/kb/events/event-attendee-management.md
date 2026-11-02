# Event attendee management (staff)

Staff and partners who run an event use the **Attendees** tab on an
occurrence to see who registered, add job seekers or put them on the
waitlist, mark attendance (which creates a service record), cancel or restore
registrations, and resend confirmation emails. The list is read live from the
Registration API; Drupal keeps no local copy.

## What users see

- **Attendees tab**: `/events/event-occurrence/{id}/attendees` (route
  `cf_happenings.event_occurrence_attendees`, local task on the occurrence
  page). Page title `<occurrence label> - Attendees`; "Displaying X-Y of Z";
  "+ Add Attendee" (disabled with "No seats available" when full) and
  "+ Add to Waitlist" (disabled with "Seats are available, waitlist not open"
  when not full).
- **Filters** (`EventAttendeesFilterForm`, query keys `search`, `status`,
  `format`) and sortable columns: Email, First Name, Last Name, Status,
  Format, Date Registered (default sort: date registered, descending). Page
  size: `cf_happenings.settings:happenings_attendence.page_size` (100).
- **Row operations** depend on status:

  | Status | Operations |
  |---|---|
  | Waitlisted | Mark Registered, Mark Canceled (JS confirm) |
  | Registered | Mark Attended, Mark Canceled (JS confirm), Resend Confirmation (only for future, non-cancelled occurrences) |
  | Canceled | Mark Registered (opens Add Attendee prefilled with the user) |
  | Attended | Record Additional Service, Undo Attendance (JS confirm) |

- **Bulk action** (select rows): "Mark Attended" (only Registered rows) or
  "Mark Canceled" (Registered or Waitlisted rows).
- **Add Attendee / Add to Waitlist** forms:
  `/events/event-occurrence/{id}/attendees/add-attendee` and `/add-waitlist`.
  Fields: a user autocomplete ("First name, last name, or email") and a
  required Format radio built from the occurrence's formats.

## How it works

- `attendeesTab()` calls `OccurrenceRegistrationService::getRegistrations()`
  and uses the raw `list` of records (`userId`, `status`, `formatTypes`,
  `registeredDateTime`). It loads each Drupal user for email and first/last
  name, then filters, sorts and pages **in PHP**. "Full" on this page means
  non-Canceled records >= `field_seats_available`; this is a simpler count
  than the job-seeker check.
- Single-row actions go to
  `/events/event-occurrence/{id}/attendee/{user_id}/{operation}` (a GET link),
  run the API call, invalidate `happenings_registrant_count:<id>`, set a
  message and redirect back to the Attendees tab:
  - `register`: `register(isReservation: FALSE, formatTypes: [format])`.
  - `cancel`: `cancelAttendeeRegistration()`.
  - `attend`: `markAttendance()`, then
    `ServiceRecordHelper::createServiceRecord($occurrence, $uid, $formatType)`
    ("Attendance marked successfully. Service record created.").
  - `registration-confirmed`: `resendRegistrationConfirmationEmail()`.
  - `undo-attendance`: delete the oldest `service_record` with
    `field_activity_type = event` and `field_event_occurrence = <id>` for that
    user, then `updateRegistrationStatusBulk([...], 'Registered')`.
- Bulk "Mark Attended" calls `updateRegistrationStatusBulk(..., 'Attended')`
  once, then runs a batch (`batchMarkAttendedPostProcess`) that creates one
  service record per user. Bulk "Mark Canceled" calls
  `updateRegistrationStatusBulk(..., 'Canceled')`.
- Add Attendee: `register()` with `isReservation: FALSE`. Add to Waitlist:
  `doWaitlist()`. Both pass `isForceRegistration` from
  `OccurrenceManager::getForceRegistrationValue()`. It is TRUE only when the
  occurrence has already ended **and** less than
  `occurrence_updates.add_attendee_window_in_days` (30) days have passed. The
  code comment says the API "may ignore ForceRegistration in some cases such
  as waitlist". The waitlist autocomplete only offers Tier 2 veterans; the
  attendee autocomplete offers Tier 2 users.
- "Record Additional Service" links to
  `/group/{group}/location/{civiserv_location}/events/{occurrence}/attendees/{user}/add-service-record`
  (service record add form) when group and location are known, otherwise to
  the generic `entity.service_record.add_form`.

## External services and integrations

Registration API: `GET /EventsAppointments/Event/{id}/registrations`, `POST
/Registration/register`, `POST /Registration/waitlist`, `DELETE
.../cancel-registration`, `POST .../mark-attendance`, `.../update-registration-status-bulk`,
`POST /Notifications/Event/{id}/user/{uid}/resend-email/registration-confirmed`.
Audit hooks fire for register, cancel, waitlist and mark-attendance (see
[registration-api-integration.md](registration-api-integration.md)). Service
records come from `cf_service` (see ../services/).

## Configuration and permissions

- Attendees tab: `_cf_location_assignment_check: 'access happenings_occurrence attendees overview'`.
  The check uses the occurrence's location (option `_cf_location_context`
  from `OccurrenceLocation`). The routing comment says this is deliberately
  the location check only, because "JSAs are not given the site-level
  permission". Group permissions: `access happenings_occurrence attendees overview`
  and `... for assigned locations`.
- Add Attendee, Add to Waitlist and the operation route only require
  `view happenings_catalog_item`. No other access check was found on these
  routes or in their controller/form code.
- "Record Additional Service" route: `create service_record` plus the
  location check.
- Page size: `/admin/config/careerforce/cf_happenings`.

## Related

- [event-registration-and-waitlist.md](event-registration-and-waitlist.md)
- [registration-api-integration.md](registration-api-integration.md)
- [occurrence-generation-and-recurrence.md](occurrence-generation-and-recurrence.md) (add-attendee window setting)
- ../appointments/, ../services/ (service records; the appointments attendee screens are similar)
- ../locations/ (location assignment access check, Tier 2 user selection)
