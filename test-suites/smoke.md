# [Suite] - Smoke

The post-deploy smoke check: the smoke plans and a few checks Claude does by
looking at the pages. Read-only and prod-safe.

**Order:** 1

## Plans

Read-only plans only. Stage plans (test-plans/README.md → Stage plans), such
as the job seeker tools and profile plans, change data, so they go in a
suite of their own that never targets Production. A plan with no tests yet
is shown as "No tests yet" and skipped.

| Plan | Projects |
|---|---|
| smoke-anonymous | smoke-desktop, smoke-mobile |
| smoke-admin-reports | smoke-desktop |

## Prompts

| ID | Prompt |
|---|---|
| PR-1 | [homepage-layout](prompts/homepage-layout.md) |
| PR-2 | [main-menu-landing-pages](prompts/main-menu-landing-pages.md) |
| PR-3 | [admin-content-list](prompts/admin-content-list.md) |
