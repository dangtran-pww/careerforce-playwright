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

## Production only when asked

Don't touch Production (`https://careerforce.mn.gov`) unless the user
explicitly asks for it in that request. That covers test runs
(`BASE_URL=https://careerforce.mn.gov`, `--env prod`), one-off scripts,
API requests, page visits and "compare with Prod" checks, even read-only
ones. QA is the default. To check whether a problem is older than a
change, compare with Stage or the app's git history. If only Prod can
answer the question, ask first.

## Running Playwright tests

Run `npx playwright test ...` as a single command from the project root:
no `cd ... &&`, no pipes (`| grep`, `| tail`), no redirects, and no
variables in front (`BASE_URL=... npx playwright test`,
`SCREENSHOT=on ...`). Any of these keeps the call in the sandbox. The run
uses the environment set in `.env` (QA by default). To run against
another environment, ask the user first; don't add `BASE_URL=` to the
command. Use `--reporter=line` to keep the output short.

Why: Chromium ignores the Bash
sandbox's network proxy, so inside the sandbox every page fails with
`net::ERR_INTERNET_DISCONNECTED`. Only a call that is exactly
`npx playwright ...` matches `excludedCommands` in `.claude/settings.json`
and runs outside the sandbox; a combined command stays inside it. If you
see that error, rerun the command in this form. Adding hosts with
`allowed_domains` won't help.

## Browsers outside the test runner

Any browser you start outside `npx playwright test` (a one-off script, a
quick check with `chromium.launch()`) must block the same hosts as the
tests: import `hostResolverRules` from `tests/helpers/blocked-hosts.mts` and
launch with ``args: [`--host-resolver-rules=${hostResolverRules}`]``. Never
open a CareerForce site in a bare `chromium.launch()`: its visits would
count as real traffic (and as ad conversions) in Google Analytics, Google
Ads and LinkedIn on whichever environment it hits. Prefer the project's own
scripts (`npm run browser`, the test runner) when they fit.
