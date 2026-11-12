// Reads the test plans in test-suites/<suite>/*.md for the dashboard, and
// matches each plan to the Playwright tests that implement it.
//
// From each plan's Markdown: the title, the status line, the "Implemented
// test" path(s), any "Pending cases" / "Updated cases" note, and the case IDs
// and titles from its test-case tables (rows whose first cell is an ID such as
// HP-1 or JSS-2). See test-suites/README.md → "Status on every plan".
//
// What must never run on production is marked at one of two levels, with an
// optional reason after "No":
//  - the whole plan: a "Prod: No: <reason>" line in its header. Every case
//    is then no-prod, and every one of its tests is tagged @no-prod.
//  - one case: "No: <reason>" in its table's Prod column, and that case's
//    tests are tagged @no-prod.
// The plan text or the tag is enough, so the dashboard keeps a case off
// production even before its tests exist.
//
// Which tests and projects a plan runs comes from Playwright itself
// (`playwright test --list --reporter=json`), so a new project or spec is
// picked up without changing this file. Test titles start with the case ID
// ("AR-1: status report ..."), which is how cases are matched to tests.
//
// A prompt case has no test code: its Steps cell starts with
// "**Prompt:** [<slug>](prompts/<slug>.md)", and Claude runs that prompt file
// (in the plan's suite's prompts/ folder) in a browser (scripts/lib/prompts.mjs, runs/prompt.mjs). It has
// kind: 'prompt' and the parsed file in `prompt`.

import { readFile, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import {
  loadPrompts,
  parallelValue,
  promptSlugInCell,
} from '../../../scripts/lib/prompts.mjs';
import { PROMPTS_FOLDER, planFiles } from '../../../scripts/lib/layout.mjs';

const run = promisify(execFile);
const caseId = /^[A-Z][A-Z0-9]*-\d+$/;
// "No", or "No: <reason>", in a Prod line or column.
const NO_PROD = /^no\b[\s:.,;—–-]*(.*?)\.?$/i;

export function clean(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // [text](link) → text
    .replace(/\*\*|__/g, '')
    .trim();
}

// "[Smoke] - Admin Reports - Test Plan"            → Smoke / Admin Reports
function splitTitle(heading) {
  const text = heading.replace(/\s*-\s*Test Plan\s*$/i, '').trim();
  const m = text.match(/^\[([^\]]+)\]\s*(?:-\s*)?(.*)$/);
  if (!m) return { type: 'Other', name: text };
  const [type, ...rest] = m[1].split(/\s+-\s+/);
  const name = [...rest, m[2]].filter(Boolean).join(' - ');
  return { type: type.trim(), name: name || type.trim() };
}

function parsePlan({ slug, suite, file }, text) {
  const lines = text.split('\n');
  const heading = lines.find((l) => l.startsWith('# ')) ?? `# ${slug}`;
  const { type, name } = splitTitle(heading.slice(2));
  const head = lines.slice(0, 25);

  const statusLine = head.find((l) => /^\**Status:/i.test(l)) ?? '';
  const status =
    statusLine
      .match(/Status:\**\s*([a-z ]+)/i)?.[1]
      .trim()
      .toLowerCase() ?? 'unknown';

  // "Prod: No: <reason>" in the header: no case of the plan runs on
  // production.
  const planProd = clean(
    head.find((l) => /^\**Prod:/i.test(l))?.replace(/^\**Prod:\**\s*/i, '') ??
      '',
  ).match(NO_PROD);

  // "Parallel: yes" in the header: the plan's tests only read the site, so
  // they run with several workers and alongside parallel prompt cases
  // (Rule 3 in test-suites/README.md).
  const parallel =
    parallelValue(
      clean(
        head
          .find((l) => /^\**Parallel:/i.test(l))
          ?.replace(/^\**Parallel:\**\s*/i, '') ?? '',
      ),
    ) === true;

  const implementedLine =
    head.find((l) => /^\**Implemented tests?:/i.test(l)) ?? '';
  const testPaths = [...implementedLine.matchAll(/tests\/[^\s`,;]+/g)].map(
    (m) => m[0].replace(/\.$/, ''),
  );

  // "Pending cases: …" / "Updated cases: …", plus the lines that continue it.
  const notes = [];
  for (let i = 0; i < head.length; i++) {
    if (!/^(Pending|Updated) cases:/i.test(head[i])) continue;
    let note = head[i];
    while (head[i + 1]?.trim() && !/^\**[A-Z][a-z ]+:/.test(head[i + 1]))
      note += ` ${head[++i].trim()}`;
    notes.push(clean(note));
  }

  // First paragraph of "## Overview", else the first paragraph before the
  // first "##" that isn't the status block.
  const overview = lines.findIndex((l) => /^## Overview/i.test(l));
  const start = overview >= 0 ? overview + 1 : 1;
  const end = lines.findIndex((l, i) => i >= start && l.startsWith('#'));
  const paragraphs = lines
    .slice(start, end < 0 ? undefined : end)
    .join('\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const para = paragraphs.find(
    (p) =>
      !/^\**(Status|Implemented|Pending|Updated)\b/i.test(p) &&
      !/^[|>-]/.test(p),
  );
  const summary = clean((para ?? '').replace(/\s*\n\s*/g, ' ')).replace(
    /`/g,
    '',
  );

  // The whole overview, for the dashboard's "Show full overview": its
  // paragraphs and bullet lists, keeping `code` and **bold** (links become
  // plain text). Tables, quotes and the status block are left out.
  const overviewBlocks = paragraphs
    .filter(
      (p) =>
        !/^\**(Status|Implemented|Pending|Updated)\b/i.test(p) &&
        !/^[|>]/.test(p),
    )
    .map((p) => {
      const text = (t) =>
        t
          .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
          .replace(/\s*\n\s*/g, ' ')
          .trim();
      if (!/^[-*] /.test(p)) return { kind: 'p', text: text(p) };
      const items = p
        .split(/\n(?=[-*] )/)
        .map((item) => text(item.replace(/^[-*] /, '')));
      return { kind: 'ul', items };
    });

  // Each case keeps the rest of its row as details, labelled by the table's
  // header ("Steps", "Expected result", "Notes", …), for the dashboard to show
  // on demand. Their text keeps `code` and **bold**; links become plain text.
  const cases = [];
  const seen = new Set();
  let header = [];
  for (const cells of tableRows(lines)) {
    if (cells.every((c) => /^:?-+:?$/.test(c))) continue; // separator row
    if (!caseId.test(cells[0] ?? '')) {
      header = cells;
      continue;
    }
    if (seen.has(cells[0])) continue;
    seen.add(cells[0]);
    // The Prod column: "No" or "No: <reason>" keeps the case off production.
    const prodAt = header.findIndex((h) => /^prod(uction)?$/i.test(clean(h)));
    const prod = clean(prodAt >= 2 ? (cells[prodAt] ?? '') : '');
    const noProd = prod.match(NO_PROD);
    const stepsAt = header.findIndex((h) => /^steps$/i.test(clean(h)));
    const promptSlug = stepsAt >= 2 ? promptSlugInCell(cells[stepsAt]) : null;
    cases.push({
      id: cells[0],
      kind: promptSlug === null ? 'test' : 'prompt',
      promptSlug,
      title: clean(cells[1] ?? '').replace(/`/g, ''),
      noProd: Boolean(planProd || noProd),
      noProdReason: noProd?.[1] || planProd?.[1] || null,
      details: cells
        .slice(2)
        .map((text, i) => ({
          label: clean(header[i + 2] ?? '') || `Column ${i + 3}`,
          text: text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim(),
        }))
        .filter((d, i) => d.text && i + 2 !== prodAt),
    });
  }

  return {
    slug,
    suite,
    file,
    type,
    name,
    status,
    testPaths,
    noProd: Boolean(planProd),
    noProdReason: planProd?.[1] || null,
    parallel,
    notes,
    summary,
    overview: overviewBlocks,
    cases,
  };
}

// The cells of every Markdown table row in `lines`, header and separator
// rows included (callers skip them by checking the first cell).
export function tableRows(lines) {
  return lines
    .filter((l) => l.trim().startsWith('|'))
    .map((l) =>
      l
        .trim()
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim()),
    );
}

// ---- Playwright's own list of tests ----------------------------------------

let listCache = null;

async function listTests() {
  const { stdout } = await run(
    'npx',
    ['playwright', 'test', '--list', '--reporter=json'],
    { maxBuffer: 64 * 1024 * 1024, env: { ...process.env, FORCE_COLOR: '0' } },
  );
  const report = JSON.parse(stdout);
  const tests = [];
  // `path` is the describe titles then the test title, e.g.
  // ["AM-5: appointments search …", "default day"].
  const walk = (suite, path) => {
    for (const spec of suite.specs ?? [])
      for (const t of spec.tests)
        tests.push({
          project: t.projectName,
          file: `tests/${spec.file}`,
          line: spec.line,
          path: [...path, spec.title],
          // Its own tags and its describes', without the "@".
          tags: spec.tags ?? [],
        });
    for (const child of suite.suites ?? []) walk(child, [...path, child.title]);
  };
  // Top-level suites are files; their title is the file name, not a describe.
  for (const file of report.suites) walk(file, []);
  return {
    tests,
    errors: (report.errors ?? []).map((e) => e.message?.split('\n')[0]),
  };
}

// "tests/smoke/admin-maintenance/*.spec.ts" or a folder → a matcher.
function pathMatcher(path) {
  const glob = path
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*?/g, '.*');
  return new RegExp(`^${glob}(/.*)?$`);
}

const hasCase = (test, id) =>
  test.path.some((title) => new RegExp(`^${id}(?!\\d)`).test(title));

/** Whether nothing of `plan` runs on production. */
export const allNoProd = (plan) => {
  if (plan.noProd) return true;
  const withTests = plan.cases.filter(
    (c) => c.testCount > 0 || c.kind === 'prompt',
  );
  return withTests.length > 0 && withTests.every((c) => c.noProd);
};

// Playwright `-g` pattern that picks these cases' tests.
export const caseGrep = (ids) => `\\b(?:${ids.join('|')})(?!\\d)`;

function attachTests(plan, all) {
  const matchers = plan.testPaths.map(pathMatcher);
  const tests = all.filter((t) => matchers.some((m) => m.test(t.file)));
  const files = [...new Set(tests.map((t) => t.file))].sort();
  // What to pass to `playwright test`: the plan's own paths, with a glob such
  // as tests/smoke/anonymous/*.spec.ts shortened to its folder, so the
  // command stays readable. Playwright treats these as filters on file paths.
  const runPaths = plan.testPaths.map((p) =>
    p.includes('*') ? p.slice(0, p.lastIndexOf('/', p.indexOf('*')) + 1) : p,
  );

  const byProject = new Map();
  for (const t of tests) {
    if (!byProject.has(t.project)) byProject.set(t.project, []);
    byProject.get(t.project).push(t.path.join(' › '));
  }
  // One project per suite and device (smoke-desktop, smoke-mobile, ...; see
  // playwright.config.ts), so no two projects run the same tests: all are on
  // by default. `seed` is the agents' browser, never a plan's test run.
  const projects = [...byProject].map(([name, titles]) => ({
    name,
    testCount: titles.length,
    selected: name !== 'seed',
  }));

  // Counts are of the tests a default run executes.
  const selected = new Set(
    projects.filter((p) => p.selected).map((p) => p.name),
  );
  const runTests = tests.filter((t) => selected.has(t.project));
  for (const c of plan.cases) {
    if (c.kind === 'prompt') {
      Object.assign(c, { testCount: 0, projects: [], locations: [], tags: [] });
      continue;
    }
    const caseTests = runTests.filter((t) => hasCase(t, c.id));
    c.testCount = caseTests.length;
    // The projects that run it, e.g. smoke-desktop and smoke-mobile, so the
    // dashboard can show which devices a case is tested on.
    c.projects = projects
      .filter((p) => p.selected)
      .map((p) => ({
        name: p.name,
        testCount: caseTests.filter((t) => t.project === p.name).length,
      }))
      .filter((p) => p.testCount > 0);
    // Where the case's code is: one entry per test, not per project.
    const seen = new Set();
    c.locations = [];
    for (const t of caseTests) {
      const at = `${t.file}:${t.line}`;
      if (seen.has(at)) continue;
      seen.add(at);
      c.locations.push({
        file: t.file,
        line: t.line,
        title: t.path.join(' › '),
        tags: t.tags,
      });
    }
    // From every project's tests, so a tag such as @mobile-only shows even
    // when the project that runs it is off by default.
    c.tags = [
      ...new Set(tests.filter((t) => hasCase(t, c.id)).flatMap((t) => t.tags)),
    ].sort();
    // Off production when the plan says so or its tests are tagged
    // @no-prod (the tag playwright.config.ts leaves out on production).
    c.noProd = c.noProd || c.tags.includes('no-prod');
    // Said "No" in the plan, but a test of it isn't tagged: the dashboard
    // still keeps it off production, a plain `playwright test` wouldn't.
    c.noProdUntagged =
      c.noProd &&
      c.locations.length > 0 &&
      c.locations.some((l) => !l.tags?.includes('no-prod'));
  }
  return {
    ...plan,
    files,
    // The cases that never run on production.
    noProdCases: plan.cases.filter((c) => c.noProd).map((c) => c.id),
    // A no-prod plan with a test that isn't tagged @no-prod.
    noProdUntagged:
      plan.noProd && tests.some((t) => !t.tags.includes('no-prod')),
    runPaths,
    projects,
    testCount: runTests.length,
    // Has Playwright tests; runnable also counts its prompt cases (set in
    // attachPrompts).
    hasTests: tests.length > 0,
    runnable: tests.length > 0,
  };
}

// Fills in each prompt case's prompt file (null when the file is missing),
// and makes a plan with a usable prompt case runnable.
// The prompt must be in the plan's own suite, where its link points.
function attachPrompts(plan, prompts) {
  const dir = join(plan.file, '..', PROMPTS_FOLDER);
  for (const c of plan.cases) {
    if (c.kind !== 'prompt') continue;
    const prompt = prompts.get(c.promptSlug);
    c.prompt = prompt?.suite === plan.suite ? prompt : null;
    c.promptProblems = c.prompt
      ? c.prompt.problems
      : [`No prompt file ${dir}/${c.promptSlug || '?'}.md.`];
  }
  plan.promptCases = plan.cases
    .filter((c) => c.kind === 'prompt')
    .map((c) => c.id);
  plan.runnable =
    plan.hasTests ||
    plan.cases.some((c) => c.kind === 'prompt' && !c.promptProblems.length);
  return plan;
}

// Every plan lookup (loadPlan) reads all plans again, so what's read from a
// file is kept until the file changes: file → { mtimeMs, value }.
const fileCache = new Map();

// compute(text) for the file's text, from the cache while its mtime is
// unchanged. A missing file reads as ''.
async function fromFile(file, compute) {
  const mtimeMs = await stat(file).then(
    (s) => s.mtimeMs,
    () => null,
  );
  const hit = fileCache.get(file);
  if (hit && hit.mtimeMs === mtimeMs) return hit.value;
  const text =
    mtimeMs === null ? '' : await readFile(file, 'utf8').catch(() => '');
  const value = compute(text);
  fileCache.set(file, { mtimeMs, value });
  return value;
}

// Roles a plan logs in as: `useRole('<role>')` or
// `storageState: authFile('<role>')` (or an old
// 'playwright/.auth/<role>.json') in its spec files.
const rolesIn = (text) =>
  [
    ...text.matchAll(
      /(?:useRole|authFile)\(\s*['"]([a-z-]+)['"]|playwright\/\.auth\/([a-z-]+)\.json/g,
    ),
  ].map((m) => m[1] ?? m[2]);

async function rolesFor(files) {
  const roles = new Set();
  for (const file of files)
    for (const role of await fromFile(file, rolesIn)) roles.add(role);
  return [...roles];
}

// All plans, with their tests. Asking Playwright for the list takes a few
// seconds, so it is kept until `refresh` is set.
export async function loadPlans({ refresh = false } = {}) {
  if (refresh || !listCache) {
    listCache = listTests().catch((err) => {
      listCache = null;
      throw err;
    });
  }
  const [{ tests, errors }, entries, prompts] = await Promise.all([
    listCache,
    planFiles(),
    loadPrompts(),
  ]);
  const plans = await Promise.all(
    entries.map(async (entry) => {
      // Parsed again each time (cheap): attachTests fills in its cases.
      const text = await fromFile(entry.file, (t) => t);
      const plan = attachPrompts(
        attachTests(parsePlan(entry, text), tests),
        prompts,
      );
      plan.roles = await rolesFor(plan.files);
      return plan;
    }),
  );
  const order = ['Smoke'];
  const rank = (t) => (order.includes(t) ? order.indexOf(t) : order.length);
  plans.sort(
    (a, b) => rank(a.type) - rank(b.type) || a.name.localeCompare(b.name),
  );
  return { plans, listErrors: errors };
}

export async function loadPlan(slug) {
  const { plans } = await loadPlans();
  return plans.find((p) => p.slug === slug) ?? null;
}
