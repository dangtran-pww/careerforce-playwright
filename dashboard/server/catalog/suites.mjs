// Reads the suites in test-suites/<suite>/suite.md for the dashboard. A suite
// is a folder of test plans, run as one run: the plans in its "## Plans"
// table (by slug), one after another on the environment picked in the
// dashboard. See test-suites/README.md for the format.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SUITES_DIR, SUITE_FILE } from '../paths.mjs';
import { suiteDirs } from '../../../scripts/lib/layout.mjs';
import { allNoProd, clean, loadPlans, tableRows } from './plans.mjs';

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
    // Skip option lines such as "**Order:** 1": a one-word label. A
    // sentence like "The smoke check: …" is the summary.
    .find((p) => p && !/^\**[A-Z]\w*:/.test(p));

  const plans = rows(lines, 'Plans').map(([plan, projects]) => ({
    slug: clean(plan).replace(/`/g, ''),
    projects:
      !projects || /default/i.test(projects)
        ? null
        : clean(projects)
            .split(/\s*,\s*/)
            .filter(Boolean),
  }));

  return {
    slug,
    file: join(SUITES_DIR, slug, SUITE_FILE),
    name,
    summary: clean((intro ?? '').replace(/\s*\n\s*/g, ' ')),
    // "**Order:** 1": where the suite sits on the Suites page. Suites
    // without one come after, by name.
    order: Number.parseInt(option(lines, 'Order') ?? '', 10),
    plans,
  };
}

// Joins each plan entry to the plan itself, and lists what's wrong with
// the suite (plans not in its folder, plan files missing from its table,
// unknown projects).
function resolve(suite, allPlans) {
  const problems = [];
  const own = allPlans.filter((p) => p.suite === suite.slug);
  const folder = join(SUITES_DIR, suite.slug);
  const plans = suite.plans.map((entry) => {
    const plan = own.find((p) => p.slug === entry.slug);
    if (!plan) {
      problems.push(`Plan "${entry.slug}" is not in ${folder}/.`);
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
      // Left out on production; all of them means the plan is skipped there.
      noProd: plan.noProd,
      noProdCases: plan.noProdCases,
      allNoProd: allNoProd(plan),
      roles: plan.roles,
      projects,
      projectTests,
    };
  });

  for (const plan of own)
    if (!suite.plans.some((e) => e.slug === plan.slug))
      problems.push(
        `${plan.file} is not in the suite's Plans table, so the suite doesn't run it.`,
      );

  const roles = [
    ...new Set(plans.filter((p) => p.runnable).flatMap((p) => p.roles)),
  ].filter(Boolean);

  return {
    ...suite,
    plans,
    roles,
    problems,
  };
}

export async function loadSuites({ refresh = false } = {}) {
  const [{ plans }, slugs] = await Promise.all([
    loadPlans({ refresh }),
    suiteDirs(),
  ]);
  const suites = await Promise.all(
    slugs.map(async (slug) => {
      // A folder without suite.md is still a suite, named after the folder.
      const text = await readFile(
        join(SUITES_DIR, slug, SUITE_FILE),
        'utf8',
      ).catch(() => '');
      return resolve(parseSuite(slug, text), plans);
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
