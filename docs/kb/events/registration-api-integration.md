# Registration API integration (`registration_api` module)

Event and appointment registrations are not stored in Drupal. They live in a
separate **Event Registration service** (a .NET API backed by MongoDB, run
locally from the `.ddev/event-registration` git submodule). The custom
`registration_api` module is the Drupal client for that service. It pushes
occurrences and service locations to it; reads, creates and changes
registrations; manages the email notification templates the service sends;
and fires audit hooks. Its `.info.yml` description ("Flexible logging,
auditing, and reporting module.") does not describe what it does; the code is
a registration API client.

## What users see

Mostly invisible; it powers every registration screen. Admin pages, all
requiring `administer registration api`:

| Path | Form | Purpose |
|---|---|---|
| `/admin/config/services/registration_api` | `RegistrationApiSettings` | Endpoint (https only), API key identifier, base64 shared secret |
| `/admin/config/services/registration_api/data_sync` | `RegistrationApiDataSync` | "Sync API Service Locations" and "Update API Occurrences" batch buttons |
| `/admin/config/services/registration_api/notifications` | `RegistrationApiNotifications` | List the email templates stored on the API, edit/remove them, add new, "Initialize Templates" |
| `/admin/config/services/registration_api/notifications/add_new_template`, `/{template_id}/edit` | `RegistrationApiTemplateEditor` | Template name, language, subject, HTML body, plain-text body |

## How it works

### Transport and auth

`RegistrationDatasource` extends Datapult's `HttpDatasource`. It sends JSON,
and the base URL comes from `registration_api.settings:endpoint`. Every
request gets these headers:
- `X-Api-Key`: the configured key identifier
- `X-Timestamp`: current Unix time
- `X-Signature`: base64 HMAC-SHA256 of `"<api key>\n<timestamp>"`, keyed with
  the base64-decoded `secret`

Booleans in query strings are sent as `true`/`false`. With `is_debug` set,
TLS verification is turned off.

**Error mapping** (`handleResponse()`): `errorId` 1001 →
`RegisterTargetNotFoundException` (the occurrence/appointment is unknown to
the API); 3001 already registered, 3002 registration ended, 3003 full, 3004
not available, 3005 already reserved → `UserRegisterException` (shown to the
user); other errors, or a response without `success` → `RequestException`.

### Endpoints used

| Plugin id | Method | Path |
|---|---|---|
| `put_occurrence` | POST | `/EventsAppointments` (create/update an event occurrence) |
| `put_appointment` | POST | `/EventsAppointments` (appointments) |
| `get_occurrence` | GET | `/EventsAppointments/{Event\|Appointment}/{id}?includeCanceledEvents=` |
| `get_occurrence_registrations` | GET | `/EventsAppointments/{type}/{id}/registrations?includeCanceledEvents&includeRegistered&includeCanceled&includeWaitlisted` |
| `get_event_occurrence_registrations` | GET | `/EventsAppointments/Event/{id}/registrations` (no caller found) |
| `get_user_registrations` | GET | `/EventsAppointments/user/{uid}/paged?Page&PageSize&fromDate&toDate&sessionType` |
| `cancel_occurrence` | DELETE | `/EventsAppointments/{type}/{id}/cancel` (used by appointments only) |
| `put_event_registration` | POST | `/Registration/register[?isForceRegistration=true\|false]` |
| `put_event_waitlist` | POST | `/Registration/waitlist[?isForceRegistration=…]` |
| `put_appointment_registration` | POST | (appointments) |
| `cancel_attendee_registration` | DELETE | `/Registration/{type}/{id}/user/{uid}/cancel-registration` |
| `put_attendance` | POST | `/Registration/{type}/{id}/user/{uid}/mark-attendance` |
| `update_registration_status_bulk` | POST | `/Registration/{type}/{id}/update-registration-status-bulk` (body: `occurrenceId`, `userIds`, `status`) |
| `post_resend_notification` | POST | `/Notifications/{type}/{id}/user/{uid}/resend-email/{emailType}` (single user) or `/Notifications/{type}/{id}/resend-email/{emailType}` |
| `service_locations_sync` | POST | `/ServiceLocations` |
| `update_occurrence_service_locations` | POST | `/ServiceLocations/{sessionType}/update-occurrences-service-location` |
| `notification_template_*` | GET/POST/DELETE | `Templates/template/...`, `Templates/sync-template-files?replaceIfExist=` |

The code comment in `PutEventRegistration`/`PutEventWaitlist` says the API
reads `isForceRegistration` from the query string only.

### What is sent for an event occurrence (`PutOccurrence::build()`)

`eventId`; `sessionStatus` (draft → `Draft`, published → `Active`, cancelled →
`Canceled`); `sessionType: Event`; `eventTitle` (session label);
`eventDescription` (occurrence description, else catalog item description);
`accommodationPhone`/`bookedPhone` (session `field_phones`);
`serviceLocationId` (session primary location ID); `formatTypes` (`in_person`
→ `InPerson`, `virtual` → `Online`, anything else → `Phone`); `topics`
(catalog item topic labels); `startDateTime`/`endDateTime` (UTC ISO 8601);
`host` (primary location label); `maxRegistrations` (session
`field_seats_available`); `meetingOnlineLink`; `meetingAddtlInformation`;
and the meeting location name, address and phone (alternate location, else
primary).

User details in registration payloads (`buildUserDetails()`): `userId`,
`email`, `firstName` (`best_available_first_name`), `lastName`, `locale`
(`preferred_langcode`).

### When Drupal calls the API

- **Every occurrence insert and update** → `notifyCreated()` → `put_occurrence`.
  Cancelling an occurrence (moderation state `cancelled`) is sent this way, as
  `sessionStatus: Canceled`. The Until-date warning text says registrants
  then get a cancellation email; sending it appears to be the API's job
  (inferred).
- **Register / waitlist / cancel / attend / bulk / resend**: from the
  registration and attendee screens (see the related docs).
- `register()` retries once after creating the occurrence when the API
  returns 1001.
- **Status checks**: `getRegistrationsByIdAndType()` fetches all statuses for
  an occurrence once per request and groups them as
  `[status][userId] => record` (plus a raw `list`). `hasRegistration()`,
  `hasRegistrationAny()`, `isUserRegistered()`, `userHasReservation()`,
  `isUserOnWaitlist()` and `isRegistrationFull()` all use this. Note: the
  cache array is keyed `[$entityId][$entityId]`, without the entity type, so
  an event and an appointment with the same ID could share a cached result
  within one request (inferred risk).
- **CiviServ location insert/update** → `service_locations_sync` (published
  `careerforce_location` and `statewide_or_virtual` only).
- **Data Sync page**: batches that push all locations, and that update every
  event and appointment occurrence with its service location ID (for data
  created before the location ID was sent).

### Notification templates

Template names are prefixed `DEED-CareerForce-CFMN-`
(`RegistrationApiTemplateUtility::NOTIF_TEMPLATE_PREFIX`). Known types:
`registration-confirmed`, `registration-canceled`, `waitlisted`, `canceled`,
`reminder`, `updated`. Valid names come from the API
(`notification_template_valid_names`). "Initialize Templates" calls
`Templates/sync-template-files`. The email bodies are stored and sent by the
API, not by Drupal.

### Audit

`auditLogEvent()` calls `invokeAll('<action>', [entity, user])`, but only when
the optional `Drupal\stenographer\RecorderManagerInterface` service exists.
`registration_api.stenographer.yml` maps these hooks to records: activity
`registration_api_events_registration` (`event_register`, `event_waitlist`,
`event_cancel`, `event_mark_attendance`) and audit
`registration_api_events_occurrence` (`event_occurrence_cancel`, invoked from
`cf_happenings` `EntityHooks`). Storage targets are named `cloudwatch`
(`stenographer_cloudwatch`) and `azure` (`pww_auditor`). Appointment
equivalents exist too.

## External services and integrations

- Event Registration API (HTTP/JSON). Config keys:
  `registration_api.settings:endpoint` (scheme/host/port/path), `api_key`,
  `secret`, `is_debug`.
- On AWS (`web/sites/default/settings.aws.php`) the endpoint (host, port,
  ssl → scheme, path `api`) and the credentials are loaded from the SSM
  parameter `{SSMParamPrefix}/eventReg/endpoint`. `config/sync` holds
  local-development defaults that point at the DDEV `registration-api`
  container (`https://registration-api:5225/api`).
- Local: `.ddev/docker-compose.eventreg.yml` builds the API from the
  `.ddev/event-registration` submodule (`bitbucket.org/portlandwebworks/eventregistration`)
  with MongoDB `EventRegistrationDB`.
- Contrib `drupal/datapult` (HTTP datasource and request plugin base) and
  `drupal/toolshed`, both from `composer.json`.

## Configuration and permissions

- Permission: `administer registration api` (restricted).
- `RegistrationApiSettings` does not render `is_debug`; set it in config or
  settings.php.
- No config split overrides for `registration_api.settings`; environment
  values come from `settings.aws.php`.

## Related

- [event-registration-and-waitlist.md](event-registration-and-waitlist.md)
- [event-attendee-management.md](event-attendee-management.md)
- [occurrence-generation-and-recurrence.md](occurrence-generation-and-recurrence.md)
- ../appointments/ (`AppointmentRegistrationService`, appointment request plugins)
- ../platform-and-operations/ (Stenographer audit logging, SSM parameters, DDEV)
