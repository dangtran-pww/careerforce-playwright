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
| smoke-public-site | desktop, mobile |
| smoke-job-search | desktop, mobile |
| smoke-jobseeker-tools | desktop, mobile |
| smoke-profile | desktop |
| smoke-events | desktop, mobile |
| smoke-appointments | (default) |
| smoke-resume-builder | (default) |
| smoke-admin-reports | desktop |
| smoke-admin-maintenance | desktop |
| smoke-block-placement | desktop |
| smoke-ckeditor | desktop |
| smoke-content-lifecycle | desktop |
| smoke-external-events | desktop, mobile |
| smoke-alerts | desktop |
| smoke-auto-logout | desktop |
| smoke-media | desktop |
