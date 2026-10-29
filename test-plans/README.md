# Test plans

This folder holds written test plans, not runnable tests.

Playwright runs the code in `tests/` (`testDir: './tests'` in
`playwright.config.ts`), so nothing in this folder is executed. These plans
are the human-readable source that test scripts are generated from, and the
record of what is already covered.

## Status on every plan

Every plan in this folder must start with a status and, when it exists, a
link to its test script. Do not delete a plan when it is implemented —
update its status instead, so this folder stays a catalogue of both what is
waiting and what is covered.

The status answers one question: does the test file currently match this
plan? If not, what kind of work is needed to make it match again?

- `ready to generate` — no test script exists yet. The plan is ready for
  Claude or a developer to turn into a test script. Adding cases to a plan
  in this status changes nothing — it stays ready to generate.

  ```md
  Status: ready to generate
  Implemented test: —
  ```

- `partially implemented` — some cases in the plan are implemented, and new
  cases have been added that are waiting to be generated. List only the
  pending cases, so the generator generates those and does not regenerate
  the cases that are already done.

  ```md
  Status: partially implemented
  Implemented test: tests/smoke/anonymous/listings.spec.ts
  Pending cases: LV-4, LV-5 — ready to generate
  ```

- `needs update` — cases that are already implemented have changed, so
  their test file no longer matches the plan. List exactly which cases
  changed and what changed, and update the existing test file — do not
  create a duplicate file. If a plan has both new cases and updated cases,
  use this status and separate the two lists in the pending note.

  ```md
  Status: needs update
  Implemented test: tests/smoke/anonymous/home.spec.ts
  Updated cases: HP-1 — homepage headings changed from 8 to 7
  Pending cases: HP-5 — ready to generate
  ```

  Exception: if a change is only wording in the plan — a typo or a
  clearer description, with no change to steps, data, or expected
  results — the test does not need to change, and the status stays
  `implemented`.

- `implemented` — the test script exists, has been verified, and matches
  every case in the plan. List its path so anyone can find the code from
  the plan. After pending cases are generated, or updated cases are
  updated, the status returns to `implemented` (or stays
  `partially implemented` / `needs update` if work still remains).

## Writing a new plan

Use the plain-language case form: one journey per plan, the role, the
starting URL, GIVEN / WHEN / THEN with a visible result, any unique test
data needed, and cleanup. Keep it in plain language — no code is needed
here. See the phase-1 plan below for a worked example.

## Smoke plans

Smoke tests run after every deploy, including on production. A smoke run
means every case in every `smoke-*.md`, and one command runs them
all:

```bash
npm run test:smoke                              # all smoke plans
npx playwright test tests/smoke/admin-reports   # one plan
```

Conventions:

- **Naming:** `test-plans/smoke-<area>.md` ↔ `tests/smoke/<area>/`.
  Every spec from a smoke plan lives under `tests/smoke/`, and nothing else
  does. The `smoke` Playwright project runs that folder.
- **Read-only and prod-safe:** no creating, editing, or deleting. Tests that
  write data belong outside `tests/smoke/`.
- **Login is per spec, not per project:** a plan that needs a logged-in role
  sets `test.use({ storageState: 'playwright/.auth/<role>.json' })` on each
  `describe` block. Run `npm run login:manual -- <role>` first.

Adding a new smoke plan:

1. Write `test-plans/smoke-<area>.md` with `Status: ready to generate`.
2. Generate its specs into `tests/smoke/<area>/`, with
   `tests/seed.spec.ts` as the seed.
3. Update the status and the list below. No config change is needed.

## Stage plans

Stage plans are Phase 2 of `docs/deed-smoke-test-plan.md`: interactive
flows that create, edit, or delete data. They need no test inbox and no
LoginMN.

```bash
npm run test:stage                                 # all stage plans
npx playwright test tests/stage/content-lifecycle  # one plan
```

Conventions:

- **Naming:** `test-plans/smoke-<area>.md` ↔ `tests/stage/<area>/`.
  A `stage` Playwright project runs that folder.
- **Clean up in `finally`:** every test deletes or reverts what it created,
  even when an assertion fails. Created content is titled
  `Playwright test <timestamp>`.
- **Serial:** tests share accounts (especially the job seeker), so keep
  `workers: 1`.
- **Synthetic data only:** fixture files live in `tests/fixtures/`; no real
  names, contact details, DOBs, or SSNs.
- **Login is per spec:** same as smoke — `test.use({ storageState })` with
  the `jobseeker`, `content-manager`, or `admin` session from
  `npm run login:manual -- <role>`.

The `stage` project, `test:stage` script, and fixtures are
added with the first stage spec that is generated.

## Plans

- `smoke-anonymous.md` — Status: implemented.
  Implemented tests: `tests/smoke/anonymous/*.spec.ts`.
- `smoke-admin-reports.md` — Status: implemented.
  Implemented test: `tests/smoke/admin-reports/admin-reports.spec.ts`.
- `smoke-admin-maintenance.md` — Status: ready to generate.
  Permissions rebuild, search-api rebuild tracking and reindex.
- `smoke-content-lifecycle.md` — Status: ready to generate.
  Publish/unpublish, revisions, translation.
- `smoke-ckeditor.md` — Status: ready to generate.
- `smoke-media.md` — Status: ready to generate.
- `smoke-block-placement.md` — Status: ready to generate.
- `smoke-job-search.md` — Status: ready to generate.
  Filters, saved searches, dashboard management.
- `smoke-jobseeker-tools.md` — Status: ready to generate.
  Skills Matcher / Interest Profiler / Employment Readiness as a job seeker.
- `smoke-resume-builder.md` — Status: ready to generate.
- `smoke-profile.md` — Status: ready to generate.
  Job seeker and admin profile edits.
