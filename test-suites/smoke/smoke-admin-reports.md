# [Smoke] - Admin Reports - Test Plan

Status: implemented
Implemented test: tests/smoke/admin-reports/admin-reports.spec.ts

## Overview

A quick check after each deploy, as a logged-in admin, that the site's admin
reports look healthy: the status report has no errors, its translations
warning matches the environment, and every search index has indexed items.

Every case only reads, so the plan runs on QA, Stage and **Production**.

## Login

| **Every case** | Admin role |
|---|---|

## Test cases

All 3 cases are in `admin-reports.spec.ts`. "Page" is the address after the
site name.

| ID | Test | Page | Steps | Expected result |
|---|---|---|---|---|
| AR-1 | Status report has no errors | `/admin/reports/status` | Open the status report. | 1. The "Status report" heading shows. 2. No row has the severity "Error". Any error row fails the case, with its title in the message. Warnings are not checked. |
| AR-2 | Translations warning matches the environment | `/admin/reports/translations` | Open the translations report. | A warning message shows on Stage and Production, and none on QA. |
| AR-3 | Search indexes have indexed items | `/admin/config/search/search-api/index/<index>` | Open each of the 4 index pages in [Search indexes for AR-3](#search-indexes-for-ar-3). | Each index shows an indexed item count above 0 ("4494/4494 indexed") and no error status. |

## Test data

### Search indexes for AR-3

| Index | Page |
|---|---|
| Appointment Occurrences | `/admin/config/search/search-api/index/appointment_occurrences` |
| Events More Like This | `/admin/config/search/search-api/index/events_mlt` |
| General site content index | `/admin/config/search/search-api/index/general_site_content` |
| Occupations | `/admin/config/search/search-api/index/occupations` |

## Good to know

Checked on QA with the admin session (Drupal 11.4, Claro theme).

- **AR-1 has no allowlist.** Every status report error fails it, known or
  not, until it is fixed (decided 2026-11-12).
- **AR-1 fails on QA today**, correctly: on 2026-10-29 the status report
  showed 1 error, "Entity/field definitions" ("The Context entity type needs
  to be installed"). The Solr "Content" error seen earlier didn't appear.
- **Stage behaves like Production for AR-2**, not like QA: both show the
  translations warning. The test tells the environments apart with
  `isStage` and `isProd` from `tests/helpers/environments.mjs`.
- **The search-api overview page has no item counts.** Its table only has
  Type, Name, Status and Operations, so AR-3 opens each index's own page,
  where the count and the index's status are.
- **AR-3 never clicks "Index now".** Reindexing is in
  [](smoke-admin-maintenance.md), QA and Stage
  only.
- **The old AR-2** (a visitor can't open the admin reports) was removed as
  not needed, and the later cases renumbered.

## Mobile

Desktop only. Admin and editor screens are not tested on a phone
(`admin-reports` is in `DESKTOP_ONLY_SMOKE_AREAS` in
`tests/helpers/devices.mts`).

## Not covered

- **Recent log messages** (`/admin/reports/dblog`): deciding which messages
  are a regression needs judgement, so it stays a manual check.
- **Reindexing and the permissions rebuild:** they change the site, so they
  are in [](smoke-admin-maintenance.md), QA and
  Stage only.
- **Profile edits by an admin:** [](smoke-profile.md).

## Open questions

1. **Full admin rights on Production.** The plan uses the `admin` session,
   which can change the site, on every environment, Production included.
   Every case only reads, and must stay that way. Should there be a
   read-only role for this plan instead?
