# [Stage] - Admin Maintenance - Test Plan

Status: ready to generate
Implemented test: —

Split out from [deed-smoke-test-plan.md](../docs/deed-smoke-test-plan.md)
§3 (search-api maintenance) and §9 (permissions rebuild), Phase 2. These
are the admin write actions that the
[admin reports plan](smoke-admin-reports.md) deliberately leaves
out because they change site state.

## Running it

```bash
npm run login:manual -- admin
BASE_URL=https://qa.careerforce.link npx playwright test tests/stage/admin-maintenance
```

Runs in the `stage` project (see
[README → Stage plans](README.md#stage-plans)).

## Scope

- Rebuilding tracking and reindexing temporarily empties search results
  for that index.
- **Run off-peak.** Occupations is ~26k items; a full reindex takes minutes.
  Give these tests a much longer per-test timeout than the 60s default.
- Not part of every run by default — see open question 2.

## Persona / fixtures

- **Admin** — `playwright/.auth/admin.json`.
- No test data created.

## Test cases

| ID | Title | Persona | Steps | Assertions | Notes |
|---|---|---|---|---|---|
| AM-1 | Permissions rebuild completes | Admin | `goto('/admin/reports/status/rebuild')`, click "Rebuild permissions", wait for the batch page to finish | Success message (e.g. "Content permissions have been rebuilt") visible; no error messages | Source checklist: "should complete successfully with no errors/issues" |
| AM-2 | Rebuild tracking and reindex, per index | Admin | Data-driven over the 4 indexes below. For each: `goto('/admin/config/search/search-api/index/<machine-name>')` → "Rebuild tracking information" → confirm → "Index now" → wait for the batch to finish | After rebuild tracking: success message, and the progress shows `0/<N> indexed` with N > 0. After Index now: batch success message; progress shows `N/N indexed`; no error status row | Rebuild and reindex stay in one test per index so a failure never leaves an index empty and unnoticed. Read counts with the same selectors AR-3 uses (`.search-api-index-status .progress__description`, `.search-api-index-summary--status`) |
| AM-3 | Site search works after reindex | Admin | After AM-2, run a site search for "job fair" (reuse `SearchPage`) | Result count > 0 | Confirms the General index is usable again, not just "indexed" |

Indexes for AM-2:

| Index | Machine name |
|---|---|
| Appointment Occurrences | `appointment_occurrences` |
| Events More Like This | `events_mlt` |
| General site content index | `general_site_content` |
| Occupations | `occupations` |

Source-checklist reference counts (at the time of writing — not asserted,
counts change with content): General 4351/4351, Occupations 26471/26471.

## Non-goals

- Reviewing `/admin/reports/dblog` after the run — stays manual.

## Open questions

1. Does the "Index now" batch run in the browser, or is it
   handed off to cron/queue? If it's queued, AM-2 needs to poll the index
   page instead of waiting on a batch page.
2. Cadence: run on every deploy, or only on demand / nightly given the
   reindex time? Suggest tagging these tests `@slow` and excluding them
   from the default run.

## Suggested files

```
tests/
  stage/admin-maintenance/
    permissions.spec.ts   # AM-1
    search-api.spec.ts    # AM-2, AM-3
  pages/
    search-api-index.page.ts   # rebuild tracking, index now, read counts
```
