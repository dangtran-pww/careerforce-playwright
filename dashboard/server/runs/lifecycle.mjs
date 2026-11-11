// The run lifecycle: one run at a time (the tests share accounts and a
// staging database and run with workers: 1, so two runs at once would
// collide). A run is either one test plan (plan-run.mjs) or a suite of
// several steps (suite-run.mjs); both go
//   beginRun → launch( spawnStep / runPlaywright … → endRun )
//
// Each run gets a folder, reports/dashboard-runs/<id>/ (gitignored):
//   run.json       what was run, on which environment, its status and, once
//                  done, its results (a suite's run.json lists its steps)
//   output.log     the terminal output (list reporter), all steps
//   results.json   Playwright's JSON report          (plan runs)
//   report/        Playwright's HTML report          (plan runs)
//   test-results/  screenshots, videos and traces    (plan runs)
//   steps/<n>-<id>/  the same files for each step     (suite runs)
//
// history.mjs reads runs back; the run in progress comes from here.

import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ApiError } from '../errors.mjs';
import { killGroup, quote } from '../lib/processes.mjs';
import { RUNS_DIR } from '../paths.mjs';

// { meta, child, log, logFile, stopped }: the run in progress, if any.
let active = null;

const stamp = (d) =>
  d.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);

/** A run's id: when it started, then what it runs, e.g. qa and the plan. */
export const newRunId = (now, ...parts) => [stamp(now), ...parts].join('-');

/** Write the run's run.json. */
export async function save(meta) {
  await writeFile(
    join(RUNS_DIR, meta.id, 'run.json'),
    JSON.stringify(meta, null, 2),
  );
}

/** Take the one-run lock, create the run's folder and save its run.json. */
export async function beginRun(meta) {
  if (active) {
    throw new ApiError(
      409,
      `A run is already in progress (${active.meta.planName}). Wait for it or stop it first.`,
    );
  }
  const dir = join(RUNS_DIR, meta.id);
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

/**
 * Do the run's work in the background; the request that started it answers
 * straight away. `work` ends with endRun(meta). If it throws instead, the
 * run ends as an error, with the stack in its output.
 */
export function launch(meta, work) {
  work()
    .catch(async (err) => {
      log(`\n[dashboard] ${err.stack}\n`);
      meta.status = 'error';
      await endRun(meta);
    })
    .catch((err) => console.error(err));
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
  if (active?.child) killGroup(active.child);
}

/** Stop the run `id` if it's the one in progress; false if it isn't. */
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

/** The run in progress, if it is `id`: { meta, log } (its output so far). */
export const activeRun = (id) =>
  active?.meta.id === id ? { meta: active.meta, log: active.log } : null;
