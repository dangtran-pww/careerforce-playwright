// Prompt checks: checks Claude does by looking at the site in a browser
// (`claude -p` with the Playwright MCP), written as a prompt instead of test
// code. Each is a file in test-plans/prompts/<slug>.md, used by a test plan
// case whose Steps cell starts with **Prompt:** [<slug>](prompts/<slug>.md)
// (see test-plans/README.md, Rule 2).
//
// Shared by the dashboard (dashboard/server/), scripts/check-plans.mjs and
// scripts/run-prompt.mjs. A prompt file:
//
//   # <Name>
//   **Role:** anonymous | admin | jobseeker | ...
//   **Compare with:** none | default | baseline | <environment id>   (optional)
//   **Viewports:** desktop 1280x800, phone 390x844                   (optional)
//   **Screenshots:** 16                                              (optional)
//   (notes for people, ignored)
//   ## Prompt
//   <the prompt, sent to Claude as written>

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { environmentById } from '../../tests/helpers/environments.mts';

export const PROMPTS_DIR = join('test-plans', 'prompts');

const ANONYMOUS = ['', '-', '—', 'anonymous', 'none'];
// "default" is the environment's own comparison site (compareWith in
// tests/helpers/environments.mts); "baseline" the screenshots of the last run
// of the same check on the same environment.
const COMPARE_WORDS = ['none', 'default', 'baseline'];
export const DEFAULT_VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
];
const MAX_SCREENSHOTS = 30;

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

/** A prompt file's fields, and what's wrong with it in `problems`. */
export function parsePrompt(slug, text) {
  const lines = text.split('\n');
  const problems = [];
  const heading = lines.find((l) => l.startsWith('# '));

  const roleText = (option(lines, 'Role') ?? '').toLowerCase();
  const role = ANONYMOUS.includes(roleText) ? null : roleText;

  const compareText = (option(lines, 'Compare with') ?? 'none').toLowerCase();
  const compare = compareText || 'none';
  if (!COMPARE_WORDS.includes(compare) && !environmentById(compare))
    problems.push(
      `"Compare with: ${compare}" is not none, default, baseline or an environment id.`,
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
    file: `${PROMPTS_DIR}/${slug}.md`,
    name: heading ? heading.slice(2).trim() : slug,
    role,
    compare,
    viewports,
    screenshots,
    prompt,
    problems,
  };
}

/** The prompt file `slug`, parsed; null when there is no such file. */
export async function readPrompt(slug, dir = PROMPTS_DIR) {
  if (!/^[\w-]+$/.test(slug)) return null;
  const text = await readFile(join(dir, `${slug}.md`), 'utf8').catch(
    () => null,
  );
  return text === null ? null : parsePrompt(slug, text);
}

/** Every prompt file, by slug. */
export async function loadPrompts(dir = PROMPTS_DIR) {
  const names = await readdir(dir).catch(() => []);
  const prompts = await Promise.all(
    names
      .filter((n) => n.endsWith('.md') && n !== 'README.md')
      .map(async (n) =>
        parsePrompt(n.slice(0, -3), await readFile(join(dir, n), 'utf8')),
      ),
  );
  return new Map(prompts.map((p) => [p.slug, p]));
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

// ---- which site a run compares with -----------------------------------------

/**
 * What a run of `prompt` on `env` compares with:
 *   { mode: 'none' }
 *   { mode: 'site', env }      the same pages on another environment
 *   { mode: 'baseline' }       the last run's screenshots on this environment
 * `override` (a run's "Compare with" choice: an environment id, "baseline" or
 * "default") replaces the prompt's own choice, except that a prompt saying
 * "none" never compares. Comparing with the environment under test means
 * comparing with its baseline.
 */
export function resolveCompare(prompt, env, override) {
  if (prompt.compare === 'none') return { mode: 'none' };
  let choice = override && override !== 'default' ? override : prompt.compare;
  if (choice === 'default') choice = env.compareWith ?? 'baseline';
  if (choice === 'baseline' || choice === env.id) return { mode: 'baseline' };
  const other = environmentById(choice);
  if (!other)
    throw new Error(`Unknown environment "${choice}" to compare with.`);
  return { mode: 'site', env: other };
}
