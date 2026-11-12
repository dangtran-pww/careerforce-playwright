// The shapes the dashboard API returns. The server builds them in
// dashboard/server/routes/*.mjs;
// keep these in step when you change what it sends.

// ---- environments and sessions ---------------------------------------------

export interface Env {
  id: string;
  name: string;
  baseURL: string;
  production: boolean;
  // What prompt cases that compare sites compare it with: an environment id
  // or "baseline" (its last run's screenshots).
  compareWith?: string;
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
  // The logged-in account's email; only when the site accepts the session
  // and the account's edit form shows it.
  email?: string;
  // The account's profile type (Job Seeker, Partner, Staff; '' for none),
  // from its own pages, and roles ([] for none; shown as "Authenticated
  // user"), from the People list via
  // the admin session. When the roles can't be read, detailsNote says why.
  profileType?: string;
  roles?: string[];
  detailsNote?: string;
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
  // "prompt": no test code; Claude runs its prompt file in a browser
  // (test-plans/README.md, Rule 2). Older servers leave it out ("test").
  kind?: 'test' | 'prompt';
  prompt?: PromptCheck | null; // its prompt file; null when it's missing
  promptProblems?: string[]; // what's wrong with that file
  testCount: number;
  // The projects that run its tests (by default), e.g. smoke-desktop.
  projects: ProjectTests[];
  // Playwright tags on its tests, without the "@", e.g. "desktop-only".
  tags?: string[];
  // Never runs on production: its plan is no-prod, it says "No" in the
  // plan's Prod column, or its tests are tagged @no-prod. The reason is the
  // text after "No".
  noProd?: boolean;
  noProdReason?: string | null;
  // The plan says "No" but some of its tests aren't tagged @no-prod.
  noProdUntagged?: boolean;
  // The rest of the case's row in the plan, e.g. Steps and Expected result.
  // The text may hold `code` and **bold**.
  details: CaseDetail[];
  // Where its tests are, one per test (not per project).
  locations: CaseLocation[];
}

// A prompt file in test-plans/prompts/ (scripts/lib/prompts.mjs).
export interface Viewport {
  name: string;
  width: number;
  height: number;
}

export interface PromptCheck {
  slug: string;
  file: string;
  name: string;
  role: string | null;
  // none | default | baseline | an environment id
  compare: string;
  viewports: Viewport[];
  screenshots: number; // at most
  prompt: string;
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
// account of a case's test code (dashboard/server/claude/explain.mjs).
export interface CaseExplanation {
  plan: string;
  case: string;
  summary: string;
  steps: { action: string; checks: string[] }[];
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

// Who answered a Claude request, when, and what it took.
export interface ClaudeUsage {
  createdAt: string;
  model?: string;
  tokens?: { in: number; cached: number; out: number };
  costUsd: number | null;
}

// GET/POST /api/plans/:slug/cases/:id/review: Claude's review of a case's
// code against its plan row (dashboard/server/claude/review.mjs). Kept in the
// server's memory, never on disk.
export type ReviewVerdict = 'matches' | 'partial' | 'differs';
export type ReviewFindingKind = 'missing' | 'different' | 'extra' | 'covered';

export interface CaseReview extends ClaudeUsage {
  plan: string;
  case: string;
  verdict: ReviewVerdict;
  summary: string;
  findings: { kind: ReviewFindingKind; text: string }[];
  files: string[];
  stale: boolean; // the spec files changed since
}

// POST
export interface ReviewResponse {
  review: CaseReview;
}

// GET
export interface LatestReviewResponse {
  review: CaseReview | null;
  reviewing: boolean; // one is running now
}

// One row of GET /api/plans.
export interface PlanSummary {
  slug: string;
  name: string;
  type: string;
  status: string; // a key of PLAN_STATUS
  // "Prod: No: <reason>" in the header: no case runs on production.
  noProd: boolean;
  noProdReason: string | null;
  noProdUntagged?: boolean; // some of its tests aren't tagged @no-prod
  noProdCases: string[]; // left out of runs on production
  roles: string[];
  cases: PlanCase[];
  runnable: boolean; // has tests or a usable prompt case
  hasTests?: boolean; // has Playwright tests
  promptCases?: string[]; // ids of its prompt cases
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

// GET /api/plans/:slug/markdown
export interface PlanMarkdownResponse {
  file: string;
  markdown: string;
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
  noProd?: boolean; // the whole plan is no-prod
  noProdCases?: string[]; // left out of runs on production
  allNoProd?: boolean; // so the plan is skipped on production
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
// From Playwright's output while it runs: how many tests it has, on how
// many workers, and how many have ended. Runs from before this have none.
export interface TestProgress {
  total: number;
  workers: number;
  done: number;
}

export interface TestReport {
  tests?: TestProgress;
  stats?: TestStats;
  results?: TestResult[];
  errors?: string[];
}

// Names one test of a run; `step` is the suite step's number (plan runs
// have none).
export interface TestRef {
  step: number | null;
  project: string;
  file: string;
  line: number;
  title: string;
}

// GET/POST /api/runs/:id/explanations: Claude's account of why a test
// failed (dashboard/server/claude/failure.mjs), saved in the run's folder.
export type FailureCause =
  'site' | 'test' | 'environment' | 'flaky' | 'unclear';

export interface FailureExplanation extends TestRef, ClaudeUsage {
  run: string;
  cause: FailureCause;
  confidence: 'high' | 'medium' | 'low';
  headline: string;
  whatHappened: string;
  why: string;
  evidence: string[];
  nextSteps: string[];
}

// GET
export interface FailureExplanationsResponse {
  explanations: FailureExplanation[];
}

// POST
export interface FailureExplanationResponse {
  explanation: FailureExplanation;
}

// GET/POST /api/runs/:id/summary: Claude's quick summary of a run's
// failures, grouped into the issues behind them
// (dashboard/server/claude/summary.mjs), saved in the run's folder.
export interface RunIssue {
  title: string;
  cause: FailureCause;
  tests: string[]; // "<title> (<project>)", plus " — step N" in a suite
  detail: string;
  nextStep: string;
}

export interface RunSummary extends ClaudeUsage {
  run: string;
  headline: string;
  overview: string;
  issues: RunIssue[];
  nextSteps: string[];
}

export interface RunSummaryResponse {
  summary: RunSummary | null; // GET: null until one is made
}

export interface Finding {
  severity: 'problem' | 'note';
  text: string;
  screenshot?: string;
  viewport?: string;
}

// What a prompt check compared with (dashboard/server/runs/prompt.mjs).
export interface PromptCompare {
  mode: 'none' | 'site' | 'baseline';
  envId?: string; // site
  envName?: string;
  baseURL?: string;
  baselineFrom?: string | null; // baseline: the run it came from; null if none
}

// One prompt check's result: a suite's prompt step, or a plan's prompt case
// in a plan run (Run.prompts) or a suite's plan step (SuiteStep.prompts).
export interface PromptResult {
  id?: string;
  title?: string;
  status: string; // a key of STEP_STATUS
  slug?: string;
  file?: string;
  role?: string | null;
  prompt?: string;
  viewports?: Viewport[];
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  skipReason?: string;
  compare?: PromptCompare;
  summary?: string;
  findings?: Finding[];
  screenshots?: string[];
  baselineScreenshots?: string[];
  turns?: number;
  costUsd?: number;
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
  plan?: string; // plan slug
  projects?: string[];
  command?: string;
  prompts?: PromptResult[]; // the plan's prompt cases
  // prompt steps
  role?: string;
  file?: string;
  prompt?: string;
  viewports?: Viewport[];
  compare?: PromptCompare;
  summary?: string;
  findings?: Finding[];
  screenshots?: string[];
  baselineScreenshots?: string[];
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
  headed?: boolean;
  steps?: SuiteStep[];
  command?: string | null; // null: only prompt cases ran
  prompts?: PromptResult[]; // a plan run's prompt cases
  compare?: string | null; // the "Compare with" choice, if one was made
}

// GET /api/runs/:id?logFrom=N: the run, and its output from character N.
export interface RunWithLog extends Run {
  log: string;
  logLength: number;
}
