// Where test suites, plans and prompts live. Shared by the dashboard
// (dashboard/server/), scripts/check-plans.mjs and scripts/run-prompt.mjs.
//
//   test-suites/
//     README.md                 how suites and plans are written
//     <suite>/
//       suite.md                the suite: name, order, its "## Plans" table
//       <plan>.md               the suite's test plans
//       prompts/<prompt>.md     the prompts its plans' prompt cases use
//
// A plan's slug is its file name without .md, and a prompt's slug likewise.
// Both are unique across all suites, so a slug alone finds the file. Paths
// are relative to the repository root.

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

export const SUITES_DIR = 'test-suites';
export const SUITE_FILE = 'suite.md';
export const PROMPTS_FOLDER = 'prompts';

const NOT_PLANS = new Set([SUITE_FILE, 'README.md']);

const markdown = (names) => names.filter((n) => n.endsWith('.md'));

/** The suite folders' names (slugs), skipping hidden folders. */
export async function suiteDirs(root = SUITES_DIR) {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort();
}

/** Every plan: { slug, suite, file }. */
export async function planFiles(root = SUITES_DIR) {
  const plans = [];
  for (const suite of await suiteDirs(root)) {
    const names = markdown(await readdir(join(root, suite)).catch(() => []));
    for (const name of names.filter((n) => !NOT_PLANS.has(n)).sort())
      plans.push({ slug: name.slice(0, -3), suite, file: join(root, suite, name) });
  }
  return plans;
}

/** Every prompt file: { slug, suite, file }. */
export async function promptFiles(root = SUITES_DIR) {
  const prompts = [];
  for (const suite of await suiteDirs(root)) {
    const dir = join(root, suite, PROMPTS_FOLDER);
    const names = markdown(await readdir(dir).catch(() => []));
    for (const name of names.filter((n) => n !== 'README.md').sort())
      prompts.push({ slug: name.slice(0, -3), suite, file: join(dir, name) });
  }
  return prompts;
}

/** Slugs found in more than one file, with their files. */
export function duplicateSlugs(entries) {
  const bySlug = new Map();
  for (const e of entries)
    bySlug.set(e.slug, [...(bySlug.get(e.slug) ?? []), e.file]);
  return [...bySlug].filter(([, files]) => files.length > 1);
}
