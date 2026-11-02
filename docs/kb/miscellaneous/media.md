# Media: oEmbed resilience and per-type media permissions

Two modules change how media behaves. `cf_media` lets editors keep editing an existing remote video (oEmbed) item after the remote video was removed or made private. Core would otherwise refuse to save it. `media_permissions_plus` (MPP) adds per-media-type "create" and "view" permissions with any/own variants, which can override all other access for chosen media types. It is used for uploaded resumes (`resume_uploaded`). Editors, admins and job-services staff are affected.

## What users see

- **Media settings** (`/admin/config/media/media-settings`, core form `media_settings_form`): a "CareerForce" details section with the checkbox "Allow updating media with unavailable oEmbed source". Default and current config value: `false` (`config/sync/cf_media.settings.yml`).
- **Media edit form for an existing oEmbed item** (`/media/{id}/edit`), when the setting is on:
  - If the provider can no longer fetch the resource, a warning loads in after the form (BigPipe placeholder): "The remote resource for this item could not be reached. It may have been removed, made private, or is otherwise unavailable. You can still save changes to this item; the source URL will not be re-verified."
  - After saving: "%label was saved without re-verifying its remote resource."
- **Media type form** (`/admin/structure/media/manage/{type}`): fieldset "Media Permissions Plus settings" with "Use Media Permissions Plus permissions for CREATE access" and "... for VIEW access".
- **Permissions page**: for each media type, four permissions named `media <bundle> create any`, `media <bundle> create own`, `media <bundle> view any`, `media <bundle> view own`. Their titles read "<Type> Media: <operation> <any|own>".

## How it works

### cf_media

1. `CfMediaValidationHooks` swaps the class of the core `oembed_resource` constraint for `CfMediaOEmbedResourceConstraint`, whose validator is `CfMediaOEmbedResourceConstraintValidator`.
2. The validator runs the same steps as core: empty URL, provider lookup, allowed provider. Then `shouldBypassAvailabilityCheck()` returns TRUE only when all of these hold:
   - the media is not new;
   - `cf_media.settings:allow_unavailable_oembed_update` is TRUE;
   - the unchanged stored entity is also oEmbed;
   - its source URL equals the submitted URL.
   In that case it records the ID in `CfMediaBypassTracker` and skips `fetchResource()`.
3. The tracker is keyed by media ID, not object, because the entity form builds separate entity objects for validation and save (code comment).
4. `CfMediaEntityHooks::mediaUpdate()` shows the warning when the saved media's ID was bypassed.
5. On the edit form, `CfMediaFormHooks::alterMediaEditForm()` emits a placeholder token as `#markup` and registers the `#lazy_builder` `cf_media.oembed_availability_checker:build` under `#attached.placeholders`. The comment explains that FAPI decorates every element, so a `#lazy_builder` can't sit directly in the form tree.
6. `OembedAvailabilityChecker::build()` deletes the cache entry `media:oembed_resource:<resource_url>`, because core caches successful fetches permanently. It then fetches. On `ResourceException` it logs a warning to channel `cf_media` and returns the warning container.

### media_permissions_plus

- Permission names: `MppUtility::getMachineName($bundle, $op, $rel)`, which returns `media <bundle> <op> <any|own>`.
- `hook_media_access` (view only): if the bundle's `override_view_permissions` is off, it returns neutral. Otherwise:
  - `view any` gives allowed, cached per permissions;
  - owner with `view own` gives allowed, cached per user plus the entity;
  - everything else gives **forbidden**.
  The forbidden is deliberate: a comment explains it overrides grants from other modules.
- `hook_media_create_access`: if `override_create_permissions` is on, `create any` or `create own` allows. Anything else is forbidden.
- Constraint `mpp_create_permission`, added to every media entity: when create override is on, it requires `create any`, or ownership plus `create own`. Messages: "The current user is not the owner of this Media and does not have permission to create Media owned by other users." or "The current user does not have permission to create Media."
- Settings are third-party settings on the media type: `media_permissions_plus.override_create_permissions` and `override_view_permissions`.

Current config: only `media.type.resume_uploaded` turns both overrides on. Role grants from `config/sync/user.role.*.yml`:

| Role | MPP permissions |
|---|---|
| `authenticated` | `resume_uploaded` create own, view own |
| `job_services_admin`, `job_services_administrator` | `resume_uploaded` create any, view any |
| `site_admin` | file/image/remote_video create and view any and own, `resume_uploaded` create any and view any |
| `content_moderator` | file/image/remote_video create and view any and own (no `resume_uploaded`) |

## External services and integrations

- oEmbed providers configured on the `remote_video` media type, through core's `media.oembed.url_resolver` and `media.oembed.resource_fetcher`.

## Configuration and permissions

- `cf_media.settings:allow_unavailable_oembed_update`: `/admin/config/media/media-settings` (uses `#config_target`).
- MPP override flags: media type edit form. Permissions: `/admin/people/permissions`.
- No config split differences.

## Related

- ../job-seeker-tools/: resume upload, the main consumer of `resume_uploaded`
- ../platform-and-operations/: logging channel `cf_media`, ClamAV config in the prod split
