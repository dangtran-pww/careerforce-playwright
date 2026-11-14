// Checks test plans against the rules in test-suites/README.md
// ("Plan writing rules"). Each rule there that can be checked by a script
// has an entry in RULES below, with the same number.
//
// Usage: npm run check:plans [-- test-suites/<suite>/<plan>.md …]
// With no files, checks every plan in every suite folder, and that no two
// plans or prompts share a file name. Case IDs (rule 4) are always compared
// with every plan, even when only some files are named. Exits 1 on any
// problem.
//
// Adding a rule: write it up in the README, then add { id, name, check } to
// RULES. `check` gets one plan (see readPlan) and every plan, and returns
// problems as { line, caseId?, message }.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { PROMPTS_FOLDER, duplicateSlugs, planFiles, promptFiles } from './lib/layout.mjs';
import { PROMPT_COLUMN, parallelValue, parsePrompt, promptSlugInCell } from './lib/prompts.mjs';

// ---- Reading a plan --------------------------------------------------------

function cells(line) {
  return line
    .replace(/^\|\s?/, '')
    .replace(/\s?\|\s*$/, '')
    .split(' | ');
}

// The plan's text and lines, and every row of its case tables (tables with
// an ID column) as { line, id, table, section, prompt, cells: { <column
// header>: text } }, where table is the line of that table's header, section
// the "## " heading it is under, and prompt whether the table has a Prompt
// column (a prompt case table, Rule 2).
function readPlan(file) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const cases = [];
  let header = null;
  let table = null;
  let section = '';
  lines.forEach((l, i) => {
    if (/^## /.test(l)) section = l.slice(3).trim();
    if (!l.startsWith('|')) return void (header = null);
    const row = cells(l);
    if (!header) return void ((header = row[0] === 'ID' ? row : []), (table = i + 1));
    if (!header.length || /^\|[\s:|-]+$/.test(l)) return; // the |---|---| row
    const byColumn = Object.fromEntries(header.map((h, c) => [h, row[c] ?? '']));
    const prompt = header.includes(PROMPT_COLUMN);
    cases.push({ line: i + 1, id: row[0], table, section, prompt, cells: byColumn });
  });
  return { file, text, lines, cases };
}

const TEST_CASES = 'Test cases';
const PROMPT_CASES = 'Prompt cases';
// A prompt case row is only its ID, title and prompt file (and Prod when the
// plan needs it); the rest is in the prompt file.
const PROMPT_CASE_COLUMNS = ['ID', 'Test', PROMPT_COLUMN, 'Prod'];

// ---- Helpers for the rules -------------------------------------------------

const CASE_ID = /^([A-Z]{2,4})-([1-9]\d*)$/;

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
        // A prompt case has no Steps; its Expected result is checked alone.
        if (!('Expected result' in c.cells)) continue;
        const add = (message) => problems.push({ line: c.line, caseId: c.id, message });
        const steps = c.cells['Steps'] ?? '';
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
        const add = (message) => problems.push({ line: c.line, caseId: c.id, message });
        if (!c.prompt) {
          // A prompt case written in the test case table, the old way.
          const steps = c.cells['Steps'] ?? '';
          if (/\*\*Prompt:\*\*|\]\(prompts\//i.test(steps))
            add(
              `A prompt case in the ${TEST_CASES} table. Move it to a "## ${PROMPT_CASES}" table with a ${PROMPT_COLUMN} column, which starts with "[<name>](prompts/<name>.md)".`,
            );
          continue;
        }
        const cell = c.cells[PROMPT_COLUMN];
        const slug = promptSlugInCell(cell);
        // Only the link: what Claude does and what passes are in the file.
        if (!/^\s*\[[\w-]+\]\(prompts\/[\w-]+\.md\)\s*$/.test(cell))
          add(
            `${PROMPT_COLUMN}: the cell is only the prompt file's link, "[${slug || '<name>'}](prompts/${slug || '<name>'}.md)". Put what Claude does in its "## Prompt" section.`,
          );
        const extra = Object.keys(c.cells).filter((h) => !PROMPT_CASE_COLUMNS.includes(h));
        if (extra.length)
          add(
            `The prompt case table has ${extra.map((h) => `"${h}"`).join(', ')}. Its columns are ${PROMPT_CASE_COLUMNS.join(' | ')} (Prod only when needed): put the expected result in the prompt file's "## Expected result" section.`,
          );
        // Next to the plan, where its link points.
        const file = join(dirname(plan.file), PROMPTS_FOLDER, `${slug}.md`);
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
  {
    id: 4,
    name: 'Case IDs',
    check(plan, allPlans) {
      const problems = [];
      const elsewhere = allPlans.filter((p) => p.file !== plan.file);
      const seen = new Map();
      for (const c of plan.cases) {
        const add = (message) => problems.push({ line: c.line, caseId: c.id, message });
        const m = CASE_ID.exec(c.id);
        if (!m) {
          add(`"${c.id}" is not an ID like "SS-1": 2 to 4 capital letters, "-", then a number from 1 with no leading zero.`);
          continue;
        }
        if (seen.has(c.id)) add(`${c.id} is already used on line ${seen.get(c.id)} of this plan. Give this case the next free number.`);
        else seen.set(c.id, c.line);
        const other = elsewhere.find((p) => p.cases.some((o) => CASE_ID.exec(o.id)?.[1] === m[1]));
        if (other) add(`The prefix ${m[1]} is also used in ${other.file}. Each prefix belongs to one plan; pick one no other plan uses.`);
      }
      return problems;
    },
  },
  {
    id: 5,
    name: 'One test case table',
    check(plan) {
      const problems = [];
      for (const [prompt, section] of [
        [false, TEST_CASES],
        [true, PROMPT_CASES],
      ]) {
        const kind = prompt ? 'prompt case' : 'test case';
        const ofKind = plan.cases.filter((c) => c.prompt === prompt);
        const tables = [...new Set(ofKind.map((c) => c.table))];
        for (const line of tables.slice(1))
          problems.push({ line, message: `A second ${kind} table (the first is on line ${tables[0]}). Put every ${kind} in one table under "## ${section}".` });
        const misplaced = ofKind.find((c) => c.section !== section);
        if (misplaced)
          problems.push({ line: misplaced.table, message: `The ${kind} table is under "## ${misplaced.section}". Put it under "## ${section}".` });
      }
      let inCases = false;
      plan.lines.forEach((l, i) => {
        if (/^## /.test(l)) inCases = [TEST_CASES, PROMPT_CASES].includes(l.slice(3).trim());
        else if (inCases && /^### /.test(l))
          problems.push({ line: i + 1, message: `"${l.slice(4)}" splits the cases into areas. Remove the heading and move its notes above the table, or to another ## section.` });
      });
      return problems;
    },
  },
  {
    id: 6,
    name: 'No site password gate',
    check(plan) {
      const problems = [];
      plan.lines.forEach((l, i) => {
        if (/password gate|basic auth|BASIC_AUTH/i.test(l))
          problems.push({ line: i + 1, message: 'Mentions the site password gate. Remove it: the README\'s one-time setup covers it for every plan.' });
      });
      return problems;
    },
  },
];

// ---- Running ---------------------------------------------------------------

const all = !process.argv.slice(2).length;
const files = all ? (await planFiles()).map((p) => p.file) : process.argv.slice(2);

let total = 0;
// A plan or prompt is found by its file name alone, so each must be unique.
if (all)
  for (const [kind, entries] of [
    ['plan', await planFiles()],
    ['prompt', await promptFiles()],
  ])
    for (const [slug, where] of duplicateSlugs(entries)) {
      total++;
      console.log(`Two ${kind}s are named "${slug}": ${where.join(', ')}. Rename one.`);
    }

// Every plan, to compare case IDs with (rule 4). A named file outside the
// suite folders is compared too.
const allPlans = (await planFiles()).map((p) => readPlan(p.file));
for (const file of files) if (!allPlans.some((p) => p.file === file)) allPlans.push(readPlan(file));

for (const file of files) {
  const plan = allPlans.find((p) => p.file === file);
  for (const rule of RULES) {
    for (const p of rule.check(plan, allPlans)) {
      total++;
      const where = `${file}:${p.line}${p.caseId ? ` ${p.caseId}` : ''}`;
      console.log(`${where} [rule ${rule.id}: ${rule.name}] ${p.message}`);
    }
  }
}
console.log(
  total
    ? `\n${total} problem(s). See "Plan writing rules" in test-suites/README.md.`
    : `${files.length} plan(s) follow the plan writing rules.`,
);
process.exit(total ? 1 : 0);
