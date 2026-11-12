# [Suite] - Smoke

The smoke check: every smoke plan, with their prompt cases (such as the
homepage comparison HP-5). On Production the dashboard skips the no-prod
plans and leaves out the no-prod cases of the others (see
[Keeping tests off Production](../test-plans/README.md#keeping-tests-off-production)).

**Order:** 1

## Plans

The no-prod plans and cases have their tests in `tests/smoke/` like the
rest, tagged `@no-prod`; the ones that change data run on desktop only. A
plan with no tests yet is listed with `(default)` projects, shown as "No tests
yet" and skipped.

| Plan | Projects |
|---|---|
| smoke-public-site | smoke-desktop, smoke-mobile |
| smoke-job-search | smoke-desktop, smoke-mobile |
| smoke-admin-reports | smoke-desktop |
| smoke-admin-maintenance | smoke-desktop |
| smoke-block-placement | (default) |
| smoke-ckeditor | (default) |
| smoke-content-lifecycle | (default) |
| smoke-jobseeker-tools | (default) |
| smoke-media | (default) |
| smoke-profile | (default) |
| smoke-resume-builder | (default) |
