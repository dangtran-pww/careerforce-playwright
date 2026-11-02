# My Events & Appointments dashboard and printing

Job seekers see their upcoming and past event registrations (and
appointments) on a **My Events & Appointments** tab of their account. Staff
with the right permission can open the same tab for any job seeker. A
print-friendly version of the page exists, and staff and partners have a
separate "Past Events & Appointments" page. This doc covers the event side and
the print feature. Appointment rows are documented in
../appointments/. The older `printable_calendar` module is also
covered here; no view in `config/sync` uses it.

## What users see

| Path | Page Manager page | Who |
|---|---|---|
| `/user/{user}/events_appointments` | `my_events_appointments` ("My Events & Appointments") | The job seeker; staff with `cf_happenings.view_any_my_events_appointments` (tab title becomes "Events and Appointments" when viewing someone else) |
| `/user/{user}/events_appointments/print` | `print_my_events_appointments` | Same access as above |
| `/user/{user}/past_events_appointments` | `past_events_appointments` ("Past Events & Appointments") | Users whose profile type is `staff` or `partner`, with `view past events appointments` (or viewing their own account) |

The dashboard layout (`page_manager.page_variant.my_events_appointments-layout_builder-0.yml`):
customer-support header blocks; **View printable version** link (block
`events_appts_view_print_link`); "Upcoming Events" (`views_block:user_registered_occurrences-block_user_registered_occurrences`);
"Upcoming Appointments"; "Past Events"
(`...-block_user_registered_occurrences_past`); "Past Appointments".

The print page uses the `_print` / `_past_print` displays of the same views
and a **Print** button (block `events_appts_print_button`) that calls
`window.print()`.

## How it works

- **Access.** `my_events_appointments` and the print page require the
  `authenticated` role **and** `UserEventsAppointmentsAccessCondition`. The
  condition requires the viewed user's `field_extended_profile_type` to be
  `career_seeker`, and the viewer to be that user or to hold
  `cf_happenings.view_any_my_events_appointments`.
- **Listing.** `UserRegisteredOccurrences::query()` calls
  `OccurrenceRegistrationService::getOccurrenceRegistrationDetailsByUser()`
  (`GET /EventsAppointments/user/{uid}/paged`, `sessionType=Event`). Upcoming
  uses `fromDate = now`, past uses `toDate = now`. It passes the Views page
  number + 1 and a fixed page size of 10
  (`REGISTRATIONS_PAGE_SIZE`). It can filter by status (Attended, Reserved,
  Registered, Waitlisted, Canceled, Expired) and adds
  `happenings_occurrence.id IN (...)` to the SQL query. Status and chosen
  format are passed to the field plugins through `$view->build_info`. The
  result is `max-age 0`.
- **Location column.** For hybrid events the "Online" or location label
  depends on the format the user picked (`OccurrenceResolvedDashboardLocation`).
- **Printing.** The print page is a normal Page Manager page with print
  displays; the button only calls `window.print()`. No PDF is generated.
- **`printable_calendar` (legacy).** Provides a `printable_page` Views
  display, a `printable_list` style, an `html__printable_page` template
  suggestion, and preprocess code that moves "printable version" feed-icon
  links into their own variable on a display named `page_1`. Its helpers load
  **nodes** (`_printable_calendar_get_node_from_result_row_or_view()`), which
  suggests it was built when events were nodes (inferred). The module is
  enabled (`core.extension.yml`), but no `printable_page` display or
  `printable_list` style is used anywhere in `config/sync`.

## External services and integrations

Registration API `get_user_registrations` (see
[registration-api-integration.md](registration-api-integration.md)).

## Configuration and permissions

- `cf_happenings.view_own_my_events_appointments` is defined, but the access
  condition does not check it; the condition only checks profile type and
  ownership or "view any".
- `cf_happenings.view_any_my_events_appointments`: staff access to other
  users' dashboards.
- `view past events appointments`: the staff/partner past page.
- Cancel-registration redirect target:
  `cf_happenings.settings:happenings_occurrence.cancel_registration.redirect_route`
  points to this dashboard.

## Related

- [event-registration-and-waitlist.md](event-registration-and-waitlist.md)
- [registration-api-integration.md](registration-api-integration.md)
- ../appointments/ (appointment blocks on the same pages)
- ../accounts/ (profile types, customer support header blocks)
