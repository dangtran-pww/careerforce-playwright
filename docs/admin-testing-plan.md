# Admin Testing Plan

Split out from [deed-smoke-test-plan.md](deed-smoke-test-plan.md) /
[phase1-read-only-smoke-test-plan.md](phase1-read-only-smoke-test-plan.md).
Covers checks that need a logged-in admin/reports-viewer session, as opposed
to Phase 1's fully-anonymous suite.

## Scope

Read-only admin report checks — no writes, but requires authentication,
which is why they're split from Phase 1 rather than grouped with the
anonymous smoke suite.

## Test cases

| ID | Title | Persona | Steps | Assertions | Notes |
|---|---|---|---|---|---|
| PH-1 | Status report has no new errors | Admin/reports-viewer | `goto('/admin/reports/status')` | Heading visible; every row flagged "Error" is in a known-issue allowlist (e.g. Solr *Content* error) | Needs an explicit allowlist file so new errors fail the test instead of being silently accepted |
| PH-2 | Translations warning matches environment | Admin/reports-viewer | `goto('/admin/reports/translations')` | Warning present on stage/prod, absent on QA | Env-conditional; build alongside PH-1's allowlist pattern |
| SR-3 | Search index item counts are sane | Admin/reports-viewer | `goto('/admin/config/search/search-api')` | General and Occupation indexes show non-zero indexed counts | Read-only — do **not** trigger "Index now" here, that belongs with the search-api maintenance suite (stage/QA only) |

## Open questions before writing code

1. **Reports-viewer account**: should these reuse the existing `editor`
   session, or is it worth creating a dedicated low-privilege role that can
   only view `/admin/reports/*` and `/admin/config/search/search-api` —
   least-privilege, and safe to run on prod without carrying an editor's
   write permissions into a prod test run?
2. **Known-issues allowlist**: who owns updating it when a new "known, ok to
   ignore" error shows up (Solr Content error today)? Needs a clear owner so
   PH-1 doesn't bit-rot into either false failures or a rubber-stamp pass.

## Suggested files

```
tests/
  smoke-admin.spec.ts    # PH-1, PH-2, SR-3
  helpers/
    known-issues.ts      # allowlist of accepted status-report errors/warnings, keyed by env
```
