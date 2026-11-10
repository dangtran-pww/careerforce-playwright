// Reads the suites in test-suites/*.md for the dashboard. A suite is one run
// made of several steps, run one after another on the environment picked in
// the dashboard:
//   ## Plans              test plans from test-plans/, by slug
//   ## Prompts            checks Claude does in a browser (claude -p), each
//                         one a file in test-suites/prompts/
// See test-suites/README.md for the format.

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { clean, loadPlans, tableRows } from './plans.mjs';
import { changesData } from './runs.mjs';

const suitesDir = 'test-suites';
const promptsDir = join(suitesDir, 'prompts');
const ANONYMOUS = ['', '-', '—', 'anonymous', 'none'];

const role = (cell) =>
  ANONYMOUS.includes(clean(cell ?? '').toLowerCase())
    ? null
    : clean(cell).replace(/`/g, '').toLowerCase();

// The lines of the "## <name>" section (up to the next "## ").
function section(lines, name) {
  const start = lines.findIndex((l) =>
    new RegExp(`^##\\s+${name}\\b`, 'i').test(l),
  );
  if (start < 0) return [];
  const end = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
  return lines.slice(start + 1, end < 0 ? undefined : end);
}

// Table rows under a section, without the header and separator rows.
function rows(lines, name) {
  const all = tableRows(section(lines, name));
  return all.slice(2).filter((cells) => cells.some(Boolean));
}

// "**Order:** 1" → "1".
function option(lines, label) {
  const line = lines.find((l) =>
    new RegExp(`^\\**${label}:`, 'i').test(l.trim()),
  );
  return line
    ? clean(line.replace(new RegExp(`^\\**${label}:\\**`, 'i'), ''))
        .replace(/`/g, '')
        .trim()
    : null;
}

function parseSuite(slug, text) {
  const lines = text.split('\n');
  const heading = lines.find((l) => l.startsWith('# ')) ?? `# ${slug}`;
  const name =
    heading
      .slice(2)
      .replace(/^\[Suite\]\s*-?\s*/i, '')
      .trim() || slug;

  const firstSection = lines.findIndex((l) => /^##\s/.test(l));
  const intro = lines
    .slice(1, firstSection < 0 ? undefined : firstSection)
    .join('\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .find((p) => p && !/^\**[A-Z][\w ]+:/.test(p));

  const plans = rows(lines, 'Plans').map(([plan, projects]) => ({
    slug: clean(plan).replace(/`/g, ''),
    projects:
      !projects || /default/i.test(projects)
        ? null
        : clean(projects)
            .split(/\s*,\s*/)
            .filter(Boolean),
  }));

  // "| PR-1 | homepage-layout |" or "| PR-1 | [homepage-layout](prompts/homepage-layout.md) |"
  const prompts = rows(lines, 'Prompts').map(([id, file]) => ({
    id: clean(id),
    file: promptSlug(file ?? ''),
  }));

  return {
    slug,
    file: `${suitesDir}/${slug}.md`,
    name,
    summary: clean((intro ?? '').replace(/\s*\n\s*/g, ' ')),
    // "**Order:** 1": where the suite sits on the Suites page. Suites
    // without one come after, by name.
    order: Number.parseInt(option(lines, 'Order') ?? '', 10),
    plans,
    prompts,
  };
}

// The prompt file's slug from a table cell: a plain slug, a file name or a
// Markdown link to the file.
function promptSlug(cell) {
  const link = cell.match(/\]\(([^)]+)\)/);
  return (link ? link[1] : clean(cell))
    .replace(/`/g, '')
    .replace(/^.*\//, '')
    .replace(/\.md$/i, '')
    .trim();
}

// test-suites/prompts/<slug>.md:
//   # <Name>
//   **Role:** anonymous | admin | jobseeker | ...
//   (notes for people, ignored)
//   ## Prompt
//   <the prompt, sent to Claude as written>
function parsePrompt(slug, text) {
  const lines = text.split('\n');
  const heading = lines.find((l) => l.startsWith('# '));
  const start = lines.findIndex((l) => /^##\s+Prompt\b/i.test(l));
  const end = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
  return {
    slug,
    name: heading ? heading.slice(2).trim() : slug,
    role: role(option(lines, 'Role') ?? ''),
    prompt:
      start < 0
        ? ''
        : lines
            .slice(start + 1, end < 0 ? undefined : end)
            .join('\n')
            .trim(),
  };
}

async function loadPrompts() {
  const names = await readdir(promptsDir).catch(() => []);
  const prompts = await Promise.all(
    names
      .filter((n) => n.endsWith('.md') && n !== 'README.md')
      .map(async (n) =>
        parsePrompt(
          n.slice(0, -3),
          await readFile(join(promptsDir, n), 'utf8'),
        ),
      ),
  );
  return new Map(prompts.map((p) => [p.slug, p]));
}

// Joins each plan entry to the plan itself, and lists what's wrong with
// the suite file (unknown plans and prompt files, duplicate IDs).
function resolve(suite, allPlans, allPrompts) {
  const problems = [];
  const prompts = suite.prompts.flatMap((entry) => {
    const prompt = allPrompts.get(entry.file);
    if (!prompt) {
      problems.push(
        `${entry.id}: no prompt file ${promptsDir}/${entry.file || '?'}.md.`,
      );
      return [];
    }
    if (!prompt.prompt) {
      problems.push(
        `${entry.id}: ${promptsDir}/${entry.file}.md has no "## Prompt" section.`,
      );
      return [];
    }
    return [
      {
        ...entry,
        file: `${promptsDir}/${entry.file}.md`,
        ...withoutSlug(prompt),
      },
    ];
  });
  const plans = suite.plans.map((entry) => {
    const plan = allPlans.find((p) => p.slug === entry.slug);
    if (!plan) {
      problems.push(`Plan "${entry.slug}" is not in test-plans/.`);
      return { ...entry, found: false, runnable: false };
    }
    const known = plan.projects.map((p) => p.name);
    const unknown = (entry.projects ?? []).filter((p) => !known.includes(p));
    if (unknown.length)
      problems.push(
        `${plan.name}: no project ${unknown.join(', ')} runs its tests (it has ${known.join(', ') || 'none'}).`,
      );
    const projects =
      entry.projects?.filter((p) => known.includes(p)) ??
      plan.projects.filter((p) => p.selected).map((p) => p.name);
    // Tests per project this suite runs, so the counts match the run.
    const projectTests = plan.projects
      .filter((p) => projects.includes(p.name))
      .map(({ name, testCount }) => ({ name, testCount }));
    return {
      ...entry,
      found: true,
      name: plan.name,
      type: plan.type,
      status: plan.status,
      runnable: plan.runnable,
      caseCount: plan.cases.length,
      testCount: projectTests.reduce((n, p) => n + p.testCount, 0),
      // A Stage plan changes data even before its tests exist.
      changesData: changesData(plan) || plan.type === 'Stage',
      roles: plan.roles,
      projects,
      projectTests,
    };
  });

  const ids = suite.prompts.map((x) => x.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length)
    problems.push(`Duplicate IDs: ${[...new Set(dupes)].join(', ')}.`);

  const roles = [
    ...new Set([
      ...plans.filter((p) => p.runnable).flatMap((p) => p.roles),
      ...prompts.map((p) => p.role),
    ]),
  ].filter(Boolean);

  return {
    ...suite,
    plans,
    prompts,
    roles,
    changesData: plans.some((p) => p.changesData),
    problems,
  };
}

const withoutSlug = ({ slug, ...rest }) => rest;

export async function loadSuites({ refresh = false } = {}) {
  const [{ plans }, names, prompts] = await Promise.all([
    loadPlans({ refresh }),
    readdir(suitesDir).catch(() => []),
    loadPrompts(),
  ]);
  const suites = await Promise.all(
    names
      .filter((n) => n.endsWith('.md') && n !== 'README.md')
      .map(async (n) => {
        const slug = n.slice(0, -3);
        return resolve(
          parseSuite(slug, await readFile(join(suitesDir, n), 'utf8')),
          plans,
          prompts,
        );
      }),
  );
  const rank = (s) => (Number.isFinite(s.order) ? s.order : Infinity);
  return suites.sort(
    (a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name),
  );
}

export async function loadSuite(slug) {
  return (await loadSuites()).find((s) => s.slug === slug) ?? null;
}
