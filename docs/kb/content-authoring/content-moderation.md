# Content moderation and content types

CareerForce runs node pages, programs/services, training programs and CiviServ locations through a "Content Review" workflow so contributors draft and moderators publish. Our custom code is small: `cf_content_moderation` adds a per-workflow moderation-state filter for Views, and the main `careerforce` module blocks Draft occurrences from going Active while their parent session is still Draft. Editors, content moderators and QA use this.

## What users see

- **Moderation dashboards** (Views, config only):
  - `/admin/content/moderated` (`views.view.moderated_content`, needs `view any unpublished content`).
  - `/admin/civiserv/location-moderation` and `/admin/civiserv/location-moderation/content` (`views.view.location_moderation`, `views.view.location_content_moderation`).
- **Per-workflow "Moderation state (Workflow name)" exposed filter** in admin listings of sessions and occurrences, for example `/admin/content/appointments/appointment-session` and `group/%group/location/%civiserv_location/location-appointments` (`views.view.appointment_sessions`). The views using our filter plugin are `appointment_sessions`, `appointment_occurrences` and `happenings_sessions` (found by grepping `config/sync` for the plugin ID).
- **Occurrence edit form**: when an occurrence is Draft and its session is Draft, the "Active" option is removed from the moderation-state select. Any save path that validates the entity rejects Active with: "Draft occurrences cannot be set to Active while the parent session is still Draft."

### Editorial workflow "Content Review" (`config/sync/workflows.workflow.editorial.yml`)

Applies to node bundles `page`, `service`, `training_program` and to `civiserv_location` bundles `careerforce_location`, `partner_or_employer`, `partner_statewide_virtual`, `statewide_or_virtual`. Default state: Draft.

| State | Published | Default revision |
|---|---|---|
| Draft (`draft`) | no | no |
| Review Draft (`review`) | no | no |
| Published (`published`) | yes | yes |
| Pending Updates (`pending_updates`) | no | no |
| Review Updates (`review_updates`) | no | no |
| Archived (`archived`) | no | yes |

Transitions: Create New Draft, Submit for Review, Needs Work (review to draft), Publish, Updates in Progress (to pending_updates), Submit Updates for Review (to review_updates), Archive, Restore (archived to published), Return to Draft, Return to Review.

Who can use them (from `config/sync/user.role.*.yml`):

| Role | Transitions |
|---|---|
| `content_moderator`, `site_admin`, `user_manager` | all ten, including Publish, Archive, Restore |
| `contributor`, `job_services_admin` | all except Publish, Archive and Restore |

Other workflows in `config/sync` belong to other areas: `appointment_session`, `session`, `external_event`, `external_event_submissions`, `service_item`, `connection_*`, `user_state`. `appointment_occurrence` is labelled "(Not Used)" and has no entity types.

### Content types (`config/sync/node.type.*.yml`)

| Machine name | Name | Description / notes |
|---|---|---|
| `article` | Article | Article content type. Not in a workflow. |
| `careerforce_in_the_news` | Careerforce in the News | Link to external news article. Not in a workflow. |
| `etpl_training_program` | Training Program (ETPL) | Submit a training program for Minnesota's Eligible Training Provider List. Not in a workflow. |
| `page` | Page | Generic page content. Editorial workflow. |
| `private_page` | Private Page | Private content for groups. Not in a workflow. |
| `service` | Program or Service | General service content for CiviServ. Editorial workflow. |
| `training_program` | Training Program | Training Program content for CareerForce. Editorial workflow. |
| `webform` | Webform | A basic page with a webform attached. Not in a workflow. |

## How it works

### Per-workflow moderation state filter

Core's moderation-state filter offers every workflow's states in one list. `WorkflowModerationStateFilter` is tied to one workflow (`workflow_id` in the Views data definition):

- `getValueOptions()` lists only that workflow's states, and only if the workflow applies to the view's entity type.
- `opSimple()` finds bundles whose `workflow` bundle info equals the bound workflow and adds `bundle IN (...)` AND `workflow = <id>` AND `moderation_state IN/NOT IN (...)`. If no bundle uses the workflow, or no workflow is bound, it adds `1 = 0` (empty result). On revision tables it joins the base table for the bundle column.
- Cache tags and contexts include the workflow list tags. `calculateDependencies()` adds the workflow config, and `onDependencyRemoval()` removes the filter if the workflow is deleted.

### Occurrence Draft to Active restriction

`OccurrenceModerationRestriction::matchesRestrictedContext()` applies only when all of these are true:

1. The entity is `happenings_occurrence` (session field `hsid`) or `appointments_occurrence` (`asid`).
2. The entity is not new.
3. Its original moderation state (`ModerationInformation::getOriginalState()`) is `draft`.
4. The parent session loads and its `moderation_state` is `draft`.

The widget removes `published` (labelled "Active") from the options and hides the select if no options remain. The constraint validator rejects a save whose `moderation_state` is `published` in that context. Constraints only run when something calls `validate()`, as entity forms do. The bulk "Set occurrence status" action calls `$entity->save()` without validating and doesn't use this service, so it appears not to enforce the restriction. See [bulk-operations.md](bulk-operations.md).

## Configuration and permissions

- Workflows: `/admin/config/workflow/workflows` (core UI). Transition permissions: `use editorial transition <id>`.
- To use the per-workflow filter, add "Moderation state (<workflow label>)" to a view of a moderated entity type.
- No config split differences found for these modules (`config/develop`, `config/prod`, `config/lowhost` contain none of their config).

## Related

- [bulk-operations.md](bulk-operations.md): bulk "Set session/occurrence status" actions
- ../events/ and ../appointments/: sessions and occurrences
- ../locations/: CiviServ locations under the same editorial workflow
