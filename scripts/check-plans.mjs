// Checks test plans against the rules in test-plans/README.md
// ("Plan writing rules"). Each rule there that can be checked by a script
// has an entry in RULES below, with the same number.
//
// Usage: npm run check:plans [-- test-plans/<plan>.md …]
// With no files, checks every plan in test-plans/. Exits 1 on any problem.
//
// Adding a rule: write it up in the README, then add { id, name, check } to
// RULES. `check` gets one plan (see readPlan) and returns problems as
// { line, caseId?, message }.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PROMPTS_DIR, parallelValue, parsePrompt, promptSlugInCell } from './lib/prompts.mjs';

// ---- Reading a plan --------------------------------------------------------

function cells(line) {
  return line
    .replace(/^\|\s?/, '')
    .replace(/\s?\|\s*$/, '')
    .split(' | ');
}

// The plan's text and lines, and every row of its case tables (tables with
// an ID column) as { line, id, cells: { <column header>: text } }.
function readPlan(file) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const cases = [];
  let header = null;
  lines.forEach((l, i) => {
    if (!l.startsWith('|')) return void (header = null);
    const row = cells(l);
    if (!header) return void (header = row[0] === 'ID' ? row : []);
    if (!header.length || /^:?-+:?$/.test(row[0])) return;
    const byColumn = Object.fromEntries(header.map((h, c) => [h, row[c] ?? '']));
    cases.push({ line: i + 1, id: row[0], cells: byColumn });
  });
  return { file, text, lines, cases };
}

// ---- Helpers for the rules -------------------------------------------------

const MARKER = /(?:^|\s)(?:\*\*(\d+)\.\*\*|(\d+)\.)(?=\s)/g;
const CLEANUP = /\s\*\*Cleanup:\*\*/;

// A cell's numbered items: { count } (0 if it isn't a numbered list), or
// { error }. Like the dashboard (dashboard/src/lib/numbered.ts), a number
// that isn't the next one is plain text ("up to 5. 3. Click"); one past the
// end means an item went missing.
function numbered(text) {
  const nums = [...text.matchAll(MARKER)].map((m) => Number(m[1] ?? m[2]));
  if (!nums.includes(1) || !nums.includes(2)) return { count: 0 };
  let next = 1;
  const skipped = [];
  for (const n of nums) {
    if (n === next) next++;
    else skipped.push(n);
  }
  const count = next - 1;
  if (skipped.some((n) => n > count))
    return {
      error: `numbers run ${nums.join(', ')}; a number is missing, or a "N." in the text reads like an item`,
    };
  return { count };
}

// Sentences, leaving out a closing **Cleanup:** note.
function sentences(text) {
  return text
    .split(CLEANUP)[0]
    .split(/(?<=[.!?]["”)`]?)\s+(?=[A-Z"“`*(])/)
    .filter((s) => s.trim());
}

// ---- The rules -------------------------------------------------------------

const RULES = [
  {
    id: 1,
    name: 'Steps and Expected result cells',
    check(plan) {
      const problems = [];
      for (const c of plan.cases) {
        if (!('Steps' in c.cells) || !('Expected result' in c.cells)) continue;
        const add = (message) => problems.push({ line: c.line, caseId: c.id, message });
        const steps = c.cells['Steps'];
        const expected = c.cells['Expected result'];
        const s = numbered(steps);
        const e = numbered(expected);
        if (s.error) add(`Steps: ${s.error}.`);
        if (e.error) add(`Expected result: ${e.error}.`);
        if (!s.count && !s.error && sentences(steps).length > 1)
          add(
            'Steps: more than one sentence and no numbers. Number the actions "1. … 2. …", or move a note to the Expected result.',
          );
        if (!e.count && !e.error && sentences(expected).length > 1)
          add('Expected result: more than one sentence and no numbers. Number the checks "**1.** … **2.** …".');
        if (s.count > 1 && e.count > 1 && s.count !== e.count && !/\bsteps?\b/i.test(expected))
          add(
            `${s.count} steps but ${e.count} expected items. Match them by step, or say which step the checks follow ("After step 2, …").`,
          );
      }
      return problems;
    },
  },
  {
    id: 2,
    name: 'Prompt cases',
    check(plan) {
      const problems = [];
      for (const c of plan.cases) {
        const steps = c.cells['Steps'];
        if (steps === undefined) continue;
        const add = (message) => problems.push({ line: c.line, caseId: c.id, message });
        const slug = promptSlugInCell(steps);
        if (slug === null) {
          if (/\*\*Prompt:\*\*/i.test(steps))
            add('Steps: put "**Prompt:** [<name>](prompts/<name>.md)" at the start of the cell.');
          continue;
        }
        if (!/^\s*\*\*Prompt:\*\*\s*\[[\w-]+\]\(prompts\/[\w-]+\.md\)/i.test(steps))
          add(`Steps: link the prompt file as "**Prompt:** [${slug || '<name>'}](prompts/${slug || '<name>'}.md)".`);
        const file = join(PROMPTS_DIR, `${slug}.md`);
        if (!slug || !existsSync(file)) {
          add(`No prompt file ${file}.`);
          continue;
        }
        for (const problem of parsePrompt(slug, readFileSync(file, 'utf8')).problems)
          add(`${file}: ${problem}`);
      }
      return problems;
    },
  },
  {
    id: 3,
    name: 'Parallel plans and prompts',
    // A prompt file's own Parallel line is checked with the rest of the file
    // under rule 2 (parsePrompt).
    check(plan) {
      const head = plan.lines.slice(0, 25);
      const at = head.findIndex((l) => /^\**Parallel:/i.test(l));
      if (at < 0) return [];
      const line = at + 1;
      const text = head[at].replace(/^\**Parallel:\**\s*/i, '').replace(/\*\*/g, '').trim();
      const value = parallelValue(text);
      if (value === null) return [{ line, message: `"Parallel: ${text}" is not yes or no.` }];
      if (!value) return [];
      const problems = [];
      if (head.some((l) => /^\**Prod:\**\s*No\b/i.test(l)))
        problems.push({
          line,
          message: 'The plan is Parallel but also "Prod: No". A plan that changes data or runs a site-wide job can\'t be Parallel.',
        });
      for (const c of plan.cases)
        if (/^No\b/i.test(c.cells['Prod'] ?? ''))
          problems.push({
            line: c.line,
            caseId: c.id,
            message: 'The plan is Parallel but this case is "Prod: No". A case that changes data can\'t be in a Parallel plan.',
          });
      return problems;
    },
  },
];

// ---- Running ---------------------------------------------------------------

const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync('test-plans')
      .filter((f) => f.endsWith('.md') && f !== 'README.md')
      .map((f) => join('test-plans', f));

let total = 0;
for (const file of files) {
  const plan = readPlan(file);
  for (const rule of RULES) {
    for (const p of rule.check(plan)) {
      total++;
      const where = `${file}:${p.line}${p.caseId ? ` ${p.caseId}` : ''}`;
      console.log(`${where} [rule ${rule.id}: ${rule.name}] ${p.message}`);
    }
  }
}
console.log(
  total
    ? `\n${total} problem(s). See "Plan writing rules" in test-plans/README.md.`
    : `${files.length} plan(s) follow the plan writing rules.`,
);
process.exit(total ? 1 : 0);
