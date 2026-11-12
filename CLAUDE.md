# CareerForce Playwright: notes for Claude

See README.md for the project layout and rules.

## Test plan rules

Whenever you write or change a plan in `test-plans/`, follow every rule in
"Plan writing rules" in `test-plans/README.md`. In short:

1. **Steps and Expected result cells:** more than one action is numbered
   `1. … 2. …`; more than one check is numbered `**1.** … **2.** …`, and
   item N is the result of step N. Preconditions and notes go before `1.`,
   `**Cleanup:** …` goes last, and numbers run 1, 2, 3 with no gaps.
2. **Prompt cases:** a check that needs judgement (e.g. layout compared
   with another site) is a prompt case: its Steps cell starts with
   `**Prompt:** [<name>](prompts/<name>.md)`, and `test-plans/prompts/<name>.md`
   has `**Role:**`, optional `**Compare with:**`, `**Viewports:**` and
   `**Screenshots:**`, and a `## Prompt` section. It has no test code.

Then run `npm run check:plans` and fix every problem it reports in the
plans you touched before you finish.

The user adds rules over time. When they give a new one, add it in all of
these places in the same change:

- the rules table and a "Rule N" section in `test-plans/README.md`;
- a one-line summary in the list above, with the same number;
- a check in `RULES` in `scripts/check-plans.mjs`, if a script can check it;
- then run `npm run check:plans` and offer to bring existing plans in line.
