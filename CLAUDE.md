# CareerForce Playwright: notes for Claude

See README.md for the project layout and rules.

## Test plan rules

Plans live in their suite's folder, `test-suites/<suite>/<plan>.md`, next to
the suite's `suite.md` (see "Layout" in `test-suites/README.md`). A new plan
goes in its suite's folder and in that suite's Plans table.

Whenever you write or change a plan in `test-suites/`, follow every rule in
"Plan writing rules" in `test-suites/README.md`. In short:

1. **Steps and Expected result cells:** more than one action is numbered
   `1. … 2. …`; more than one check is numbered `**1.** … **2.** …`, and
   item N is the result of step N. Preconditions and notes go before `1.`,
   `**Cleanup:** …` goes last, and numbers run 1, 2, 3 with no gaps.
2. **Prompt cases:** a check that needs judgement (e.g. layout compared
   with another site) is a prompt case: its Steps cell starts with
   `**Prompt:** [<name>](prompts/<name>.md)`, and
   `test-suites/<suite>/prompts/<name>.md` (in the plan's own suite) has
   `**Role:**`, optional `**Compare with:**`, `**Viewports:**` and
   `**Screenshots:**`, optional `**Accessibility scan:** yes` (an
   accessibility journey: every page it reaches is scanned with axe), and
   a `## Prompt` section. It has no test code.
3. **Parallel:** a plan (`Parallel: yes` in its header) or a prompt file
   (`**Parallel:** yes`) runs alongside other work only when it only reads
   the site and nothing it checks depends on other tests. Anything else
   runs on its own. A Parallel plan can't be `Prod: No` or have no-prod
   cases.
4. **Case IDs:** every case ID is unique across all plans: a prefix of 2–4
   capital letters, `-`, a number from 1 (`SS-1`). A prefix belongs to one
   plan only; grep `test-suites/` before picking one, and a new case takes
   the next number.
5. **One test case table:** all of a plan's cases are in one table under
   `## Test cases`, with no `###` area headings. Notes that a group of
   cases share go in a paragraph above the table.
6. **No site password gate:** plans don't mention QA and Stage's Basic Auth
   pop-up or `BASIC_AUTH_*`; the README's one-time setup covers it.

Then run `npm run check:plans` and fix every problem it reports in the
plans you touched before you finish.

The user adds rules over time. When they give a new one, add it in all of
these places in the same change:

- the rules table and a "Rule N" section in `test-suites/README.md`;
- a one-line summary in the list above, with the same number;
- a check in `RULES` in `scripts/check-plans.mjs`, if a script can check it;
- then run `npm run check:plans` and offer to bring existing plans in line.
