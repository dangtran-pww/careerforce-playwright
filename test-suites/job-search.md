# [Suite] - Job Search

In-depth checks of the Job Search feature (`/job-search`), in four parts:
search, sort/filters/paging, a single posting with phone layout and
accessibility, and everything a logged-in job seeker can do. The read-only
part of `smoke-job-search` (search, results and filters) is in the Smoke
suite.

**Order:** 2

## Plans

Parts 1 to 3 run as a visitor and are safe on Production. Part 4 needs a
`jobseeker` login (`npm run login:manual -- jobseeker`) and, apart from
PV-4 and PV-5, runs on QA and Stage only. Until a plan's tests are generated,
the dashboard lists it as "No tests yet" and skips it.

| Plan | Projects |
|---|---|
| functional-job-search-search | (default) |
| functional-job-search-sort-filters-paging | (default) |
| functional-job-search-posting-accessibility | (default) |
| functional-job-search-logged-in | (default) |

## Prompts

Read-only checks Claude does as the job seeker (`jobseeker` login). The
suite runner keeps prompts read-only, so the full logged-in session, which
saves, bookmarks and cleans up, is run by hand from
`docs/prompts/job-search-part-4-logged-in.md`.

| ID | Prompt |
|---|---|
| PR-1 | [job-search-jobseeker-tools](prompts/job-search-jobseeker-tools.md) |
| PR-2 | [job-search-jobs-for-me](prompts/job-search-jobs-for-me.md) |
