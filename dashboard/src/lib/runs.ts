// Facts about a run.

import type { A11yCounts, A11yJourney, Run } from '../api/types';
import { elapsed, plural } from './format';

// A run's or step's files are served at /runs/<path>, path relative to
// reports/dashboard-runs/.
export const runFile = (path: string) => `/runs/${encodeURI(path)}`;

// The id of a test's row in a run's results (TestResults), for links to it
// from the run's summary. `step` is the suite step, null in a plan run.
export const testRowId = (
  step: number | null,
  t: { project: string; file: string; line: number; title: string },
) =>
  `test-${step ?? 0}-${t.project}-${t.file}-${t.line}-${t.title}`.replace(
    /[^\w-]+/g,
    '_',
  );

// Scrolls to a test's row in the run's results and marks it briefly,
// opening its suite step first if that is closed. False when the row isn't
// on the page.
export function showTestRow(id: string): boolean {
  const row = document.getElementById(id);
  if (!row) return false;
  const step = row.closest('details');
  if (step && !step.open) step.open = true;
  row.classList.remove('row-highlight');
  void row.offsetWidth; // restart the animation on a second click
  row.classList.add('row-highlight');
  row.scrollIntoView({ block: 'center', behavior: 'smooth' });
  return true;
}

// The page a run was started from: its suite's page (for a plan run, with
// that plan's panel open), the Accessibility page for a scan, or the suite
// list for an older plan run that didn't record its suite.
export function runOwnerPath(run: Run): string {
  if (run.kind === 'a11y-journey') return '/a11y';
  if (!run.suite) return '/suites';
  if (run.kind === 'suite') return `/suites/${run.suite}`;
  return `/suites/${run.suite}?plan=${encodeURIComponent(run.plan ?? '')}`;
}

// How long it took, or has taken so far.
export const runDuration = (run: Run) => elapsed(run.startedAt, run.finishedAt);

// Short counts for a finished run, e.g. "40 passed · 2 failed".
export function runCounts(run: Run): string | null {
  if (!run.stats) return null;
  const { expected, unexpected, flaky, skipped } = run.stats;
  return [
    expected && `${expected} passed`,
    unexpected && `${unexpected} failed`,
    flaky && `${flaky} flaky`,
    skipped && `${skipped} skipped`,
  ]
    .filter(Boolean)
    .join(' · ');
}

// What a run covered, e.g. "HP-1, HP-2 · chromium" or "2 plans · 1 prompt".
export function whatRan(run: Run): string {
  if (run.kind === 'a11y-journey' && run.journey)
    return `Journey · ${run.journey.role ? `as ${run.journey.role}` : 'visitor'} · ${run.journey.device}`;
  if (run.kind === 'suite') {
    const steps = run.steps ?? [];
    const count = (kind: string) => steps.filter((s) => s.kind === kind).length;
    return [
      count('plan') && plural(count('plan'), 'plan'),
      count('prompt') && plural(count('prompt'), 'prompt'),
    ]
      .filter(Boolean)
      .join(' · ');
  }
  const cases = run.cases.length
    ? `${run.cases.join(', ')} · `
    : 'All cases · ';
  return `${cases}${run.projects.join(', ')}`;
}

// A run's full accessibility result (on its own page), not the counts the
// run list carries.
export function fullA11y(run: Run): A11yJourney | null {
  const a = run.a11y;
  return a && Array.isArray(a.pages) ? (a as A11yJourney) : null;
}

// What a run's accessibility scans found, e.g. "3 rules broken · 12 pages";
// null when it didn't scan.
export function a11yCounts(run: Run): string | null {
  const a = run.a11y;
  if (!a) return run.a11yScan ? 'Nothing scanned' : null;
  const full = fullA11y(run);
  const pages = full ? full.pages.length : (a as A11yCounts).pages;
  const rules = full
    ? full.pages.reduce((n, p) => n + p.violations.length, 0)
    : (a as A11yCounts).violations;
  return `${rules ? `${plural(rules, 'rule')} broken` : 'Nothing broken'} · ${plural(pages, 'page')}`;
}
