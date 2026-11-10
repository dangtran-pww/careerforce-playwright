// The shapes the dashboard API returns. The server builds them in
// dashboard/server/{index,plans,suites,runs,suite-runs}.mjs;
// keep these in step when you change what it sends.

// ---- environments and sessions ---------------------------------------------

export interface Env {
  id: string;
  name: string;
  baseURL: string;
  production: boolean;
}

export interface EnvironmentsResponse {
  environments: Env[];
  default: string;
}

export type SessionStatus =
  'valid' | 'expired' | 'missing' | 'no-access' | 'error';

// GET /api/sessions/:role
// GET /api/roles?env=<id>: admin first, then A–Z.
export interface RolesResponse {
  roles: string[];
}

export interface Session {
  role: string;
  status: SessionStatus;
  checkedAt: string;
  savedAt?: string;
  baseURL?: string;
  message?: string;
  loginCommand?: string;
}

// ---- plans -----------------------------------------------------------------

// A Playwright project and how many of a plan's tests it runs.
export interface ProjectTests {
  name: string;
  testCount: number;
}

export interface PlanProject extends ProjectTests {
  selected: boolean; // on by default
}

export interface PlanCase {
  id: string; // e.g. "AM-1"
  title: string;
  testCount: number;
  // The projects that run its tests (by default), e.g. smoke-desktop.
  projects: ProjectTests[];
  // Playwright tags on its tests, without the "@", e.g. "desktop-only".
  tags?: string[];
  // The rest of the case's row in the plan, e.g. Steps and Expected result.
  // The text may hold `code` and **bold**.
  details: CaseDetail[];
  // Where its tests are, one per test (not per project).
  locations: CaseLocation[];
}

export interface CaseDetail {
  label: string;
  text: string;
}

export interface CaseLocation {
  file: string;
  line: number;
  title: string;
  tags?: string[];
}

// GET/POST /api/plans/:slug/cases/:id/explanation: Claude's plain-words
// account of a case's test code (dashboard/server/explain.mjs).
export interface CaseExplanation {
  plan: string;
  case: string;
  summary: string;
  steps: { action: string; checks: string[] }[];
  notes: string[];
  files: string[];
  createdAt: string;
  // Left out of explanations saved before these were recorded.
  model?: string; // e.g. "claude-sonnet-4-6"
  tokens?: {
    in: number; // all input, cached included
    cached: number; // of `in`, read from the prompt cache
    out: number;
  };
  costUsd: number | null;
  stale: boolean; // the spec files changed since
}

export interface ExplanationResponse {
  explanation: CaseExplanation | null;
}

// One row of GET /api/plans.
export interface PlanSummary {
  slug: string;
  name: string;
  type: string;
  status: string; // a key of PLAN_STATUS
  changesData: boolean;
  roles: string[];
  cases: PlanCase[];
  runnable: boolean; // has tests
  testCount: number; // in the projects selected by default
  projects: PlanProject[];
  lastRun?: Run | null;
}

// A paragraph or bullet list of a plan's overview. Text keeps `code` and
// **bold**.
export type OverviewBlock =
  { kind: 'p'; text: string } | { kind: 'ul'; items: string[] };

// GET /api/plans/:slug
export interface Plan extends PlanSummary {
  summary?: string;
  overview?: OverviewBlock[]; // the whole "## Overview" section
  notes: string[];
  file: string;
  files: string[];
  runPaths: string[];
}

export interface PlansResponse {
  plans: PlanSummary[];
  site: string;
  activeRun: string | null;
  listErrors: string[];
}

export interface PlanResponse {
  plan: Plan;
  site: string;
  runs: Run[];
  activeRun: string | null;
}

// ---- suites ----------------------------------------------------------------

export interface SuitePlan {
  slug: string;
  found: boolean;
  type?: string;
  name?: string;
  runnable: boolean;
  caseCount?: number;
  testCount: number; // in the projects below
  projects: string[];
  projectTests?: ProjectTests[];
  roles?: string[];
  changesData?: boolean;
}

export interface SuitePrompt {
  id: string;
  name: string;
  role?: string;
  prompt: string;
}

export interface SuiteSummary {
  slug: string;
  name: string;
  summary?: string;
  plans: SuitePlan[];
  prompts: SuitePrompt[];
  lastRun?: Run | null;
}

export interface Suite extends SuiteSummary {
  file: string;
  problems: string[];
  changesData: boolean;
}

export interface SuitesResponse {
  suites: SuiteSummary[];
  activeRun: string | null;
}

export interface SuiteResponse {
  suite: Suite;
  runs: Run[];
  activeRun: string | null;
}

// ---- runs ------------------------------------------------------------------

export type RunStatus =
  | 'running'
  | 'passed'
  | 'failed'
  | 'attention'
  | 'stopped'
  | 'interrupted'
  | 'error';

export interface TestStats {
  expected: number;
  unexpected: number;
  flaky: number;
  skipped: number;
}

export type TestOutcome = keyof TestStats;

export interface TestResult {
  title: string;
  file: string;
  line: number;
  project: string;
  tags?: string[]; // left out of runs saved before tags were recorded
  duration: number;
  outcome: TestOutcome;
  expectedToFail?: boolean;
  error?: string;
}

// What Playwright reported, for a plan run or a suite's plan step.
export interface TestReport {
  stats?: TestStats;
  results?: TestResult[];
  errors?: string[];
}

export interface Finding {
  severity: 'problem' | 'note';
  text: string;
  screenshot?: string;
}

export interface SuiteStep extends TestReport {
  n: number;
  kind: 'plan' | 'prompt';
  title: string;
  status: string; // a key of STEP_STATUS
  dir: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  skipReason?: string;
  // plan steps
  command?: string;
  // prompt steps
  role?: string;
  file?: string;
  prompt?: string;
  summary?: string;
  findings?: Finding[];
  screenshots?: string[];
  turns?: number;
  costUsd?: number;
}

export interface Run extends TestReport {
  id: string;
  kind?: 'plan' | 'suite';
  plan?: string; // plan slug
  suite?: string; // suite slug
  planName: string;
  status: RunStatus;
  startedAt: string;
  finishedAt?: string;
  env?: Env;
  site?: string; // old runs only recorded the host
  cases: string[];
  projects: string[];
  steps?: SuiteStep[];
  command?: string;
}

export interface RunsResponse {
  runs: Run[];
  activeRun: string | null;
}

// GET /api/runs/:id?logFrom=N: the run, and its output from character N.
export interface RunWithLog extends Run {
  log: string;
  logLength: number;
}
