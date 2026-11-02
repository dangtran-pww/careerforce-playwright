# Event content model (catalog items, sessions, occurrences)

CareerForce events are built from three custom content entity types in the
generic `happenings` module, specialised by `cf_happenings`: a **Catalog Item**
(the reusable "what": name, description, topics, types, services), a
**Session** (the "where and when": a catalog item scheduled at one CareerForce
location with a recurrence rule), and **Occurrences** (one entity per dated
instance of a session, which is what job seekers view and register for). A
fourth type, the **External Session**, holds events run by outside
organisations (see [external-event-submissions.md](external-event-submissions.md)).
Staff and location admins author this content; job seekers only see
occurrences and external sessions.

## What users see

| Who | Path | What |
|---|---|---|
| Admins | `/admin/content/events` | "Manage Events" overview (route `happenings.admin_content_events`) |
| Admins | `/admin/content/events/event-catalog-item` | Catalog item list (view `happenings_catalog_items`) |
| Admins | `/admin/content/add/event-catalog-item` | Add catalog item. The entity's own `/events/event-catalog-item/add` path is moved here by `cf_happenings` `RouteSubscriber` |
| Admins | `/admin/content/events/event-session` | Session list (view `happenings_sessions`, display `page_admin_event_sessions`) |
| Admins | `/admin/content/events/event-occurrence` | Occurrence list (view `happenings_occurrence`) |
| Location staff | `/group/{group}/location/{civiserv_location}/event-scheduler` | Catalog items that can be scheduled at this location, each with a "Schedule" link (view `happenings_catalog_items`) |
| Location staff | `/group/{group}/location/{civiserv_location}/event-scheduler/{catalog_item}/schedule` | Session add form with the location pre-filled and locked (route `cf_happenings.session.add_form`) |
| Location staff | `/group/{group}/location/{civiserv_location}/location-events` | Sessions for one location (view `happenings_sessions`) |
| Admins | `/happenings/catalog-item/{id}/schedule` | Generic session add form without a location (route `happenings.session.add_form`) |
| Public | `/events/event-occurrence/{id}` | Occurrence detail page (canonical). Alias: `<session alias>/<occurrence id>` |
| Public | `/events/event-session/{id}` | Session page. Alias: `<location URL>/location-events/<label>/<session id>` |
| Admins | `/events/event-catalog-item/{id}` | Catalog item page. Alias: `/admin/content/event-catalog-item/<label>` |

Structure/settings pages (Field UI bases): `/admin/structure/events/event-catalog-item`,
`/admin/structure/events/event-session`, `/admin/structure/events/event-occurrence`.

## How it works

### Data model

```
happenings_catalog_item  (label, description, field_event_types, field_event_topics,
   ▲                      field_event_sponsors, field_event_services)
   │ catalog_item
happenings_session       (field_locations_primary, field_locations_alternate, field_rrule,
   ▲                      field_event_format, field_seats_available, field_phones,
   │ hsid                 field_private, field_urls_video, field_facilitators, ...)
happenings_occurrence    (timestamp_start, timestamp_end, fields_with_overridden_values,
                          + the same config fields as the session)
```

All four types are revisionable and translatable (`translatable: TRUE`).
Sessions and occurrences use the content moderation workflow `session`
(`config/sync/workflows.workflow.session.yml`) with states `draft`,
`published` (labelled "Active") and `cancelled`.

**Labels.** `CfHappeningsSession::label()` returns the catalog item's label
(translated), not the stored `label` field. `CfHappeningsOccurrence::label()`
returns `<session label> <l, F j, Y>`. The stored label is still set on
creation (`HappeningsEntityHooks::happenings_session_prepare_form()` and
`OccurrenceManager::defaultTitleForOccurrence()`). Tokens
`[happenings_session:entity-label]` and `[happenings_occurrence:entity-label]`
(from `TokenHooks`) expose the computed labels.

**Inheritance and overrides.** On every save, `Occurrence::preSave()` copies
each "overrideable" field from the session onto the occurrence, unless the
field is listed in the occurrence's `fields_with_overridden_values` (a JSON
array). Overrideable fields are `description`, `moderation_state`, and every
config field that exists on both the session and the occurrence. On the
occurrence edit form, `OccurrenceOverrideForm` adds an "Override <field>"
checkbox per field. Only fields selected in
`cf_happenings.settings:fields.overridden_fields` get a checkbox; the rest are
disabled. In `config/sync` the allowed set is `moderation_state`,
`field_additional_information`, `field_facilitators`,
`field_locations_alternate`, `field_moderators`, `field_urls_video`.
`CfHappeningsOccurrence::setBulkEditOverrideFields()` lets bulk-edit actions
mark fields as overridden.

**Form rules** (`cf_happenings` `FormHooks`):
- New sessions: only `draft` and `published` moderation options; the
  recurrence start must be in the future (`newHappeningsSessionValidate`).
- Existing sessions: the primary location field is disabled in the form,
  denied for edit by `EntityAccessHooks::entityFieldAccess()`, and reverted
  in `EntityHooks::happeningsSessionPresave()` if it changed anyway.
- Existing occurrences: `label`, `hsid`, `timestamp_start`, `timestamp_end`
  are disabled. A draft occurrence (session still draft) or a cancelled
  occurrence has its moderation state locked, with an explanation message.
- The `OccurrenceModerationState` constraint rejects setting a draft
  occurrence to Active while its session is still Draft ("Draft occurrences
  cannot be set to Active while the parent session is still Draft.").

**Computed occurrence fields** (`EntityHooks::entityBaseFieldInfo()`):
- `cf_happenings_resolved_location`: the alternate location if set, otherwise
  the primary location.
- `cf_happenings_resolved_location_address`: that location's address.
- `cf_happenings_resolved_time_slot`: `timestamp_start`/`timestamp_end` as a
  date range (code comment: "@todo We should migrate start and end dates to
  daterange").
- `cf_happenings_resolved_dashboard_location`: "Online" or the location label,
  based on `field_event_format` and, for hybrid events, the format the user
  registered with. It only has a value inside Views that supply the
  registration format (used on the dashboard).

**Deletion.** Deleting a session first deletes all its occurrences
(`happenings_session_predelete`). Occurrence deletion through the UI is always
forbidden (`OccurrenceManagerEntityAccessHooks`), and session deletion is
forbidden when any of its occurrences has a registration in the Registration
API (checked live, `max-age 0`).

### Access

Site-wide permissions come from `happenings.permissions.yml`
(`view/create/update/delete happenings_session`, `view happenings_occurrence`,
`view happenings_occurrence unpublished`, etc.). `cf_happenings` adds Group
permissions in `cf_happenings.group.permissions.yml`, including "... for
assigned locations" variants. `EntityAccessHooks` first checks the site-wide
permission; if that does not allow access, it checks the session's (or the
occurrence's) primary location with the `LocationAssignmentAccessCheck`
service, using the session permission name for occurrences too (code comment:
"@todo Hack."). If neither allows, it returns **forbidden**. Unpublished
occurrences need `view happenings_occurrence unpublished` no matter what
location the user is assigned to.

## External services and integrations

- Each occurrence insert/update is pushed to the Registration API (see
  [registration-api-integration.md](registration-api-integration.md)).
- Stenographer audit records (`happenings.stenographer.yml`) for
  create/update/delete on catalog items, sessions and occurrences, plus
  `event_occurrence_cancel` when an occurrence moves to `cancelled`
  (`cf_happenings` `EntityHooks::happeningsOccurrenceUpdate()`).

## Configuration and permissions

- `/admin/config/careerforce/cf_happenings`: `cf_happenings.settings`
  (`CFHappeningsSettingsForm`), permission `administer cf_happenings`.
- The Session and Occurrence settings forms
  (`/admin/structure/events/event-session`, `.../event-occurrence`) are
  extended by `cf_happenings` `FormHooks` to map which fields mean "primary
  location", "alternate location", "format", "session reference", the
  online/in-person values (`virtual` / `in_person`), the overridable fields,
  the cancel-registration dialog text, and the registration message texts
  stored in `happenings.settings:registration.*`.
- `/admin/config/careerforce/remove-orphan-cms`: the orphan moderation state
  cleanup tool.
- No config split differences for these entity types were found in
  `config/develop`, `config/prod` or `config/lowhost`.

## Related

- [occurrence-generation-and-recurrence.md](occurrence-generation-and-recurrence.md)
- [event-search-and-detail-pages.md](event-search-and-detail-pages.md)
- [event-registration-and-waitlist.md](event-registration-and-waitlist.md)
- [registration-api-integration.md](registration-api-integration.md)
- ../locations/ (groups, CiviServ locations, location assignment access)
- ../appointments/ (appointments reuse `OccurrenceOverrideForm`, the Occurrence Manager and the Registration API)
