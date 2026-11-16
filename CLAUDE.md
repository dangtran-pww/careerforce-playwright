# CareerForce Playwright: notes for Claude

See README.md for the project layout and rules.

## Test plan rules

The rules for writing plans in `test-suites/` are in
`.claude/rules/test-plans.md`, which loads when you work on files in
`test-suites/`. Read it before writing or changing a plan.

The user adds plan rules over time. When they give a new one, add it in
all of these places in the same change:

- the rules table and a "Rule N" section in `test-suites/README.md`;
- a one-line summary in the numbered list in `.claude/rules/test-plans.md`,
  with the same number;
- a check in `RULES` in `scripts/check-plans.mjs`, if a script can check it;
- then run `npm run check:plans` and offer to bring existing plans in line.

## Browsers outside the test runner

Any browser you start outside `npx playwright test` (a one-off script, a
quick check with `chromium.launch()`) must block the same hosts as the
tests: import `hostResolverRules` from `tests/helpers/blocked-hosts.mts` and
launch with ``args: [`--host-resolver-rules=${hostResolverRules}`]``. Never
open a CareerForce site in a bare `chromium.launch()`: its visits would
count as real traffic (and as ad conversions) in Google Analytics, Google
Ads and LinkedIn on whichever environment it hits. Prefer the project's own
scripts (`npm run browser`, the test runner) when they fit.
