# Shared PWW modules (CiviServ, Display Maestro and others)

## Summary

CareerForce is built on Portland Webworks' **CiviServ** platform. Several PWW
modules come from outside this repo:

| Module | How it arrives | Branch / version | Enabled? |
|---|---|---|---|
| `civiserv` (+ submodules) | git submodule `web/modules/custom/civiserv` (`portlandwebworks/civiserv-module`) | `.gitmodules` tracks `8.x-2.x-dev` | yes |
| `dismae` (Display Maestro) | git submodule `web/modules/custom/dismae` (`portlandwebworks/dismae`) | `.gitmodules` tracks `8.x-1.x-dev` | **no** (not in `core.extension.yml`) |
| `user_policies` | git submodule | `8.x-1.x-dev` | yes; see [../accounts/](../accounts/) |
| `pww_module` | Composer VCS repo (Bitbucket) | `dev-deed` | only `pww_module_jump_link_menu` |
| `decision_tree` | Composer VCS repo (Bitbucket) | `dev-deed` | yes |
| `stenographer` | drupal.org (`drupal/stenographer`) | `1.0.x-dev` | prod split only; see [logging-and-auditing.md](logging-and-auditing.md) |
| `toolshed` | drupal.org (`drupal/toolshed`) | `2.0.x-dev` | yes (`toolshed`, `toolshed_media`, `toolshed_menu`, `toolshed_search`) |

Submodules are not in the source export used for these docs. CiviServ and
Display Maestro were read from a separate read-only checkout. That CiviServ
checkout is at commit `3b2cdb62` on branch `2.0.x`
("DI-344: Update flag dependency"), which is **not** on `8.x-2.x-dev`; the
commit pinned by the CareerForce `master` gitlink could not be checked from
the export. Treat CiviServ details as "current 2.0.x", not as an exact
match.

## CiviServ

### What it provides

From `civiserv/README.md`, `civiserv.info.yml` and the source tree:

- **CiviServ providers**: Groups (Group module 3.x) that offer services,
  events, locations and connections. CareerForce configures four provider
  group types in `config/sync/civiserv.settings.yml`: `careerforce_admin`,
  `community_partner`, `employer`, `workforce_center`, with the group role
  each member gets and the user roles granted while a member (`contributor`,
  plus `job_services_admin` for workforce centers; removed on exit except for
  `careerforce_admin`).
- **Locations**: the `civiserv_location` content entity and
  `civiserv_location_type` bundles, so a provider can have many locations
  with moderation. CareerForce defines five location types in config:
  `careerforce_location`, `partner_or_employer`, `partner_statewide_virtual`,
  `statewide_or_virtual`, `alt_location`. Location handler plugins:
  `PhysicalLocation`, `RegionalLocation`.
- **External datasource API** (`src/DataRequest`): base classes for
  datasources and (async) data requests against external HTTP APIs. CareerForce
  builds its LMI and other data requests on this (see
  `web/modules/custom/careerforce/src/Plugin/CiviServ/` and
  [../jobs-and-careers/](../jobs-and-careers/)).
- **Search**: a Search API processor `LocationProximityProcessor` and
  `SolrRegionalQueryAlterEventSubscriber` (Search API Solr pre-query alter for
  regional results).
- **Access checks, widgets, Views plugins** for provider/location filtering,
  provider entity selector plugins, validation constraints for provider
  members and content, and a "Powered by" block.
- **Admin UI**: `/admin/civiserv`, `/admin/civiserv/settings`,
  `/admin/civiserv/settings/regions` (permission `administer civiserv settings`),
  `/admin/structure/location-type/{type}/default-field-mapping`.
- `/group/{group}/members/create` (`entity.user.civiserv_create_member`) is
  **disabled** by CareerForce's `RouteSubscriber` (`_access: FALSE`).

Dependencies: `token`, `entity`, `flag` (^4 beta or ^5), `group` (^3.3.5),
`toolshed`.

### CiviServ submodules enabled on CareerForce

| Submodule | Description (from info.yml) |
|---|---|
| `civiserv_import` | Classes and utilities for import batches (used by hotline import, for example). |
| `civiserv_referral` | Referral entities. |
| `connection` | Lets users and groups communicate (connections). |
| `event_registration` | Registration handling for events. |
| `provider_network` | Associations between provider groups for sharing. |

CareerForce also has its own CiviServ-related modules in
`web/modules/custom/`: `civiserv_jobs`, `civiserv_referral_audit`. These are
in-repo and covered by the feature docs.

## Display Maestro (dismae)

`dismae` is "a module for conducting entity displays and layouts" (README).
It provides `dismae_page` config entities ("Display Pages") at
`/admin/structure/display-page`, a route subscriber that builds pages from
them, field wrapper plugins (standard, inline, list), stylers (attribute,
accordion), item providers for blocks and views, and a Toolshed third-party
block style setting. Depends on `layout_discovery`, `views`, `toolshed`,
`iconset`. The checkout read was at `402fd4a` (branches `1.0.x`/`2.0.x`).

In CareerForce `master`, `dismae` is **not enabled** (absent from
`config/sync/core.extension.yml` and from every split). The only reference is
`web/themes/custom/careerforce_skin/src/Preprocess/Page.php`, which checks for
route `dismae.page.taxonomy_page`; that branch can never match while the
module is off. The submodule appears to be a leftover that is still built into
the artifact.

## pww_module and decision_tree

Both are Composer packages from Bitbucket VCS repos pinned to the `dev-deed`
branch (installed to `web/modules/contrib/`, not in git). `pww_module` is a
collection of submodules (`pww_module_core`, `_group`, `_user`, `_webform`,
`_tableau`, `_jump_link_menu`, ...); only `pww_module_jump_link_menu` is
enabled. `decision_tree` is enabled; its info file only says "Decision tree."
CiviServ's README describes decision trees as a way to guide users to
resources through a narrative series of choices.

## QA notes

- Location and provider behaviour (who can edit which location, content
  availability by location) is a mix of CiviServ access checks and CareerForce
  overrides; see [site-wide-behavior.md](site-wide-behavior.md#access-checks)
  and [../locations/](../locations/).
- If a bug traces into `web/modules/custom/civiserv` or `dismae`, the fix goes
  in the separate PWW repository and the submodule pointer must be updated in
  CareerForce.

## Related

- [logging-and-auditing.md](logging-and-auditing.md)
- [../accounts/](../accounts/), [../locations/](../locations/)
- [../jobs-and-careers/](../jobs-and-careers/)
