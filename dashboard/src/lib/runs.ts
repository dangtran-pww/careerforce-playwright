// Facts about a run.

import type { Run } from '../api/types';
import { elapsed, plural } from './format';

// A run's or step's files are served at /runs/<path>, path relative to
// reports/dashboard-runs/.
export const runFile = (path: string) => `/runs/${encodeURI(path)}`;

// The page a run was started from: its suite's page (for a plan run, with
// that plan's panel open), or the suite list for an older plan run that
// didn't record its suite.
export function runOwnerPath(run: Run): string {
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
