# [Suite] - Appointments

In-depth checks of the Appointments feature, in four parts: the public
search, scheduling (admin), booking (job seeker) and attendance (staff).
Part 1 is written so far. The quick post-deploy appointment checks are in
the Smoke suite (smoke-appointments).

**Order:** 5

## Plans

Part 1 runs as a visitor and is safe on Production. The later parts
(functional-appointments-scheduling, functional-appointments-booking,
functional-appointments-attendance) change data, so they will be no-prod
plans. Until a plan's tests are generated, the dashboard lists it as "No
tests yet" and skips it.

| Plan | Projects |
|---|---|
| functional-appointments-search | (default) |
