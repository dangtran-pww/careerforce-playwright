# Site-wide behavior

## Summary

`web/modules/custom/careerforce` is the main site module. Most of it belongs
to features documented elsewhere. This page covers the parts that are not tied
to one feature: event subscribers, route alters, access checks, OOP hooks in
`src/Hook`, the EDR counties batch, the login action "queue", Condition
plugins, Drush commands and deploy hooks.

## Event subscribers

- **LayoutBuilderComponentRenderArray**: on
  `SECTION_COMPONENT_BUILD_RENDER_ARRAY`, if a block has a label and the
  layout has a `layout_builder.entity` context, runs
  `t($label, ['@entity' => $entity->label()])`. Lets editors put `@entity` in
  a Layout Builder block title.
- **User403to404HttpSubscriber**: HTML-only. If the current route is in
  `careerforce.user_routes:routes` (`config/sync/careerforce.user_routes.yml`,
  17 routes: user canonical/edit, `fam.user.edit_mail`, `fam.user.edit_pass`,
  profile forms, several `page_manager` "my account" pages, user webform
  submissions), an access-denied becomes a `NotFoundHttpException`. Hides
  whether a user ID exists.
- **UserPoliciesQueueSubscriber**: on `UserPoliciesEvents::EXPIRE_USERS` and
  `PURGE_USERS`, adds the condition `field_extended_profile_type IN (staff,
  partner)` when that user field exists. Account expiry and purge therefore
  appear to apply only to staff and partner accounts, not job seekers. See
  [../accounts/](../accounts/) for user policies.

## Route alters (`RouteSubscriber`)

| Route | Change |
|---|---|
| `entity.connection.edit_form` | `_admin_route = FALSE` (front-end theme). |
| `civiserv_jobs.occupation_suggester` | Controller replaced with `OccupationSuggestionController::buildSuggestions`. |
| `email_tfa.email_tfa_verify_login` | Title "Confirm Your Identity". |
| `entity.user.civiserv_create_member` | `_access: FALSE` (bypasses CareerForce policies and Entra ID, per comment). |

## Access checks

**`_cf_location_assignment_check: '<group permission>'`** plus route option
`_cf_location_context: '<context id>'` (`LocationAssignmentAccessCheck`):

1. Resolves a `civiserv_location` from the named runtime context.
2. Allowed if the user has the group permission on the location's group.
3. Otherwise, if the user has `"<permission> for assigned locations"`, allowed
   only when the location is in the membership's primary-location field. The
   field name per membership bundle comes from
   `careerforce.settings:group_relationship.primary_location_field.<bundle>`.
4. Anything not allowed returns **forbidden** (not neutral), on purpose, so no
   other check can override it.

Used by `cf_appointments` routes (`create appointments_session`,
`register appointments_occurrence`) and injected as a service into
`cf_service` and `cf_appointments` access handlers. See
[../appointments/](../appointments/), [../services/](../services/).

**`_location_content_availability: '<param>'`** (`LocationContentAvailabilityAccessCheck`):
used by `careerforce.group.location.content.availability`
(`/group/{group}/location/{civiserv_location}/content/availability`) and
`careerforce.group.content.location.availability`
(`/group/{group}/content/{group_relationship}/availability`). Allowed for
`administer civiserv settings` / `administer civiserv location entities`, or
group permission `assign content to any civiserv location`, or
`assign content to member civiserv locations` when the location is in the
member's `civiserv_location` or `field_primary_location`. Missing parameter
returns forbidden.

## Hooks (`src/Hook`)

| Class | Hook | Effect |
|---|---|---|
| `BlockHooks` | `block_build_local_tasks_block_alter` | Local tasks block made uncacheable (`max-age 0`, `user` context). Long comment explains: after an access-denied the router stores an exception on the request, and the local tasks block was cached empty until a cache clear. `@todo` per-location cache context. |
| `CiviservLocationHooks` | `civiserv_location_delete` | Removes the deleted location from every group relationship's `field_primary_location`. |
| `DateHooks` | `preprocess_input__date` | Default `min`/`max` on date inputs from `careerforce.date_input_settings` (`date_min: 50`, `date_max: 20` years). |
| `ElementHooks` | `element_info_alter` | Address element: "Street Address Line 1/2", "ZIP Code" (max length 10 for ZIP formats), and fixes the postal code error message label. |
| `EntityHooks` | `entity_operation_alter` | Moves the "View" operation first (weight 0). |
| `FieldHooks` | `entity_bundle_field_info_alter`, `field_formatter_third_party_settings_form`, `field_formatter_settings_summary_alter`, `preprocess_field` | For group membership relationships, the member `entity_id` field uses selection handler `careerforce_user_by_email` limited to `staff`/`partner` profiles, 12 matches. Adds formatter third-party settings ("Item separator", and for string fields "Append to string": prepend/append token-replaced text to each item). |
| `PageHooks` | `page_attachments` | Adds `careerforce/admin_styles` on admin routes. |
| `UsersSearchViewsHooks` | `views_post_execute` | Logs an audit event when `user_admin_people` or `account_admin` views run (skips `/batch?` requests). See [logging-and-auditing.md](logging-and-auditing.md). |
| `ViewsHooks` | `field_views_data_alter`, `views_pre_render`, `views_data_alter` | Adds smart_date-style "granularity" filters for daterange and timestamp fields; adds typed Views entries for Search API aggregated taxonomy-term and string fields; in view `staff_group_locations`, drops the primary location from each membership's location list and sorts the rest by label. |

## Batch: EDR counties lookup

`EdrCountiesRebuild` empties `careerforce_edr_counties`, then for each
Economic Development Region from `Utility\Edr::getEdrNames()` calls the
`mn_lmi` datasource request `EdrCounties` and stores county → EDR rows. It is
started from the "Rebuild Counties Lookup Table" button on
`/admin/config/services/civiserv-jobs/lmi-data` (`CareerForceSettingsForm`,
permission `administer site configuration`). The same form edits
`careerforce.data_api:lmi_endpoint`, which is overridden per environment by the config splits.

Minor: `updateEdrCounties($stepSize = 3)` uses `--$stepSize` in the loop
condition, so it processes 2 regions per batch pass, not 3.

## Post-login actions ("UserLoginQueue")

Despite the name, this is session-based, not a Drupal queue:

1. `careerforce_user_login()` calls `resetActionQueue()` and adds every
   `LoginActionInterface` returned by `hook_login_action_queue()`.
   CareerForce returns `PasswordResetLoginAction` and
   `AnonOccupationsLoginAction`.
2. Actions are stored in the session key `UserLoginQueue`, sorted by priority.
3. `careerforce_preprocess_page()` runs pending actions on each page until one
   reports `STATUS_ACTIVE`.
   - `PasswordResetLoginAction`: stays active while on `fam.user.edit_pass`.
   - `AnonOccupationsLoginAction`: skipped on admin routes; if the visitor
     saved careers while anonymous, redirects to the occupation suggester
     with `suggester_id=anon_stored_careers`.

`resetActionQueue()` also deletes and recreates a real Drupal queue named
`UserLoginQueue` (Redis-backed wherever Redis is configured, via `queue_default`).
Nothing is ever added to it, and the `careerforce_user_login_queue`
QueueWorker plugin uses a different name, so the worker appears unused.

## Condition plugins

| Plugin id | Label | Evaluates TRUE when |
|---|---|---|
| `permission_access_condition` | Permission Access | Context user has configured `perm`, or `user_match_override` is on and the route `{user}` is the context user. |
| `careerforce_profile_type` | Profile Type | No types configured, or the authenticated context user's `field_extended_profile_type` is one of them. |
| `careerforce_user_match_context` | Current user matches user context | The current user is logged in **and is not** the context user. The label is misleading; the summary text ("Grant access if current user is not the route user") matches the code. |

These are used by block visibility and Context config (33 files in
`config/sync`, for example `block.block.careerforce_skin_breadcrumbs`,
`context.context.is_job_seeker`).

## Drush commands

The `careerforce` module itself defines no Drush commands. Submodules:

| Command | Module | Notes |
|---|---|---|
| `hotline_group:careerforce_hotline_group_import` (alias `cfhg_import`) | `hotline_group` | Imports hotline groups from `hotline_group.settings:data_uri` with a `civiserv_import` batch. On failure emails `civiserv_import.settings:notify_emails`. Runs weekly from cron (Mon 01:00). |
| `sql:sanitize` post-hook | `cf_resume` | Deletes all resumes, resume paragraphs and `resume_uploaded` media. |

## Deploy hooks

`careerforce.deploy.php` (run by `drush deploy:hook` in every deploy):

| Hook | Purpose (from doc comments) |
|---|---|
| `careerforce_deploy_10100` | Purge users inactive too long, apply user states. |
| `careerforce_deploy_10101` | Give CareerForce members the new job services role. |
| `careerforce_deploy_10102` | Convert pending partners into active job seekers (users created after the 12/16/2025 deploy used the wrong registration funnel). |
| `careerforce_deploy_10103` | Convert saved user SOC codes to O*NET 2019 occupations. |
| `careerforce_deploy_10104` | Remove saved SOC codes that are not valid O*NET 2019 occupations. |
| `careerforce_deploy_10105` | Remove invalid MOC codes from user work experience. |

They process users in batches and call
`stenographer.trigger.kill_switch->halt()` so the bulk changes do not create
audit events.

## QA notes

- Expect 404 (not 403) on other users' account pages.
- After logging in, a user who saved careers anonymously is redirected to the
  stored careers suggester page once.
- Local tasks (tabs) are not cached; tab visibility changes take effect
  immediately.
- Date inputs without explicit limits accept dates from 50 years ago to 20
  years ahead.

## Related

- [logging-and-auditing.md](logging-and-auditing.md)
- [security-and-waf.md](security-and-waf.md)
- [shared-pww-modules.md](shared-pww-modules.md)
- [../accounts/](../accounts/), [../locations/](../locations/), [../appointments/](../appointments/), [../services/](../services/), [../jobs-and-careers/](../jobs-and-careers/)
