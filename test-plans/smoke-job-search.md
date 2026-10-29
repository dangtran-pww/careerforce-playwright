# [Stage] - Job Search - Test Plan

Status: ready to generate
Implemented test: —

Split out from [deed-smoke-test-plan.md](../docs/deed-smoke-test-plan.md)
§12, Phase 2.

## Running it

```bash
npm run login:manual -- jobseeker
BASE_URL=https://qa.careerforce.link npx playwright test tests/stage/job-search
```

## Scope

- Saves searches on the job seeker account and deletes them
  in `finally`.
- Saved search names are unique: `Playwright test <timestamp>`.
- Job results come from an external feed, so assert "results exist" and
  "filters narrow results", never exact counts.

## Persona / fixtures

- **Job seeker** — `playwright/.auth/jobseeker.json`. Ideally a dedicated
  test account (open question 2).

## Test cases

| ID | Title | Persona | Steps | Assertions | Notes |
|---|---|---|---|---|---|
| JS-1 | Keyword and location search | Job seeker | `goto('/job-search')`, keyword "nurse", location "Saint Paul, MN", search | Result count > 0; each of the first few results shows a job title | |
| JS-2 | Filters narrow results | Job seeker | From JS-1's results, data-driven over each filter group on the page (e.g. distance, job type, date posted): apply one option, then clear it | With a filter applied: count ≤ unfiltered count and the filter shows as active. After clearing: count is back to the unfiltered count | The filter list is confirmed during generation |
| JS-3 | Save a search | Job seeker | Run JS-1's search, click "Save search", name it uniquely, confirm | Confirmation shown; the search is listed in "My job search" on the dashboard (`/user/<uid>`) | |
| JS-4 | Run a saved search from the dashboard | Job seeker | On the dashboard, open the search saved in JS-3 | Lands on `/job-search` with the saved keyword and location filled in, and results > 0 | |
| JS-5 | Edit and delete a saved search | Job seeker | On the dashboard, rename the saved search (if supported), then delete it | The new name is shown; after delete the search is no longer listed | Rename is optional if the UI doesn't offer it |

## Non-goals

- Anonymous "save search" → LoginMN modal → account creation (§20) —
  needs the LoginMN sandbox, Phase 3.
- Job posting detail pages and apply links — leave the site.

## Open questions

1. Is the job feed populated at all times? If it is sometimes
   empty, JS-1 needs a fallback keyword list.
2. Dedicated job seeker test account, so these tests don't
   delete a human tester's saved searches?

## Suggested files

```
tests/
  stage/job-search/
    job-search.spec.ts     # JS-1, JS-2
    saved-search.spec.ts   # JS-3 .. JS-5
  pages/
    job-search.page.ts
    dashboard.page.ts      # shared with the tools / resume / profile plans
```
