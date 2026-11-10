// Runs tests for the dashboard, one run at a time (the tests share accounts
// and a staging database and run with workers: 1, so two runs at once would
// collide). A run is either one test plan (`startRun` below) or a suite of
// several steps (dashboard/server/suite-runs.mjs); both use the run lifecycle
// here: beginRun → spawnStep / runPlaywright … → endRun.
//
// Each run gets a folder, reports/dashboard-runs/<id>/ (gitignored):
//   run.json       what was run, on which environment, its status and, once
//                  done, its results (a suite's run.json lists its steps)
//   output.log     the terminal output (list reporter), all steps
//   results.json   Playwright's JSON report          (plan runs)
//   report/        Playwright's HTML report          (plan runs)
//   test-results/  screenshots, videos and traces    (plan runs)
//   steps/<n>-<id>/  the same files for each step     (suite runs)

import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { caseGrep } from './plans.mjs';
import { hostOf } from '../../scripts/lib/site.mjs';

// Terminal colour codes, in error messages.
// eslint-disable-next-line no-control-regex
const ansi = /\u001b\[[0-9;]*m/g;

export const runsDir = join('reports', 'dashboard-runs');

// { meta, child, log, logFile, stopped }: the run in progress, if any.
let active = null;

const stamp = (d) =>
  d.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
export const quote = (a) =>
  /^[\w./=:@-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`;

// What a run records about its environment (no credentials).
export const envInfo = (env) => ({
  id: env.id,
  name: env.name,
  baseURL: env.baseURL,
  production: env.production,
});

export async function save(meta) {
  await writeFile(
    join(runsDir, meta.id, 'run.json'),
    JSON.stringify(meta, null, 2),
  );
}

// Plans whose tests live in tests/stage/ create, edit or delete content.
export const changesData = (plan) =>
  plan.files.some((f) => f.startsWith('tests/stage/'));

// `details` is extra JSON sent along with the error message, e.g. the
// logins that stopped a suite run.
export class RunError extends Error {
  constructor(status, message, details = {}) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// ---- run lifecycle ---------------------------------------------------------

/** Take the one-run lock, create the run's folder and save its run.json. */
export async function beginRun(meta) {
  if (active) {
    throw new RunError(
      409,
      `A run is already in progress (${active.meta.planName}). Wait for it or stop it first.`,
    );
  }
  const dir = join(runsDir, meta.id);
  // Claim the lock before the first await, so two quick clicks can't both
  // start.
  active = { meta, child: null, log: '', logFile: null, stopped: false };
  try {
    await mkdir(dir, { recursive: true });
    await save(meta);
  } catch (err) {
    active = null;
    throw err;
  }
  active.logFile = createWriteStream(join(dir, 'output.log'));
  return dir;
}

/** Add text to the run's output (the page shows it live). */
export function log(text) {
  if (!active) return;
  active.logFile?.write(text);
  active.log += text;
}

export const isStopped = () => Boolean(active?.stopped);

/** Release the lock and save the final run.json. */
export async function endRun(meta) {
  meta.finishedAt = new Date().toISOString();
  const run = active;
  await save(meta);
  await new Promise((done) => (run?.logFile ? run.logFile.end(done) : done()));
  if (active === run) active = null;
}

/**
 * Run a command as part of the active run. Its output goes to the run's log
 * unless `onStdout` takes stdout. Resolves with { code, error }.
 */
export function spawnStep(command, args, { env = {}, onStdout } = {}) {
  return new Promise((done) => {
    if (!active || active.stopped) return done({ code: null, error: null });
    log(`\n$ ${[command, ...args].map(quote).join(' ')}\n`);
    const child = spawn(command, args, {
      // Own process group, so Stop can end it and the browsers it starts.
      detached: true,
      env: { ...process.env, FORCE_COLOR: '0', ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    active.child = child;
    child.stdout.on('data', (chunk) =>
      onStdout ? onStdout(chunk.toString()) : log(chunk.toString()),
    );
    child.stderr.on('data', (chunk) => log(chunk.toString()));
    let settled = false;
    const finish = (code, error) => {
      if (settled) return;
      settled = true;
      if (active?.child === child) active.child = null;
      if (error)
        log(`\n[dashboard] Couldn't start ${command}: ${error.message}\n`);
      done({ code, error });
    };
    child.on('error', (err) => finish(null, err));
    child.on('close', (code) => finish(code));
  });
}

/** Kill the step that is running, if any. */
export function killChild() {
  const child = active?.child;
  if (!child) return;
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
}

/**
 * `npx playwright test <args>` against `env`, with its JSON and HTML reports
 * and test output in `dir`. Resolves with { code, summary } where summary is
 * { stats, results, errors } from the JSON report, or null when Playwright
 * stopped before running anything.
 */
export async function runPlaywright({ dir, env, args }) {
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

// The shell command shown on the page, with the environment in front.
export const shownCommand = (env, args) =>
  [`BASE_URL=${env.baseURL}`, 'npx', ...args].map(quote).join(' ');

// ---- plan runs -------------------------------------------------------------

/** Playwright arguments that run a plan's chosen projects and cases. */
export function planArgs(plan, { projects, cases = [], headed = false } = {}) {
  const known = new Set(plan.projects.map((p) => p.name));
  const chosen = (
    projects ?? plan.projects.filter((p) => p.selected).map((p) => p.name)
  ).filter((p) => known.has(p));
  if (!chosen.length)
    throw new RunError(
      400,
      `Pick at least one project to run for ${plan.name}.`,
    );
  const caseIds = new Set(plan.cases.map((c) => c.id));
  const chosenCases = cases.filter((c) => caseIds.has(c));
  if (cases.length && !chosenCases.length)
    throw new RunError(400, 'None of those cases are in this plan.');
  return {
    projects: chosen,
    cases: chosenCases,
    args: [
      ...plan.runPaths,
      ...chosen.flatMap((p) => ['--project', p]),
      ...(chosenCases.length ? ['-g', caseGrep(chosenCases)] : []),
      ...(headed ? ['--headed'] : []),
    ],
  };
}

/** Refuse plans that can't run on this environment. */
export function checkPlanRunnable(plan, env) {
  if (!plan.runnable)
    throw new RunError(400, `${plan.name} has no implemented tests to run.`);
  if (changesData(plan) && env.production) {
    throw new RunError(
      400,
      `${plan.name} creates, edits or deletes content, and ${env.name} (${hostOf(env)}) is production. Stage plans never run there.`,
    );
  }
}

export async function startRun(
  plan,
  { env, projects, cases = [], headed = false } = {},
) {
  checkPlanRunnable(plan, env);
  const chosen = planArgs(plan, { projects, cases, headed });

  const now = new Date();
  const id = `${stamp(now)}-${env.id}-${plan.slug}`;
  const meta = {
    id,
    kind: 'plan',
    plan: plan.slug,
    planName: `${plan.type} - ${plan.name}`,
    projects: chosen.projects,
    cases: chosen.cases,
    headed,
    env: envInfo(env),
    site: hostOf(env),
    command: shownCommand(env, ['playwright', 'test', ...chosen.args]),
    status: 'running',
    startedAt: now.toISOString(),
    finishedAt: null,
    exitCode: null,
    stats: null,
    results: null,
  };
  const dir = await beginRun(meta);

  (async () => {
    const result = await runPlaywright({ dir, env, args: chosen.args });
    meta.exitCode = result.code;
    Object.assign(meta, result.summary ?? {});
    meta.status = playwrightStatus(result);
    await endRun(meta);
  })().catch(async (err) => {
    log(`\n[dashboard] ${err.stack}\n`);
    meta.status = 'error';
    await endRun(meta);
  });

  return meta;
}

// ---- results ---------------------------------------------------------------

// Attachment paths in the JSON report are absolute; the page needs them
// relative to the run folder (served at /runs/<id>/...).
const rel = (path) => relative(resolve(runsDir), path).split('\\').join('/');

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

export const stripAnsi = (text) => text.replace(ansi, '');

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
      error: error
        ? error.replace(ansi, '').split('\n').slice(0, 6).join('\n')
        : null,
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
    errors: (report.errors ?? []).map((e) =>
      (e.message ?? '').replace(ansi, ''),
    ),
  };
}

// ---- stop, read, list ------------------------------------------------------

export function stopRun(id) {
  if (!active || active.meta.id !== id) return false;
  active.stopped = true;
  killChild();
  return true;
}

// Stop a run in progress when the dashboard exits, so no browser is left
// behind.
export function stopActiveRun() {
  if (active) stopRun(active.meta.id);
}

export const activeRunId = () => active?.meta.id ?? null;
export const newRunId = (now, ...parts) => [stamp(now), ...parts].join('-');

// The run's run.json (or the run in progress), without its output.
export async function readMeta(id) {
  if (!/^[\w-]+$/.test(id)) return null;
  if (active?.meta.id === id) return active.meta;
  try {
    const meta = JSON.parse(
      await readFile(join(runsDir, id, 'run.json'), 'utf8'),
    );
    // Left "running" by a dashboard that was closed mid-run.
    if (meta.status === 'running') meta.status = 'interrupted';
    for (const step of meta.steps ?? [])
      if (step.status === 'running') step.status = 'interrupted';
    meta.kind ??= 'plan';
    return meta;
  } catch {
    return null;
  }
}

// The run, with its output from character `logFrom` on, so the page can
// fetch only what's new while it runs.
export async function getRun(id, { logFrom = 0 } = {}) {
  const meta = await readMeta(id);
  if (!meta) return null;
  const log =
    active?.meta.id === id
      ? active.log
      : await readFile(join(runsDir, id, 'output.log'), 'utf8').catch(() => '');
  return { ...meta, logLength: log.length, log: log.slice(logFrom) };
}

// Newest first, without per-test results or output. `plan` / `suite` /
// `env` narrow it down.
export async function listRuns({ plan, suite, env, limit = 50 } = {}) {
  const names = await readdir(runsDir).catch(() => []);
  const runs = [];
  for (const name of names.sort().reverse()) {
    if (runs.length >= limit) break;
    const meta = await readMeta(name);
    if (!meta) continue;
    if (plan && meta.plan !== plan) continue;
    if (suite && meta.suite !== suite) continue;
    if (env && (meta.env?.id ?? 'qa') !== env) continue;
    runs.push({
      ...meta,
      results: undefined,
      steps: meta.steps?.map((s) => ({
        id: s.id,
        kind: s.kind,
        title: s.title,
        status: s.status,
      })),
    });
  }
  return runs;
}
