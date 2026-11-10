# [Suite] - Job Search

In-depth checks of the Job Search feature (`/job-search`) as a visitor who
isn't logged in, on desktop and on a phone. Read-only and prod-safe, but it
makes too many searches for the post-deploy smoke run, so it runs on its own.

**Order:** 2

## Plans

Read-only plans only. `smoke-job-search` (saved searches as a job seeker)
changes data, so it doesn't belong here: one Stage plan would stop this suite
from running on Production.

| Plan | Projects |
|---|---|
| job-search | functional-desktop, functional-mobile |
