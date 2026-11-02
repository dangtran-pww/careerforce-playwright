# Events and event registration

Knowledge-base docs for CareerForce's custom events code (source: `master`
at commit `db37480b7`). Modules covered: `happenings`, `cf_happenings`,
`rrule`, `registration_api`, `cf_external_events`, `printable_calendar`,
`hotline_group`, and the Events & Appointments print blocks in `careerforce`.

| Doc | What it covers |
|---|---|
| [event-content-model.md](event-content-model.md) | Catalog items, sessions, occurrences: fields, workflows, labels, session-to-occurrence field overrides, location-based access, scheduling from a location |
| [occurrence-generation-and-recurrence.md](occurrence-generation-and-recurrence.md) | The `rrule` field/widget and the Occurrence Manager: queues, cron, generation limits, Until-date cancellation and warning, date preview |
| [event-search-and-detail-pages.md](event-search-and-detail-pages.md) | Public Events search (`/education-and-training/events`), occurrence detail page blocks, proximity and "more like this" plumbing |
| [event-registration-and-waitlist.md](event-registration-and-waitlist.md) | Job seeker reserve → confirm flow, Tier 2 profile gating, veteran waitlist, cancel, status messages, page redirects |
| [event-attendee-management.md](event-attendee-management.md) | Staff Attendees tab: add attendee or waitlist, mark attended (service records), cancel, undo, resend, bulk actions |
| [registration-api-integration.md](registration-api-integration.md) | `registration_api`: the external Event Registration service client, auth, endpoints, sync triggers, notification templates, audit, environment config |
| [my-events-dashboard-and-printing.md](my-events-dashboard-and-printing.md) | My Events & Appointments dashboard (events side), print page and button, legacy `printable_calendar` module |
| [external-event-submissions.md](external-event-submissions.md) | "Submit an Event" webform, review workflow, turning submissions into External Session entities |

Related areas: ../appointments/ (appointments share the
Occurrence Manager, `rrule` and `registration_api`),
../accounts/, ../locations/ (groups, CiviServ locations, profile tiers),
../content-authoring/, ../miscellaneous/theme-overview.md, ../platform-and-operations/.
