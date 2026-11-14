# [Smoke] - Admin Reports - Test Plan

**Status: implemented.** All 3 cases are written and verified against a real
admin session on QA — see `tests/smoke/admin-reports/admin-reports.spec.ts`,
and `tests/helpers/environment.ts`.
AR-1 currently fails on QA (a real status-report error) — see
"Implementation notes" below; this is the test correctly catching it, not a
bug in the test.
Implemented test: `tests/smoke/admin-reports/admin-reports.spec.ts`

**Devices: desktop only.** Admin and editor screens are not tested on a phone (`DESKTOP_ONLY_SMOKE_AREAS` in `tests/helpers/devices.mts`).

Split out from [smoke-public-site.md](smoke-public-site.md).
Covers read-only admin report checks that need a logged-in admin session, as
opposed to the anonymous plan's fully-anonymous suite.

## Login

| | |
|---|---|
| **Site login** | Required. Every case runs as a logged-in admin. |
| **Role** | `admin`: a PWW staff Google account that has admin rights on the environment being tested (it must be able to open `/admin/reports/status`). |
| **How to log in** | By hand, once per environment: `npm run login:manual -- admin --env <qa\|stage\|prod>` (without `--env`, it uses the environment `BASE_URL` in `.env` points at). A Chromium window opens on the login page. On QA and Stage, click "PWW Staff Log In" and finish the Google sign-in. On Production, which has no "PWW Staff Log In" button, open "DEED Staff Member", click its "Log In" button and finish the sign-in. The session is saved as soon as you're back on the site, then close the window. The tests can't log in themselves: the sign-in is single sign-on, which blocks a browser Playwright controls. |
| **Saved session** | `playwright/.auth/<env>/admin.json`, one file per environment. A QA session doesn't work on Stage. |
| **When it expires** | Run the login command again. With `--project=smoke-admin-reports`, a check runs first (`tests/setup/admin-session.setup.ts`) and stops with "The saved admin session has expired…" plus the command to run. Run as part of `--project=smoke`, there is no check first, so each case fails on the login page instead. A missing file fails with a storage state / ENOENT error. |
| **Write access** | The admin account can change the site, but every case here is read-only. Keep it that way (see open question 3). |

## Scope

- Read-only: no content created, edited, or search indexes rebuilt/reindexed.
- Requires an authenticated admin session — these cases cannot run
  anonymous. They still run in the
  `smoke` project; the session is set per spec file, not per project.
- Runs against any single environment via `BASE_URL`, same as phase 1.

## Persona / fixtures

- **Admin** — reuse the existing `admin` storageState
  (`playwright/.auth/<env>/admin.json`), generated via `npm run login:manual -- admin`
  (see `scripts/login-manual.mjs`). No dedicated least-privilege "reports-viewer" role for v1 —
  see open question 3 below on the implications of that choice.

## Test cases

| ID | Title | Persona | Steps | Assertions | Notes |
|---|---|---|---|---|---|
| AR-1 | Status report has no errors | Admin | `goto('/admin/reports/status')` | "Status report" heading visible; no row has severity "Error". Any error row fails the test, with its title in the message | No allowlist: an error the team already knows about (e.g. the Solr "Content" error) still fails, until it is fixed. Warnings are not checked. |
| AR-2 | Translations warning matches environment | Admin | `goto('/admin/reports/translations')` | Warning banner/text visible on stage and prod; absent on QA | Env-conditional: stage behaves like prod, not QA — use `isStage(baseUrl) || isProd(baseUrl)` from `tests/helpers/environment.ts`. Confirm stage's exact hostname pattern when generating (see open question 2). |
| AR-3 | Search index item counts are sane | Admin | `goto('/admin/config/search/search-api')` | Each of the 4 indexes — Appointment Occurrences, Events More Like This, General site content index, Occupations — shows an indexed item count > 0 and no error/red status indicator | Read-only — do **not** trigger "Index now" here, that belongs to the [admin maintenance plan](smoke-admin-maintenance.md) (stage/QA only) |

## Implementation notes

Written against a real admin session (`playwright/.auth/<env>/admin.json`) on
qa.careerforce.link, Drupal 11.4 / Claro theme:

- **AR-1 selectors corrected.** The real status-report row is
  `.system-status-report__row`, containing
  `.system-status-report__status-icon--error` and a
  `.system-status-report__status-title` (not `__entry--error` /
  `__summary`, which don't exist in this Drupal version's markup).
- **AR-1 currently fails on QA**, and correctly so: the status report shows
  1 error, "Entity/field definitions" ("The Context entity type needs to be
  installed"). It keeps failing until the error is fixed.
- **AR-1 status report errors on QA** (captured 2026-10-29). Only errors
  are asserted; warnings are ignored.

  | Title | Detail |
  |---|---|
  | Entity/field definitions | Mismatched entity and/or field definitions — the Context entity type needs to be installed. **Fails AR-1.** |

  The Solr "Content" error did not appear in this run.
- **AR-3 reworked to read each index's own page**, not the
  `/admin/config/search/search-api` overview table. That table only has
  Type/Name/Status/Operations columns — no item counts. The indexed count
  (`.search-api-index-status .progress__description`, e.g. "4494/4494
  indexed") and per-index error status
  (`.search-api-index-summary--status` row class) live on
  `/admin/config/search/search-api/index/<machine-name>`. Confirmed machine
  names: `appointment_occurrences` (Appointment Occurrences), `events_mlt`
  (Events More Like This), `general_site_content` (General site content
  index) and `occupations` (Occupations).
- **AR-2 matched the plan as written** — no changes needed.
- **Former AR-2 (anonymous auth-boundary check) removed** as not needed;
  later cases renumbered.

## Non-goals (explicitly out of scope for this plan)

- `/admin/reports/dblog` (recent log messages) — needs human judgment on what counts as a
  regression; stays a manual check, not automated here.
- Search-api reindex / "Index now" actions — stage/QA only
  ([smoke-admin-maintenance.md](smoke-admin-maintenance.md)).
- `/admin/reports/status/rebuild` (permissions rebuild) — stage/QA only,
  triggers a write action
  ([smoke-admin-maintenance.md](smoke-admin-maintenance.md)).
- Admin/customer-support profile edit views
  ([smoke-profile.md](smoke-profile.md)) — different persona, not read-only, out of scope here.

## Open questions before writing code

1. *(Answered 2026-11-12.)* There is no allowlist of accepted errors: AR-1
   fails on every status-report error, known or not, until it is fixed.
2. **Stage vs QA distinction for AR-2**: confirm the exact environments where
   the translations warning is expected (stage + prod) vs not (QA), and
   stage's hostname pattern, before extending `tests/helpers/environment.ts`.
3. **Running on prod with full admin credentials**: this plan reuses the full
   `admin` storageState, which carries write permissions into any prod run,
   even though every case here is read-only in practice. Worth a guard or
   comment reminding future editors this suite must stay read-only despite
   having write-capable credentials, or revisiting a dedicated
   least-privilege role later if that risk becomes a concern.

## Suggested files

```
tests/
  smoke/admin-reports/
    admin-reports.spec.ts # AR-1..AR-3, storageState: playwright/.auth/<env>/admin.json
                          # (generate via `npm run login:manual -- admin`)
```
