import type { RunStatus, SuiteSummary } from '../api/types';

// A suite's latest results: its plans' latest full runs (GET /api/suites
// planRuns) added up, under the worst of their statuses.
export interface SuiteResults {
  status: RunStatus;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  plansRun: number;
  plansTotal: number; // the plans it can run
  latestAt: string; // when the newest of those runs started
}

// Worst first: the status a suite shows when its plans' runs differ.
const SEVERITY: RunStatus[] = [
  'failed',
  'error',
  'attention',
  'interrupted',
  'stopped',
  'passed',
];

// Null when none of its plans has had a full run on this environment.
export function suiteResults(suite: SuiteSummary): SuiteResults | null {
  const runs = suite.planRuns ?? [];
  if (!runs.length) return null;
  const sum = (key: 'expected' | 'unexpected' | 'flaky' | 'skipped') =>
    runs.reduce((n, r) => n + (r.stats?.[key] ?? 0), 0);
  const failed = sum('unexpected');
  const worst = SEVERITY.find((s) => runs.some((r) => r.status === s));
  return {
    // A run can end "attention" with failed tests in it; failures win.
    status: failed ? 'failed' : (worst ?? 'passed'),
    passed: sum('expected'),
    failed,
    flaky: sum('flaky'),
    skipped: sum('skipped'),
    plansRun: runs.length,
    plansTotal: suite.plans.filter((p) => p.runnable).length,
    latestAt: runs.map((r) => r.startedAt).reduce((a, b) => (a > b ? a : b)),
  };
}
