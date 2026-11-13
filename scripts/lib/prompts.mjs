// Prompt checks: checks Claude does by looking at the site in a browser
// (`claude -p` with the Playwright MCP), written as a prompt instead of test
// code. Each is a file in test-suites/<suite>/prompts/<slug>.md, used by a
// test plan case in the same suite whose Steps cell starts with
// **Prompt:** [<slug>](prompts/<slug>.md) (see test-suites/README.md, Rule 2).
//
// Shared by the dashboard (dashboard/server/), scripts/check-plans.mjs and
// scripts/run-prompt.mjs. A prompt file:
//
//   # <Name>
//   **Role:** anonymous | admin | jobseeker | ...
//   **Compare with:** none | default | baseline | <environment id>[, <id>...]  (optional)
//   **Viewports:** desktop 1280x800, phone 390x844                   (optional)
//   **Screenshots:** 16                                              (optional)
//   **Parallel:** yes | no                                           (optional)
//   (notes for people, ignored)
//   ## Prompt
//   <the prompt, sent to Claude as written>

import { readFile } from 'node:fs/promises';
import { environmentById } from '../../tests/helpers/environments.mts';
import { promptFiles } from './layout.mjs';

const ANONYMOUS = ['', '-', '—', 'anonymous', 'none'];
// "default" is the environment's own comparison sites (compareWith in
// tests/helpers/environments.mts); "baseline" the screenshots of the last run
// of the same check on the same environment. Or a list of environment ids.
const COMPARE_WORDS = ['none', 'default', 'baseline'];

/**
 * A "Compare with" value ("stage, prod", "default", ...) as a list of its
 * words, lower case: ["stage", "prod"].
 */
export const compareList = (text) =>
  (text ?? '')
    .toLowerCase()
    .split(/\s*(?:,|\band\b)\s*/)
    .map((w) => w.trim())
    .filter(Boolean);

/**
 * What's wrong with a "Compare with" value, or null: one of none, default
 * or baseline on its own, or one or more environment ids.
 */
export function compareProblem(text) {
  const words = compareList(text);
  if (!words.length) return 'It is empty.';
  if (words.length === 1 && COMPARE_WORDS.includes(words[0])) return null;
  const bad = words.filter((w) => !environmentById(w));
  if (bad.length)
    return `"${bad.join('", "')}" is not an environment id (none, default and baseline go on their own).`;
  if (new Set(words).size < words.length) return 'It names a site twice.';
  return null;
}
export const DEFAULT_VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
];
const MAX_SCREENSHOTS = 30;

/**
 * A "**Parallel:**" value (Rule 3 in test-suites/README.md): true for yes,
 * false for no or no line, null when it is something else.
 */
export function parallelValue(text) {
  const word = (text ?? 'no').trim().toLowerCase();
  return word === 'yes' ? true : word === 'no' || word === '' ? false : null;
}

const plain = (text) =>
  text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*|__|`/g, '')
    .trim();

// "**Role:** admin" → "admin"; null when the line isn't there.
function option(lines, label) {
  const re = new RegExp(`^\\**${label}:\\**`, 'i');
  const line = lines.find((l) => re.test(l.trim()));
  return line ? plain(line.trim().replace(re, '')) : null;
}

// "desktop 1280x800, phone 390x844" → [{ name, width, height }], or the
// text that couldn't be read in `bad`.
export function parseViewports(text) {
  const viewports = [];
  const bad = [];
  for (const part of text.split(/\s*,\s*/).filter(Boolean)) {
    const m = part.match(/^([a-z][\w-]*)\s+(\d{3,4})\s*[x×]\s*(\d{3,4})$/i);
    if (m)
      viewports.push({
        name: m[1].toLowerCase(),
        width: Number(m[2]),
        height: Number(m[3]),
      });
    else bad.push(part);
  }
  return { viewports, bad };
}

/**
 * A prompt file's fields, and what's wrong with it in `problems`. `where` is
 * { file, suite } from promptFiles() in layout.mjs.
 */
export function parsePrompt(slug, text, where = {}) {
  const lines = text.split('\n');
  const problems = [];
  const heading = lines.find((l) => l.startsWith('# '));

  const roleText = (option(lines, 'Role') ?? '').toLowerCase();
  const role = ANONYMOUS.includes(roleText) ? null : roleText;

  const compareText = option(lines, 'Compare with') || 'none';
  const compare = compareList(compareText).join(', ') || 'none';
  const compareBad = compareProblem(compareText);
  if (compareBad)
    problems.push(
      `"Compare with: ${compareText}": ${compareBad} Write none, default, baseline, or environment ids such as "stage, prod".`,
    );

  const viewportText = option(lines, 'Viewports');
  let viewports = DEFAULT_VIEWPORTS;
  if (viewportText) {
    const parsed = parseViewports(viewportText);
    if (parsed.bad.length)
      problems.push(
        `Viewports: can't read "${parsed.bad.join('", "')}" (write "<name> <width>x<height>", e.g. "phone 390x844").`,
      );
    if (parsed.viewports.length) viewports = parsed.viewports;
  }

  const compares = compare !== 'none';
  const shotsText = option(lines, 'Screenshots');
  let screenshots = compares ? 16 : 6;
  if (shotsText) {
    const n = Number.parseInt(shotsText, 10);
    if (!(n >= 1 && n <= MAX_SCREENSHOTS))
      problems.push(
        `Screenshots: "${shotsText}" is not 1 to ${MAX_SCREENSHOTS}.`,
      );
    else screenshots = n;
  }

  // Yes: it only reads the site, so it may run while other parallel work
  // does (Rule 3).
  const parallelText = option(lines, 'Parallel');
  const parallel = parallelValue(parallelText);
  if (parallel === null)
    problems.push(`Parallel: "${parallelText}" is not yes or no.`);

  // A saved login is for one environment, so the comparison site would show
  // the page logged out.
  if (compares && role && compare !== 'baseline')
    problems.push(
      `A prompt that compares with another site must be anonymous (it is ${role}): a saved login only works on its own environment.`,
    );

  const start = lines.findIndex((l) => /^##\s+Prompt\b/i.test(l));
  const end = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
  const prompt =
    start < 0
      ? ''
      : lines
          .slice(start + 1, end < 0 ? undefined : end)
          .join('\n')
          .trim();
  if (!prompt) problems.push('It has no "## Prompt" section.');

  return {
    slug,
    file: where.file ?? null,
    suite: where.suite ?? null,
    name: heading ? heading.slice(2).trim() : slug,
    role,
    compare,
    viewports,
    screenshots,
    parallel: Boolean(parallel),
    prompt,
    problems,
  };
}

/** The prompt file `slug`, parsed; null when there is no such file. */
export async function readPrompt(slug) {
  if (!/^[\w-]+$/.test(slug)) return null;
  return (await loadPrompts()).get(slug) ?? null;
}

/**
 * Every prompt file in the suites' prompts/ folders, by slug. A slug used in
 * two suites keeps the first file; check-plans.mjs reports the clash.
 */
export async function loadPrompts() {
  const prompts = new Map();
  for (const entry of await promptFiles()) {
    if (prompts.has(entry.slug)) continue;
    const text = await readFile(entry.file, 'utf8');
    prompts.set(entry.slug, parsePrompt(entry.slug, text, entry));
  }
  return prompts;
}

// ---- prompt cases in test plans ---------------------------------------------

// The start of a prompt case's Steps cell:
// "**Prompt:** [homepage-compare](prompts/homepage-compare.md)".
const PROMPT_CELL = /^\s*\*\*Prompt:\*\*\s*(.*)$/i;

/**
 * The prompt slug a plan's Steps cell names, or null when the cell isn't a
 * prompt case. A link, a file name or a bare slug all work.
 */
export function promptSlugInCell(cell) {
  const m = (cell ?? '').match(PROMPT_CELL);
  if (!m) return null;
  const link = m[1].match(/\]\(([^)]+)\)/);
  const target = link ? link[1] : (m[1].match(/^\S+/)?.[0] ?? '');
  return target
    .replace(/`/g, '')
    .replace(/^.*\//, '')
    .replace(/\.md$/i, '')
    .trim();
}

// ---- which sites a run compares with ----------------------------------------

/**
 * What a run of `prompt` on `env` compares with:
 *   { mode: 'none' }
 *   { mode: 'site', envs }     the same pages on other environments
 *   { mode: 'baseline' }       the last run's screenshots on this environment
 * `override` (a run's "Compare with" choice: environment ids, "baseline" or
 * "default") replaces the prompt's own choice, except that a prompt saying
 * "none" never compares. "default" is the environment's own compareWith.
 * The environment under test is left out of the list; when nothing is left,
 * the run compares with its baseline.
 */
export function resolveCompare(prompt, env, override) {
  if (prompt.compare === 'none') return { mode: 'none' };
  const overrideWords = compareList(override);
  let choice =
    overrideWords.length && overrideWords.join() !== 'default'
      ? overrideWords
      : compareList(prompt.compare);
  if (choice.join() === 'default') choice = [env.compareWith ?? 'baseline'].flat();
  if (choice.join() === 'none') return { mode: 'none' };
  const ids = choice.filter((id) => id !== 'baseline' && id !== env.id);
  if (!ids.length) return { mode: 'baseline' };
  const envs = ids.map((id) => {
    const other = environmentById(id);
    if (!other) throw new Error(`Unknown environment "${id}" to compare with.`);
    return other;
  });
  return { mode: 'site', envs };
}
