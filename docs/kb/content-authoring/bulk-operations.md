# Bulk operations and bulk content fixes

`cf_views_bulk_operations` extends Views Bulk Operations (VBO) and Views Bulk Edit for staff managing sessions, occurrences and external event submissions:

- workflow-aware "Set status" actions;
- field-edit actions driven by `bulk_edit*` form modes;
- per-entity-type delete permissions;
- a bulk-operations field that keeps the CiviServ location context across VBO's multi-step routes.

`convert_field_rel_url` is a separate admin utility. Its bulk action rewrites absolute links to the site's own domain(s) into relative links in configured fields. Event managers, location staff and admins use these.

## What users see

- **Status actions** in VBO dropdowns, labelled "CareerForce: Set <entity type> to <state>". One is derived for each state of each workflow used by `happenings_session`, `appointments_session` (session actions) and the occurrence types (occurrence actions). Rows that can't move are skipped, and the batch result says, by default, "@count selected session(s) already in @state status. No changes have been made." The message can be overridden per view in the action's preconfiguration.
- **Field edit actions** "CareerForce: <form mode label> (<entity type>)", one per enabled form mode whose machine name starts with `bulk_edit`, for example `appointments_occurrence.bulk_edit` and `happenings_occurrence.bulk_edit_staff_member`. The configure step shows only that form mode's fields. Optional extras:
  - a custom title using `%action` and `%count`;
  - hiding the revision fields;
  - forcing "replace" as the change method.
  When only one field is offered, the field selector is hidden.
- **Delete actions per entity type**: "Delete <entity type>" (`views_bulk_operations_delete_entity:<type>`) for every entity type with a `delete-multiple-form` link, so `actions_permissions` can grant delete per type.
- **Cancel appointment registration** (`cf_views_bulk_operations_cancel_appointment_registration`) and **Update External Event Submission Workflow State** actions exist here too. They are documented with appointments and events.
- **Convert to Relative URL** actions for node, taxonomy term, block content, paragraph and CiviServ location (`system.action.*_convert_field_rel_url_action`). They appear in the bulk forms of `views.view.content` (`/admin/content`), `search_content`, `search_taxonomy_terms`, `search_paragraphs`, `search_locations` and `search_content_block`.
- **Settings** for the converter: `/admin/config/content/convert-field-rel-url`, "Convert fields to rel URLs" under Configuration > Content authoring.

Views that use `cf_views_bulk_operations` (grep of `config/sync`): `appointment_sessions`, `appointment_occurrences`, `happenings_occurrence`, `happenings_sessions`, `webform_external_events`.

## How it works

### Status actions

1. Derivers loop the supported entity types and bundles, skip unmoderated bundles, and create one action per state of that bundle's workflow. Each definition carries `entity_type`, `moderation_state` and `state_label`.
2. `access()`:
   - already in the target state: forbidden with the skip message;
   - no workflow transition from the current state: forbidden with the skip message (`@state` = current state label);
   - otherwise `accessModerationTransition()` checks, in order: supported type, has `moderation_state`, moderated, transition exists, `state_transition_validation->isTransitionValid()` (the user's transition permission), then the entity's `update` access.
3. `execute()` calls `applyBulkEditOverrides()` and then sets and saves `moderation_state`. For occurrences, the override marks `moderation_state` with `setBulkEditOverrideFields(['moderation_state'])` on `CfAppointmentOccurrenceInterface` / `CfHappeningsOccurrenceInterface` entities. This appears to stop the session from overwriting the field later; see the events and appointments KBs.
4. Skip messages are stored in the batch results (`cf_skip_messages`). `finished()` replaces the VBO-prefixed per-row messages with the plain message.

`execute()` saves without calling `validate()`, and nothing in this module uses `careerforce.occurrence_moderation_restriction`. So the `OccurrenceModerationState` constraint (a Draft occurrence can't go Active while its session is Draft, see [content-moderation.md](content-moderation.md)) appears not to apply to bulk status changes.

### Field edit actions

`CfModifyEntityValues::getBundleForm()` builds the form from `EntityFormDisplay::collectRenderDisplay($entity, <form_mode>)` instead of the default display. It flattens the per-bundle `details` into a container and applies the preconfiguration toggles. On execute, it calls `setBulkEditOverrideFields()` with the changed field names for occurrence entities. The class docblock lists the steps to add a new bulk-edit action:

1. Create a form mode named `bulk_edit...`.
2. Configure its form display.
3. Add the derivative ID to the view's VBO `selected_actions`.
4. Rebuild caches.

### Location context

The view field `cf_location_views_bulk_operations_bulk_form` needs a "Location context provider", which must be a context of type `entity:civiserv_location`. On `viewsForm()` it saves the location ID into VBO's private tempstore (`views_bulk_operations_<view>_<display>`). `LocationRouteEnhancer` reads it back on the routes `views_bulk_operations.execute_batch`, `update_selection`, `execute_configurable` and `confirm`, and adds `civiserv_location` to the route defaults. Code that relies on location route parameters therefore keeps working during the VBO steps.

### Convert to relative URL

- The host regex is built from `convert_field_rel_url.settings:hosts` plus the current request host. Current config: `careerforcemn.com`, which also matches `www.` and an optional `user@` prefix.
- `execute()` handles each translation, and for each configured field:
  - `link` fields: replaces the host prefix with `internal:/`;
  - `text`, `text_long`, `text_with_summary`: rewrites every `<a href>` through DOM parsing;
  - paragraph references: recurses into the paragraph.
  It saves the translation if anything was processed.
- Configured fields (`config/sync/convert_field_rel_url.settings.yml`) cover node (`body`, `field_description`, `field_main_paragraphs`, ...), civiserv_location, taxonomy_term, block_content and paragraph.

## Configuration and permissions

- Status and bulk-edit actions must be enabled per view in the VBO field's "Selected actions".
- Status actions need the matching workflow transition permission and update access.
- Delete derivatives are gated by `actions_permissions` per type.
- Converter settings route permission: `administer configurations`. No module or role in this export defines that permission (core's is `administer site configuration`), so it appears that only roles with `is_admin: true` (`system_admin`) can open the settings page.
- No config split differences.

## Related

- [content-moderation.md](content-moderation.md): workflows and the occurrence restriction
- [form-fields-and-widgets.md](../miscellaneous/form-fields-and-widgets.md): `cf_views_select` widget used in bulk-edit form modes
- ../events/, ../appointments/: session and occurrence admin views, cancel registration, external event submissions
