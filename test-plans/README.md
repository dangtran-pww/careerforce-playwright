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

- `ready to generate` — the plan is ready for Claude or a developer to turn
  into a test script. No test script exists yet.

  ```md
  Status: ready to generate
  Implemented test: —
  ```

- `implemented` — the test script exists and has been verified. List its
  path so anyone can find the code from the plan.

  ```md
  Status: implemented
  Implemented test: tests/smoke/listings-search.spec.ts
  ```

## Writing a new plan

Use the plain-language case form: one journey per plan, the role, the
starting URL, GIVEN / WHEN / THEN with a visible result, any unique test
data needed, and cleanup. Keep it in plain language — no code is needed
here. See the phase-1 plan below for a worked example.

## Plans

- `phase1-read-only-smoke-test-plan.md` — Status: implemented.
  Implemented tests: `tests/smoke/*.spec.ts`.
