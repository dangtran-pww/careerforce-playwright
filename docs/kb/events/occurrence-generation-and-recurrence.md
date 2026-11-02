# Occurrence generation and recurrence rules

When staff schedule a session they enter a date, a start and end time, and
optionally a recurrence ("repeats every N weeks/months until <date>"). The
custom `rrule` module stores that as a recurrence rule field, and the
**Occurrence Manager** in the `happenings` module turns the rule into
individual occurrence entities: right away when the session is saved, then on
a rolling window through cron. The same machinery also creates appointment
occurrences (`appointments_session`), so changes here affect both features.

## What users see

- **Session form, "Date and time" widget** (`rrule_widget`): Date, Start Time,
  End Time (15-minute steps from 7:00 AM to 8:00 PM), a "This is a recurring
  event" checkbox, "Repeats every" plus Weeks/Months, "Until" date, an
  "Advanced" section (Every: First…Fifth/Last; Days of week: Monday–Friday)
  and a **Preview Occurrence Dates** button that opens a modal list of dates.
- On an existing session every widget element except **Until** is disabled
  (`RRuleWidget::isFieldDisabled()`).
- Moving **Until** earlier when affected occurrences have active
  registrations shows an inline warning with Yes/No buttons before saving
  (see "Until-date changes" below).
- After saving a session the admin sees a batch progress page ("Generating
  occurrences" or "Updating and generating occurrences") and then
  "Occurrence generation complete." / "Occurrences updated and generated.".
- Days not allowed by config are rejected on save: "You may not schedule
  Sessions on Saturday or Sunday." (with the configured day names).
- Admin pages:
  - `/admin/config/careerforce/occurrence-manager`: global settings
    (`OccurrenceManagerSettingsForm`): minimum log level, minimum cron
    interval, last cron run with a "clear" button, and a log test tool.
  - The per-entity-type Occurrence Manager fieldset is added to the Session
    settings form `/admin/structure/events/event-session`
    (`OccurrenceManagerSettingsFormHooks`).
  - `/admin/config/rrule/settings`: preview modal text (`RRuleSettingsForm`).

## How it works

### Registration of session types

A module declares a session entity type through
`hook_occurrence_manager_register_entity_types()`. `happenings` registers
`happenings_session` (`HappeningsEntityHooks`), and `appointments` registers
`appointments_session`. Per-type settings live in
`happenings.occurrence_manager_settings.<session_entity_type>`. Values in
`config/sync/happenings.occurrence_manager_settings.happenings_session.yml`:

| Key | Value |
|---|---|
| `occurrence_generation.rrule_field_name` | `field_rrule` |
| `occurrence_generation.generate_occurrences` | `true` |
| `occurrence_generation.occurrence_entity_type_id` | `happenings_occurrence` |
| `entity_fields.foreign_key_field` / `start_datetime_field` / `end_datetime_field` | `hsid` / `timestamp_start` / `timestamp_end` |
| `entity_fields.occurrence_workflow_state_field` / `occurrence_cancelled_workflow_state` | `moderation_state` / `cancelled` |
| `generate_limits.generate_max_count` | `51` upcoming occurrences per session |
| `generate_limits.generate_max_days_until` | `50` days ahead |
| `generate_limits.session_blocked_workflow_states` | `cancelled` |
| `generate_limits.allowed_days_of_week` | MO–FR (SA, SU off) |
| `occurrence_updates.add_attendee_window_in_days` | `30` (see [event-attendee-management.md](event-attendee-management.md)) |
| `occurrence_display.display_limit_days_in_future` | `45` (Display Window filter) |

Global settings (`happenings.occurrence_manager_global_settings`):
`min_log_level: 3` (errors only) and `cron_min_interval: 24` hours.

### Rule building

`RRuleUtility::massageFormValues()` turns widget input into field columns,
using the site default timezone (`system.date:timezone.default`) and zeroed
seconds. The widget only offers WEEKLY and MONTHLY (`getFrequencyTypeOptions()`)
and only the "Until" limit (`limit_type = UNTIL`). `makeRule()` builds a
`Recurr\Rule` (the `simshaun/recurr` library; it is in `composer.lock`, but
not required directly in the root `composer.json`):
- No repeat: `FREQ=DAILY;COUNT=1`.
- Weekly: `BYDAY` from the selected days.
- Monthly: BYDAY + BYSETPOS ("first Tuesday"), BYMONTHDAY from set position
  ("3rd day"), BYDAY only, or the start date's day of month.
- Until: `limit_until` is stored as midnight of the last allowed date;
  `getOccurrenceDeadline()` moves it to midnight of the following day, so an
  event later on the Until date is still included.

### Generation pipeline

Three queues, all with cron workers:

| Queue | Worker | Does |
|---|---|---|
| `occurrence_manager_sessions_for_generate` | `SessionsForGenerateQueueWorker` (30 s/cron) | For one session, finds the latest existing occurrence and queues generate items for recurrences from 24 hours before it onward |
| `occurrence_manager_generate` | `OccurrenceManagerGenerateQueueWorker` (30 s/cron) | `OccurrenceManager::generateOneOccurrence()` |
| `occurrence_manager_update_occurrence` | `OccurrenceManagerUpdateQueueWorker` (60 s/cron) | Re-saves one occurrence so `Occurrence::preSave()` re-copies session fields |

Triggers:
1. **Session insert** (`sessionEntityInsert`): queue a generate item for every
   recurrence, then run a batch that drains `occurrence_manager_generate`.
2. **Session update** (`sessionEntityUpdate`): queue an update item for every
   existing occurrence, queue generate items for every recurrence, then run a
   batch that drains the update queue and then the generate queue.
3. **Cron** (`OccurrenceManagerEntityOperationsHooks::cron()`): runs at most
   once per `cron_min_interval` hours (state key
   `happenings.occurrence_manager.cron_last_run`). It **deletes both generate
   queues**, then queues every session whose `limit_until` has not passed and
   whose moderation state is not blocked. On AWS, `drush cron` runs every
   10 minutes (`.deploy/.ebextensions/10-drupal-cron.config`), so in practice
   this is once a day.

`generateOneOccurrence()` validates each item before it creates anything. It
skips the item, logging at INFO, if: the session is in a blocked state; the
start is in the past; the start is more than `generate_max_days_until` days
ahead; the weekday is not allowed; an occurrence with the same session, start
and end already exists; or the session already has `generate_max_count` or
more upcoming occurrences. The new occurrence gets the label
`<session label> <l, F j, Y>`.

### Until-date changes (auto-cancel)

- `occurrenceEntityPresave()`: when an existing, future, non-cancelled
  occurrence is saved and its start is after the session's occurrence
  deadline (from `limit_until`), its moderation state is set to `cancelled`
  and `moderation_state` is added to `fields_with_overridden_values`, so the
  next session cascade does not revert it. A session update re-saves every
  occurrence through the update queue, so shortening Until cancels the
  occurrences past the new date.
- `LimitUntilWarningHandler` (attached to existing-session forms by
  `cf_happenings` `FormHooks`): if Until moves earlier and any
  `rrule.occurrence_save_constraint` checker reports a blocker, the form
  rebuilds with "Changing this session's Until date to <date> means cancelling
  upcoming occurrences for which users have already registered. Registrants
  will receive a cancellation email. Would you like to proceed?". **Yes**
  runs the normal save handlers; **No** restores the original date. The
  event checker (`HappeningsOccurrenceConstraintChecker`) asks the
  Registration API whether any occurrence on or after the cutoff has a
  registration in any status except Canceled.
- The handler reads `field_rrule` delta 0 directly, so it assumes the rule
  field is named `field_rrule`.

### Preview

`PreviewDatesController::preview()` takes the posted widget values, builds
the rule, expands it, and drops weekdays not in `allowed_days_of_week`. It does
**not** apply `generate_max_days_until` or `generate_max_count`, so the preview
can list dates further out than what gets generated right away. The modal text
(`rrule.settings:preview_dates.description`) says this.

### Display Window filter

`OccurrenceManagerViewsHooks` registers a "Display Window" filter on the
occurrence data table and on every Search API index that contains the
occurrence datasource. It limits results to occurrences that start within
`display_limit_days_in_future` (45) days. The public events search uses the
Search API version (see [event-search-and-detail-pages.md](event-search-and-detail-pages.md)).

## External services and integrations

- Each generated or re-saved occurrence is pushed to the Registration API by
  `registration_api`'s `hook_happenings_occurrence_insert/update` (see
  [registration-api-integration.md](registration-api-integration.md)). One
  session save can therefore send as many API calls as the session has
  occurrences.
- `HappeningsOccurrenceConstraintChecker` and the session delete access check
  read registrations from the Registration API.

## Configuration and permissions

- Occurrence Manager global settings: `/admin/config/careerforce/occurrence-manager`,
  permission `administer happenings_session`.
- Per-type settings: Session settings form, permission `administer happenings_session`.
- RRule settings: `/admin/config/rrule/settings`, permission
  `administer site configuration`.
- Preview endpoint `/rrule/ajax/preview-dates` requires a logged-in user only.
- `rrule_form_alter()` attaches the `rrule/rrule_widget_frequency` library to
  **every** form on the site, not only forms with an rrule field.
- `RRuleHooks` removes the "Default value" section from rrule field config
  forms (code comment: `drush cex` failed on timestamp defaults).

## Related

- [event-content-model.md](event-content-model.md)
- [event-attendee-management.md](event-attendee-management.md) (add-attendee window)
- [registration-api-integration.md](registration-api-integration.md)
- ../appointments/ (appointment sessions use the same Occurrence Manager and rrule field)
- ../platform-and-operations/ (cron schedule, logging)
