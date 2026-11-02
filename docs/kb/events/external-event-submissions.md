# External event submissions

Outside organisations (for example employers running a job fair) can submit
an event through the public **Submit an Event** webform. Staff review the
submission, turn it into an **External Session** (`happenings_session_ext`)
entity, and publish it. It then appears in the events search next to
CareerForce's own events. The `cf_external_events` module adds validation, the
submission-to-entity link, workflow syncing and a few UI tweaks around the
contrib Webform and `webform_workflows_element` modules.

## What users see

- **Public form**: `/form/external-event` (webform `external_event`, "Submit
  an Event", open to anonymous and authenticated users, with CAPTCHA). Fields:
  Event Name, Hosted By, Date, Start Time, End Time, Event Type (filtered
  list), Description, Link to Event Information, Accommodation Phone Number,
  Format (checkboxes), Address (In Person), Submitter Name, Submitter Email.
  Confirmation page `/form/external-event/confirmation`. The "For Employers"
  CTA block links here.
- **Emails** (webform handlers): "CareerForce event submission confirmation"
  to the submitter on completion; "Your event has been approved on
  CareerForce.MN.gov" on the `accept_submission` workflow transition.
- **Staff review list**: `/admin/content/events/webform-submissions` (view
  `webform_external_events`, tab "Webform Submissions" under Manage Events;
  requires `access happenings_session_ext webform submissions overview`,
  which `cf_happenings` defines). Bulk actions from `cf_views_bulk_operations`
  move submissions between workflow states. The workflow element itself is
  only visible and editable for the roles `event_manager`,
  `job_services_administrator`, `site_admin` and `system_admin`.
- **Submission operations**: "View Submission", "View Event" (when an
  external event exists), "Draft an external event" (when the submission is in
  `pending_review`).
- **External events list**: `/admin/content/events/external-session` (view
  `happenings_external_sessions`; tab renamed "External Events"). Each row has
  "View Event" and "View Submission".
- **External event form**: `/events/event-external/add?field_webform_submission=<sid>`
  is prefilled from the submission. All forms default the link text to
  "Learn more".
- **Settings**: `/admin/config/careerforce/cf-external-events` (allowed event
  types) and the External Session settings form
  `admin/structure/happenings-session-ext` ("Entity settings" and "Webform"
  sections).

## How it works

Two workflows are involved:

| Object | Workflow | States |
|---|---|---|
| Webform submission (`workflow` element) | `external_event_submissions` (webform_workflows_element) | `pending_review`, `draft`, `accepted`, `declined`, `marked_spam`. Transitions: `create_draft`, `accept_submission`, `declined`, `marked_spam`, `pending_review` |
| External Session entity | `external_event` (content moderation) | `draft`, `published` ("Active"), `cancelled`. Transitions: `to_draft`, `to_published`, `to_cancelled` |

`cf_external_events.settings` (in `config/sync`) ties them together:
`entity.submission_field: field_webform_submission`,
`entity.draft_transition: to_draft`, `entity.approved_transition: to_published`,
`webform.entity_reference_element: external_event_entity`,
`webform.workflow_element: workflow`, `webform.pre_draft_state: pending_review`,
`webform.draft_transition: create_draft`,
`webform.approved_transition: accept_submission`, and
`allowed_event_types: [783, 784]` (term IDs, so they differ per database if
terms are not synced).

Flow:
1. The public submits the form. The submission starts in `pending_review`
   (the workflow's `initial_state`).
2. Staff either:
   - click **Draft an external event** on a `pending_review` submission. This
     opens the add form with `?field_webform_submission=<sid>`.
     `ExternalSessionFormHooks` prefills it only if the submission belongs to
     `external_event`, is in `pending_review`, and is viewable by the user.
     Mapping: label ← event_name, host ← hosted_by, description (basic_html),
     type, contact name/email, phone, format (`online` → `virtual`), link,
     address (US state names → codes, country US), and date range from date +
     start/end time; or
   - use the VBO "Draft" bulk action, which creates the external event
     directly and redirects to `/admin/content/events/external-session` (via
     `PendingEntityRedirect`, a private tempstore entry read on the next
     redirect response).
3. On entity presave (new entity), `field_webform_submission` is set from the
   query string. On insert, the entity ID is written back into the
   submission's `external_event_entity` element. This only happens on insert;
   changing the link later is not supported.
4. On insert and update, `syncSubmissionWorkflowState()` compares the entity's
   moderation state before and after the save. Entering the `to_draft` target
   state runs `create_draft` on the submission; entering the `to_published`
   target state runs `accept_submission`, which sends the "approved" email.
   The webform transition only runs if it is valid from the submission's
   current state.
5. Published external events are indexed in `general_site_content` and
   `events_mlt` and show on the events search (see
   [event-search-and-detail-pages.md](event-search-and-detail-pages.md)).

## External services and integrations

- Email via Webform handlers (to the submitter's address).
- CAPTCHA point `captcha.captcha_point.external_event`.
- No Registration API involvement; external events have no registration in
  CareerForce (they link out via `field_links`).
- Stenographer audit for submissions and external events.

## Configuration and permissions

- `administer cf_external_events` (restricted): allowed event types page.
- `administer happenings_session_ext` and `create/edit/delete happenings_session_ext`
  (from `happenings.permissions.yml`) for the entity.
- The "Draft an external event" link only shows if the user can access the
  external event add form.
- Workflow transition visibility settings are per element in the webform
  element config ("Hide … from the submission operations list" / "Hide …
  from this field's transition options").

## Related

- [event-search-and-detail-pages.md](event-search-and-detail-pages.md)
- [event-content-model.md](event-content-model.md)
- ../content-authoring/ (webforms, VBO actions)
- ../platform-and-operations/ (audit logging)
