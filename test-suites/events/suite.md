# [Suite] - Events

In-depth checks of the Events feature, in five parts: search and detail
pages, scheduling (admin), registration (job seeker), attendees (staff) and
external submissions. Parts 1 and 2 are written so far. The quick
post-deploy event checks are in the Smoke suite (smoke-events).

**Order:** 4

## Plans

Part 1 runs as a visitor and is safe on Production. Part 2 changes data as
`admin` (and `jobseeker`), so it is a no-prod plan that runs on QA and Stage
only, on desktop. Until a plan's tests are generated, the dashboard lists it
as "No tests yet" and skips it.

| Plan | Projects |
|---|---|
| functional-events-search-detail | (default) |
| functional-events-scheduling | (default) |
