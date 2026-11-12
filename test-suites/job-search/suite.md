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
