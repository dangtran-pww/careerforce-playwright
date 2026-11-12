# [Suite] - Smoke

A quick check after each deploy that the main parts of CareerForce still
work: the public site and Job Search for visitors, a job seeker's tools,
profile and resume, and the admin and editor screens (reports, search
maintenance, blocks, CKEditor, publishing and media).

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
| smoke-block-placement | smoke-desktop |
| smoke-ckeditor | smoke-desktop |
| smoke-content-lifecycle | smoke-desktop |
| smoke-jobseeker-tools | (default) |
| smoke-media | (default) |
| smoke-profile | (default) |
| smoke-resume-builder | (default) |
