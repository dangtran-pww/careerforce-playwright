---
paths:
  - "test-suites/**"
---

# Test plan rules

Plans live in their suite's folder, `test-suites/<suite>/<plan>.md`, next to
the suite's `suite.md` (see "Layout" in `test-suites/README.md`). A new plan
goes in its suite's folder and in that suite's Plans table.

Whenever you write or change a plan in `test-suites/`, follow every rule in
"Plan writing rules" in `test-suites/README.md`. In short:

1. **Steps and Expected result cells:** more than one action is numbered
   `1. … 2. …`; more than one check is numbered the same way, `1. … 2. …`
   (no bold numbers), and item N is the result of step N. Preconditions and notes go before `1.`,
   `**Cleanup:** …` goes last, and numbers run 1, 2, 3 with no gaps.
2. **Prompt cases:** a check that needs judgement (e.g. layout compared
   with another site) is a prompt case. It is not in the test case table:
   it goes in its own table under `## Prompt cases`, columns
   `ID | Test | Prompt` (plus `Prod` if needed), where the Prompt cell is
   only `[<name>](prompts/<name>.md)`. Everything else is in
   `test-suites/<suite>/prompts/<name>.md` (in the plan's own suite):
   `**Role:**`, optional `**Compare with:**`, `**Viewports:**` and
   `**Screenshots:**`, optional `**Accessibility scan:** yes` (an
   accessibility journey: every page it reaches is scanned with axe), a
   `## Prompt` section and a `## Expected result` section. It has no test code.
3. **Parallel:** a plan (`Parallel: yes` in its header) or a prompt file
   (`**Parallel:** yes`) runs alongside other work only when it only reads
   the site and nothing it checks depends on other tests. Anything else
   runs on its own. A Parallel plan can't be `Prod: No` or have no-prod
   cases.
4. **Case IDs:** every case ID is unique across all plans: a prefix of 2–4
   capital letters, `-`, a number from 1 (`SS-1`). A prefix belongs to one
   plan only; grep `test-suites/` before picking one, and a new case takes
   the next number.
5. **One test case table:** all of a plan's test cases are in one table
   under `## Test cases`, and its prompt cases in one table under
   `## Prompt cases`, with no `###` area headings. Notes that a group of
   cases share go in a paragraph above the table.
6. **No site password gate:** plans don't mention QA and Stage's Basic Auth
   pop-up or `BASIC_AUTH_*`; the README's one-time setup covers it.
7. **Overview first:** after the header lines, the first paragraph says
   what the plan tests and why, under `## Overview`. Sources and other
   notes come after it.
8. **Plan sections:** plain header lines (`Status: implemented`, no bold,
   only the status), then these `##` sections in this order, leaving out
   empty optional ones: Overview\*, Login\*, Checked in every case, Test
   cases\*, Prompt cases, Test data, Good to know, Mobile\*, Not covered,
   Open questions, Files (\* required). Test case columns are `ID | Test |
   Page | Steps | Expected result` (+ `Required login`, `Prod`). Devices go
   in `## Mobile`, not a `Devices:` line. No table starts with an empty
   header row (`| | |`). `## Files` only while the plan isn't
   `implemented`; remove it once it is.
9. **Links to other plans:** no link text, `[](smoke-ckeditor.md)` or
   `[](../events/<plan>.md#login)`; the dashboard shows the plan's title.
   Other links (tickets, README, prompts, `#sections`) keep their text.

Then run `npm run check:plans` and fix every problem it reports in the
plans you touched before you finish.
