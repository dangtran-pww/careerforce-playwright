// Accessibility scans along a journey (tests/helpers/a11y-journey.ts): the
// scans a run's tests attached (`a11y-journey`), or a Claude journey wrote
// to its JSON-lines file, grouped by page pattern for the run page.
//
// A run's `a11y` (and a suite step's, and a prompt check's):
//   { scanned, interrupted, pages: [Page] }
//   Page: { pattern, titles: [title], dialogs: [name],
//           visits: [{ url, test, project, step, dialog, layout,
//                      width }],                              (first 30)
//           violations: [Violation] }                        (worst first)
//   Violation: { id, impact, help, helpUrl, tags, count,
//                nodes: [{ target, html, summary, url }] }   (first 20)
// The same rule on the same element, seen on several visits, is listed once
// (with the first URL it was seen at); `count` is how many elements in all.
//
// Groups merge (mergeJourneys), so a suite run adds up its steps, and a run
// its tests and prompt checks.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { eachTest } from './playwright.mjs';

const IMPACT_ORDER = ['critical', 'serious', 'moderate', 'minor'];
const rank = (impact) => {
  const i = IMPACT_ORDER.indexOf(impact ?? '');
  return i === -1 ? IMPACT_ORDER.length : i;
};
const MAX_VISITS = 30;
const MAX_NODES = 20;

/** The environment variables that turn the scanner on, for a run in `dir`. */
export const journeyEnv = (runDir) => ({
  A11Y_JOURNEY: '1',
  // Shared by the whole run: each page state is scanned once.
  A11Y_JOURNEY_SEEN_DIR: join(runDir, 'a11y-seen'),
});

/** The scans in a Playwright JSON report (results.json in `dir`). */
export async function journeyFromReport(dir, step = null) {
  let report;
  try {
    report = JSON.parse(await readFile(join(dir, 'results.json'), 'utf8'));
  } catch {
    return null;
  }
  const scans = [];
  let interrupted = 0;
  eachTest(report, (_spec, t) => {
    for (const result of t.results)
      for (const a of result.attachments ?? []) {
        if (a.name !== 'a11y-journey' || !a.body) continue;
        try {
          const body = JSON.parse(
            Buffer.from(a.body, 'base64').toString('utf8'),
          );
          scans.push(...body.scans);
          interrupted += body.interrupted ?? 0;
        } catch {
          // A broken attachment: leave it out.
        }
      }
  });
  return groupScans(scans, { interrupted, step });
}

/** The scans a Claude journey wrote, one JSON object per line. */
export async function journeyFromFile(file, step = null) {
  const text = await readFile(file, 'utf8').catch(() => null);
  if (text === null) return null;
  const scans = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      scans.push(JSON.parse(line));
    } catch {
      // A line cut short when the browser closed.
    }
  }
  return groupScans(scans, { step });
}

/** Scans (from the scanner) grouped by page pattern. */
export function groupScans(scans, { interrupted = 0, step = null } = {}) {
  const journey = { scanned: 0, interrupted, pages: [] };
  for (const scan of scans) {
    journey.scanned++;
    const page = pageOf(journey, scan.pattern);
    addUnique(page.titles, scan.title);
    if (scan.dialog) addUnique(page.dialogs, scan.dialog);
    if (page.visits.length < MAX_VISITS)
      page.visits.push({
        url: scan.url,
        test: scan.test,
        project: scan.project,
        step,
        dialog: scan.dialog ?? null,
        layout: scan.layout ?? null,
        width: scan.width ?? null,
      });
    for (const v of scan.violations)
      addViolation(
        page,
        v,
        v.nodes.map((n) => ({ ...n, url: scan.url })),
      );
  }
  return sorted(journey);
}

/** Several groups (some may be null) as one; null when all are. */
export function mergeJourneys(list) {
  const parts = list.filter(Boolean);
  if (!parts.length) return null;
  const journey = { scanned: 0, interrupted: 0, pages: [] };
  for (const part of parts) {
    journey.scanned += part.scanned;
    journey.interrupted += part.interrupted;
    for (const p of part.pages) {
      const page = pageOf(journey, p.pattern);
      for (const t of p.titles) addUnique(page.titles, t);
      for (const d of p.dialogs) addUnique(page.dialogs, d);
      for (const visit of p.visits)
        if (page.visits.length < MAX_VISITS) page.visits.push(visit);
      for (const v of p.violations) addViolation(page, v, v.nodes);
    }
  }
  return sorted(journey);
}

/** passed | failed | null (nothing scanned), for a run's status. */
export function journeyStatus(journey) {
  if (!journey?.scanned) return null;
  return journey.pages.some((p) => p.violations.length) ? 'failed' : 'passed';
}

/** How many rules are broken, counted once per page. */
export const violationCount = (journey) =>
  (journey?.pages ?? []).reduce((n, p) => n + p.violations.length, 0);

function pageOf(journey, pattern) {
  let page = journey.pages.find((p) => p.pattern === pattern);
  if (!page) {
    page = { pattern, titles: [], dialogs: [], visits: [], violations: [] };
    journey.pages.push(page);
  }
  return page;
}

function addUnique(list, value) {
  if (value && !list.includes(value)) list.push(value);
}

// The rule once per page; its elements once each, by selector.
function addViolation(page, v, nodes) {
  let rule = page.violations.find((x) => x.id === v.id);
  if (!rule) {
    rule = {
      id: v.id,
      impact: v.impact ?? null,
      help: v.help,
      helpUrl: v.helpUrl,
      tags: v.tags ?? [],
      count: 0,
      nodes: [],
      targets: new Set(),
    };
    page.violations.push(rule);
  }
  rule.targets ??= new Set(rule.nodes.map((n) => n.target));
  for (const node of nodes) {
    if (rule.targets.has(node.target)) continue;
    rule.targets.add(node.target);
    rule.count++;
    if (rule.nodes.length < MAX_NODES) rule.nodes.push(node);
  }
  // Elements the scanner found but didn't list (past its first 20).
  const unlisted = (v.count ?? nodes.length) - nodes.length;
  if (unlisted > 0) rule.count += unlisted;
}

function sorted(journey) {
  for (const page of journey.pages) {
    for (const v of page.violations) delete v.targets;
    page.violations.sort((a, b) => rank(a.impact) - rank(b.impact));
  }
  const worst = (p) => Math.min(...p.violations.map((v) => rank(v.impact)));
  journey.pages.sort(
    (a, b) => worst(a) - worst(b) || a.pattern.localeCompare(b.pattern),
  );
  return journey;
}
