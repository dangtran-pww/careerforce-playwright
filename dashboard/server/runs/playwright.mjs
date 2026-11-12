// Running Playwright for a run: which arguments run a plan's chosen projects
// and cases, running `npx playwright test` as a step of the run, and reading
// its JSON report.

import { mkdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { hostOf } from '../../../scripts/lib/site.mjs';
import { allNoProd, caseGrep } from '../catalog/plans.mjs';
import { ApiError } from '../errors.mjs';
import { quote } from '../lib/processes.mjs';
import { RUNS_DIR } from '../paths.mjs';
import { isStopped, log, spawnStep } from './lifecycle.mjs';

// Terminal colour codes, in error messages.
// eslint-disable-next-line no-control-regex
const ansi = /\u001b\[[0-9;]*m/g;

export const stripAnsi = (text) => text.replace(ansi, '');

// ---- what to run -----------------------------------------------------------

/** Refuse plans that have nothing to run. */
export function checkPlanRunnable(plan) {
  if (!plan.runnable)
    throw new ApiError(400, `${plan.name} has no implemented tests to run.`);
}

/** Whether `project` has a test for any of the `cases` (ids). */
const runsAnyCase = (plan, project, cases) =>
  plan.cases.some(
    (c) => cases.includes(c.id) && c.projects?.some((p) => p.name === project),
  );

/**
 * Playwright arguments that run a plan's chosen projects and cases on `env`.
 * On production the plan's no-prod cases are left out (and refused when they
 * are all that was asked for).
 *
 * Prompt cases have no tests (runs/prompt-step.mjs runs them), so they are
 * left out here. Null when there is nothing for Playwright to run: the plan
 * has no tests, or only prompt cases were picked, or on production every
 * case with tests is no-prod while a prompt case still runs.
 */
export function planArgs(
  plan,
  { env, projects, cases = [], headed = false } = {},
) {
  const isTestCase = (id) =>
    plan.cases.some((c) => c.id === id && c.kind !== 'prompt');
  const promptIds = plan.cases
    .filter((c) => c.kind === 'prompt')
    .map((c) => c.id);
  if (!plan.hasTests) return null;
  if (cases.length && cases.some((id) => promptIds.includes(id))) {
    const testCases = cases.filter(isTestCase);
    if (!testCases.length) return null;
    cases = testCases;
  }
  if (
    !cases.length &&
    env?.production &&
    promptIds.length &&
    plan.cases
      .filter((c) => c.kind !== 'prompt' && c.testCount > 0)
      .every((c) => c.noProd)
  )
    return null;
  const known = new Set(plan.projects.map((p) => p.name));
  const chosen = (
    projects ?? plan.projects.filter((p) => p.selected).map((p) => p.name)
  ).filter((p) => known.has(p));
  if (!chosen.length)
    throw new ApiError(
      400,
      `Pick at least one project to run for ${plan.name}.`,
    );
  if (env?.production && plan.noProd)
    throw new ApiError(
      400,
      `${plan.name} is marked no-prod, so it never runs on ${env.name} (${hostOf(env)}).`,
    );
  const caseIds = new Set(plan.cases.map((c) => c.id));
  const asked = cases.filter((c) => caseIds.has(c));
  if (cases.length && !asked.length)
    throw new ApiError(400, 'None of those cases are in this plan.');

  // Production: drop the no-prod cases. The config already leaves out tests
  // tagged @no-prod there; --grep-invert also catches a case the plan marks
  // "No" whose tests aren't tagged yet.
  const noProd = env?.production ? (plan.noProdCases ?? []) : [];
  const chosenCases = asked.filter((c) => !noProd.includes(c));
  const offProd = (ids) =>
    new ApiError(
      400,
      `${ids.join(', ')} ${ids.length > 1 ? 'are' : 'is'} marked no-prod, so ${ids.length > 1 ? 'they never run' : 'it never runs'} on ${env.name} (${hostOf(env)}).`,
    );
  if (asked.length && !chosenCases.length) throw offProd(asked);
  if (!asked.length && noProd.length && allNoProd(plan))
    throw new ApiError(
      400,
      `Every case of ${plan.name} is marked no-prod, so it never runs on ${env.name} (${hostOf(env)}).`,
    );
  const runnableCases = chosenCases.length
    ? chosenCases
    : noProd.length
      ? plan.cases
          .filter((c) => !c.noProd && c.kind !== 'prompt')
          .map((c) => c.id)
      : [];

  // With cases picked (or no-prod ones left out), only the projects that run
  // at least one of them: a @desktop-only case such as HP-3 has no tests in
  // smoke-mobile, and Playwright fails a project/grep pair that matches
  // nothing.
  const projectsForCases = runnableCases.length
    ? chosen.filter((p) => runsAnyCase(plan, p, runnableCases))
    : chosen;
  if (!projectsForCases.length)
    throw new ApiError(
      400,
      `${runnableCases.join(', ')} ${runnableCases.length > 1 ? "don't" : "doesn't"} run in ${chosen.join(' or ')}.`,
    );
  return {
    projects: projectsForCases,
    cases: chosenCases,
    args: [
      ...plan.runPaths,
      ...projectsForCases.flatMap((p) => ['--project', p]),
      ...(chosenCases.length ? ['-g', caseGrep(chosenCases)] : []),
      ...(noProd.length ? ['--grep-invert', caseGrep(noProd)] : []),
      ...(headed ? ['--headed'] : []),
    ],
  };
}

// The shell command shown on the page, with the environment in front.
export const shownCommand = (env, args) =>
  [`BASE_URL=${env.baseURL}`, 'npx', ...args].map(quote).join(' ');

// ---- running it ------------------------------------------------------------

// The list reporter's lines: "Running 12 tests using 1 worker" once, then
// "  ✓   3 [smoke-desktop] › …" as each test ends ("(retry #1)" on a retry).
const runningLine = /^Running (\d+) tests? using (\d+) workers?/;
const endedLine = /^\s+[✓✘-]\s+\d+ \[/;

/**
 * Read Playwright's output as it comes and keep `target.tests` up to date:
 * { total, workers, done }, so the page can show how many tests the run has
 * and how many have ended. Returns the stdout handler.
 */
function trackTests(target) {
  let partial = '';
  return (chunk) => {
    log(chunk);
    const lines = (partial + chunk).split('\n');
    partial = lines.pop();
    for (const line of lines) {
      const running = runningLine.exec(line);
      if (running)
        target.tests = {
          total: Number(running[1]),
          workers: Number(running[2]),
          done: 0,
        };
      else if (
        target.tests &&
        endedLine.test(line) &&
        !/\(retry #\d+\)/.test(line)
      )
        target.tests.done++;
    }
  };
}

/**
 * `npx playwright test <args>` against `env`, with its JSON and HTML reports
 * and test output in `dir`. While it runs, `progress.tests` says how many
 * tests it has and how many have ended (see trackTests). Resolves with
 * { code, summary } where summary is { stats, results, errors } from the JSON
 * report, or null when Playwright stopped before running anything.
 */
export async function runPlaywright({ dir, env, args, progress }) {
  await mkdir(dir, { recursive: true });
  const fullArgs = [
    'playwright',
    'test',
    ...args,
    '--reporter=list,json,html',
    '--output',
    join(dir, 'test-results'),
  ];
  const { code } = await spawnStep('npx', fullArgs, {
    env: {
      BASE_URL: env.baseURL,
      PLAYWRIGHT_JSON_OUTPUT_FILE: join(dir, 'results.json'),
      PLAYWRIGHT_HTML_OUTPUT_DIR: join(dir, 'report'),
      PLAYWRIGHT_HTML_OPEN: 'never',
    },
    onStdout: progress ? trackTests(progress) : undefined,
  });
  let summary = null;
  try {
    summary = summarize(
      JSON.parse(await readFile(join(dir, 'results.json'), 'utf8')),
    );
  } catch {
    // No JSON report: Playwright stopped before running (config error, no
    // tests matched) or was stopped.
  }
  return { code, summary };
}

/** passed | failed | stopped | error, for a Playwright run's result. */
export const playwrightStatus = ({ code, summary }) =>
  isStopped()
    ? 'stopped'
    : summary?.stats.unexpected > 0
      ? 'failed'
      : code === 0 && summary
        ? 'passed'
        : 'error';

// ---- reading its report ----------------------------------------------------

// Attachment paths in the JSON report are absolute; the page needs them
// relative to the runs folder (served at /runs/<id>/...).
const rel = (path) => relative(resolve(RUNS_DIR), path).split('\\').join('/');

/**
 * Call fn(spec, test, title) for every test in a Playwright JSON report.
 * `title` is the spec's title under its describe blocks, joined with " › ";
 * with project, file and line it names a test in summarize()'s results.
 */
export function eachTest(report, fn) {
  const walk = (suite, path) => {
    for (const spec of suite.specs ?? [])
      for (const t of spec.tests)
        fn(spec, t, [...path, spec.title].join(' › '));
    for (const child of suite.suites ?? []) walk(child, [...path, child.title]);
  };
  for (const file of report.suites ?? []) walk(file, []);
}

/** A run's stats, per-test results and errors, from its JSON report. */
export function summarize(report) {
  const results = [];
  eachTest(report, (spec, t, title) => {
    const last = t.results.at(-1);
    const error = last?.errors?.[0]?.message ?? last?.error?.message;
    results.push({
      project: t.projectName,
      file: spec.file,
      title,
      line: spec.line,
      tags: spec.tags ?? [],
      // expected | unexpected | flaky | skipped
      outcome: t.status,
      duration: t.results.reduce((sum, r) => sum + (r.duration ?? 0), 0),
      retries: Math.max(0, t.results.length - 1),
      error: error ? stripAnsi(error).split('\n').slice(0, 6).join('\n') : null,
      expectedToFail: t.expectedStatus === 'failed',
      // Image attachments (screenshots), path relative to
      // reports/dashboard-runs/.
      images: (last?.attachments ?? [])
        .filter((a) => a.path && a.contentType?.startsWith('image/'))
        .map((a) => ({ name: a.name, path: rel(a.path) })),
    });
  });
  const {
    expected = 0,
    unexpected = 0,
    flaky = 0,
    skipped = 0,
    duration = 0,
  } = report.stats ?? {};
  return {
    stats: { expected, unexpected, flaky, skipped, duration },
    results,
    errors: (report.errors ?? []).map((e) => stripAnsi(e.message ?? '')),
  };
}
