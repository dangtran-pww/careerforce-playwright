// The run lifecycle: one run at a time on each environment (tests on one
// site share its accounts and database, so two runs there at once would
// collide), while runs on different environments go side by side. Within a run, the
// plans and prompt cases marked Parallel (test-suites/README.md, Rule 3) can
// have several processes going at once; Stop ends all of them. A run is one test plan (plan-run.mjs) or an accessibility
// run (a11y-run.mjs); they go
//   beginRun → launch( spawnStep / runPlaywright … → endRun )
//
// Each run gets a folder, reports/dashboard-runs/<id>/ (gitignored):
//   run.json       what was run, on which environment, its status and, once
//                  done, its results (a suite's run.json lists its steps)
//   output.log     the terminal output (list reporter), all steps
//   results.json   Playwright's JSON report          (plan runs)
//   report/        Playwright's HTML report          (plan runs)
//   test-results/  screenshots, videos and traces    (plan runs)
//   steps/<n>-<id>/  the same files for each step     (old suite runs)
//
// history.mjs reads runs back; the runs in progress come from here.
//
// log, isStopped and spawnStep act on the run whose work calls them: launch
// starts that work inside an AsyncLocalStorage holding the run, so code
// running on one environment never writes to or stops another's run.

import { AsyncLocalStorage } from 'node:async_hooks';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ApiError } from '../errors.mjs';
import { killGroup, quote } from '../lib/processes.mjs';
import { RUNS_DIR } from '../paths.mjs';

// Environment id → { meta, children, log, logFile, stopped }: the run in
// progress there. `children` are the processes it has going (Playwright,
// `claude`).
const active = new Map();

// The run whose work is calling (see launch).
const current = new AsyncLocalStorage();

const envOf = (meta) => meta.env.id;
const byId = (id) => [...active.values()].find((r) => r.meta.id === id);

// run.json writes, one after another: prompt cases that run at the same
// time all save the run, and two writes at once can mix their contents.
let saving = Promise.resolve();

const stamp = (d) =>
  d.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);

/** A run's id: when it started, then what it runs, e.g. qa and the plan. */
export const newRunId = (now, ...parts) => [stamp(now), ...parts].join('-');

/** Write the run's run.json. */
export function save(meta) {
  const write = () =>
    writeFile(
      join(RUNS_DIR, meta.id, 'run.json'),
      JSON.stringify(meta, null, 2),
    );
  const next = saving.then(write, write);
  saving = next.catch(() => {});
  return next;
}

/**
 * Take the lock on the run's environment, create the run's folder and save
 * its run.json.
 */
export async function beginRun(meta) {
  const envId = envOf(meta);
  const busy = active.get(envId);
  if (busy) {
    throw new ApiError(
      409,
      `A run is already in progress on ${meta.env.name} (${busy.meta.planName}). Wait for it or stop it first.`,
    );
  }
  const dir = join(RUNS_DIR, meta.id);
  // Claim the lock before the first await, so two quick clicks can't both
  // start.
  const run = {
    meta,
    children: new Set(),
    log: '',
    logFile: null,
    stopped: false,
  };
  active.set(envId, run);
  try {
    await mkdir(dir, { recursive: true });
    await save(meta);
  } catch (err) {
    active.delete(envId);
    throw err;
  }
  run.logFile = createWriteStream(join(dir, 'output.log'));
  return dir;
}

/**
 * Do the run's work in the background; the request that started it answers
 * straight away. `work` ends with endRun(meta). If it throws instead, the
 * run ends as an error, with the stack in its output.
 */
export function launch(meta, work) {
  current
    .run(byId(meta.id), work)
    .catch(async (err) => {
      log(`\n[dashboard] ${err.stack}\n`);
      meta.status = 'error';
      await endRun(meta);
    })
    .catch((err) => console.error(err));
}

/** Add text to the run's output (the page shows it live). */
export function log(text) {
  const run = current.getStore();
  if (!run) return;
  run.logFile?.write(text);
  run.log += text;
}

export const isStopped = () => Boolean(current.getStore()?.stopped);

/** Release the environment's lock and save the final run.json. */
export async function endRun(meta) {
  meta.finishedAt = new Date().toISOString();
  const run = byId(meta.id);
  await save(meta);
  await new Promise((done) => (run?.logFile ? run.logFile.end(done) : done()));
  if (run && active.get(envOf(meta)) === run) active.delete(envOf(meta));
}

/**
 * Run a command as part of the active run. Its output goes to the run's log
 * (through `logTo` when given) unless `onStdout` takes stdout. `onChild`
 * gets the process once it has started, e.g. to kill just this one.
 * Resolves with { code, error }.
 */
export function spawnStep(
  command,
  args,
  { env = {}, onStdout, onChild, logTo = log } = {},
) {
  return new Promise((done) => {
    const run = current.getStore();
    if (!run || run.stopped) return done({ code: null, error: null });
    logTo(`\n$ ${[command, ...args].map(quote).join(' ')}\n`);
    const child = spawn(command, args, {
      // Own process group, so Stop can end it and the browsers it starts.
      detached: true,
      env: { ...process.env, FORCE_COLOR: '0', ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    run.children.add(child);
    onChild?.(child);
    child.stdout.on('data', (chunk) =>
      onStdout ? onStdout(chunk.toString()) : logTo(chunk.toString()),
    );
    child.stderr.on('data', (chunk) => logTo(chunk.toString()));
    let settled = false;
    const finish = (code, error) => {
      if (settled) return;
      settled = true;
      run.children.delete(child);
      if (error)
        logTo(`\n[dashboard] Couldn't start ${command}: ${error.message}\n`);
      done({ code, error });
    };
    child.on('error', (err) => finish(null, err));
    child.on('close', (code) => finish(code));
  });
}

/** Stop the run `id` if it's in progress; false if it isn't. */
export function stopRun(id) {
  const run = byId(id);
  if (!run) return false;
  run.stopped = true;
  for (const child of run.children) killGroup(child);
  return true;
}

// Stop every run in progress when the dashboard exits, so no browser is
// left behind.
export function stopActiveRuns() {
  for (const run of active.values()) stopRun(run.meta.id);
}

/** The id of the run in progress on environment `envId`, if any. */
export const activeRunId = (envId) => active.get(envId)?.meta.id ?? null;

/** The ids of every run in progress, on any environment. */
export const activeRunIds = () => [...active.values()].map((r) => r.meta.id);

/** The run in progress, if it is `id`: { meta, log } (its output so far). */
export const activeRun = (id) => {
  const run = byId(id);
  return run ? { meta: run.meta, log: run.log } : null;
};
