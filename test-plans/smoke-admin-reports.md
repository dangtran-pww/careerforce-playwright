# [Smoke] - Admin Reports - Test Plan

**Status: implemented.** All 3 cases are written and verified against a real
admin session on QA — see `tests/smoke/admin-reports/admin-reports.spec.ts`,
`tests/helpers/known-issues.ts`, and `tests/helpers/environment.ts`.
AR-1 currently fails on QA (a real, unallowlisted status-report error) — see
"Implementation notes" below; this is the test correctly catching it, not a
bug in the test.
Implemented test: `tests/smoke/admin-reports/admin-reports.spec.ts`

Split out from [deed-smoke-test-plan.md](../docs/deed-smoke-test-plan.md) /
[smoke-anonymous.md](smoke-anonymous.md).
Covers read-only admin report checks that need a logged-in admin session, as
opposed to the anonymous plan's fully-anonymous suite.

## Running it

One-time setup — generate the admin session (SSO login, by hand):

```bash
npm run login:manual -- admin
```

A plain Chrome window opens to the login page. Click "PWW Staff Log In",
complete the Google sign-in, and once you're back on the site logged in,
return to the terminal and press Enter. This saves
`playwright/.auth/admin.json` (see `scripts/login-manual.mjs`); re-run it
whenever that session expires.

Then run the cases:

```bash
npx playwright test tests/smoke/admin-reports
```

These cases are part of the `smoke` project, so `npm run test:smoke` runs
them along with every other smoke plan. The admin `storageState` is set at
the top of the spec file, so each case is listed on its own (no
`describe` group).

To run a single case, add `-g`, e.g. `-g "AR-1"`.

## Scope

- Read-only: no content created, edited, or search indexes rebuilt/reindexed.
- Requires an authenticated admin session — these cases cannot run
  anonymous. They still run in the
  `smoke` project; the session is set per spec file, not per project.
- Runs against any single environment via `BASE_URL`, same as phase 1.

## Persona / fixtures

- **Admin** — reuse the existing `admin` storageState
  (`playwright/.auth/admin.json`), generated via `npm run login:manual -- admin`
  (see `scripts/login-manual.mjs`). No dedicated least-privilege "reports-viewer" role for v1 —
  see open question 3 below on the implications of that choice.

## Test cases

| ID | Title | Persona | Steps | Assertions | Notes |
|---|---|---|---|---|---|
| AR-1 | Status report has no new errors | Admin | `goto('/admin/reports/status')` | "Status report" heading visible; every row whose severity is "Error" has its title present in the known-issues allowlist for the current environment (e.g. Solr "Content" error); any "Error" row *not* in the allowlist fails the test | Needs `tests/helpers/known-issues.ts` — an allowlist of accepted errors/warnings, keyed by env, so new errors fail the test instead of being silently accepted. Ownership of updating it is still open (see below). |
| AR-2 | Translations warning matches environment | Admin | `goto('/admin/reports/translations')` | Warning banner/text visible on stage and prod; absent on QA | Env-conditional: stage behaves like prod, not QA — use `isStage(baseUrl) || isProd(baseUrl)` from `tests/helpers/environment.ts`. Confirm stage's exact hostname pattern when generating (see open question 2). |
| AR-3 | Search index item counts are sane | Admin | `goto('/admin/config/search/search-api')` | Each of the 4 indexes — Appointment Occurrences, Events More Like This, General site content index, Occupations — shows an indexed item count > 0 and no error/red status indicator | Read-only — do **not** trigger "Index now" here, that belongs to the search-api maintenance suite (`docs/deed-smoke-test-plan.md` §3, stage/QA only) |

## Implementation notes

Written against a real admin session (`playwright/.auth/admin.json`) on
qa.careerforce.link, Drupal 11.4 / Claro theme:

- **AR-1 selectors corrected.** The real status-report row is
  `.system-status-report__row`, containing
  `.system-status-report__status-icon--error` and a
  `.system-status-report__status-title` (not `__entry--error` /
  `__summary`, which don't exist in this Drupal version's markup).
- **AR-1 currently fails on QA**, and correctly so: the status report shows
  1 error, "Entity/field definitions" ("The Context entity type needs to be
  installed"), which is not the Solr "Content" error `known-issues.ts`
  allowlists — it's a different, currently-unallowlisted error. Left out of
  the allowlist deliberately (see open question 1); someone needs to either
  fix the underlying issue or decide to allowlist it.
- **AR-1 status report errors on QA** (captured 2026-10-29). Only errors
  are asserted; warnings are ignored.

  | Title | Detail |
  |---|---|
  | Entity/field definitions | Mismatched entity and/or field definitions — the Context entity type needs to be installed. **Fails AR-1** (not allowlisted). |

  The Solr "Content" error allowlisted in `known-issues.ts` did not appear
  in this run.
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

- `/admin/reports/dblog` (recent log messages) — `docs/deed-smoke-test-plan.md`
  §1 flags this as needing human judgment on what counts as a regression;
  stays a manual check, not automated here.
- Search-api reindex / "Index now" actions — stage/QA only
  (`docs/deed-smoke-test-plan.md` §3).
- `/admin/reports/status/rebuild` (permissions rebuild) — stage/QA only,
  triggers a write action (`docs/deed-smoke-test-plan.md` §9).
- Admin/customer-support profile edit views (`docs/deed-smoke-test-plan.md`
  §22) — different persona, not read-only, out of scope here.

## Open questions before writing code

1. **Known-issues allowlist ownership**: who owns updating
   `tests/helpers/known-issues.ts` when a new "known, ok to ignore"
   error/warning shows up (Solr Content error today)? Needs a clear owner so
   AR-1 doesn't bit-rot into either false failures or a rubber-stamp pass.
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
    admin-reports.spec.ts # AR-1..AR-3, storageState: playwright/.auth/admin.json
                          # (generate via `npm run login:manual -- admin`)
  helpers/
    known-issues.ts       # allowlist of accepted status-report errors/warnings, keyed by env
```
