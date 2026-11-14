// Prompt checks as part of a dashboard run: a plan's prompt cases (plan runs
// and suite plan steps). The check itself is
// run by prompt.mjs; this file gives it the run's process, log and Stop,
// finds a baseline among earlier runs, and decides when each one runs.
//
// When (test-suites/README.md, Rule 3): a prompt marked Parallel starts in
// the background, a few at a time, and the run goes on with its next plan
// while it runs. In a plan marked Parallel it starts with the plan's own
// Playwright tests (runPlanWork); otherwise after them. Anything not marked
// Parallel (a prompt, or a plan's Playwright tests) first waits for the
// background prompts, then runs on its own.

import { resolveCompare } from '../../../scripts/lib/prompts.mjs';
import { killGroup } from '../lib/processes.mjs';
import { PROMPT_RUNS_DIR, RUNS_DIR } from '../paths.mjs';
import { isStopped, log, save, spawnStep } from './lifecycle.mjs';
import { findBaseline, runPromptCheck } from './prompt.mjs';

// How many parallel prompts may run at once. Each one is a `claude` process
// and a browser, and costs Claude usage.
const PROMPT_CONCURRENCY = Math.max(
  1,
  Number.parseInt(process.env.PROMPT_CONCURRENCY ?? '', 10) || 3,
);

/**
 * A log function that puts `[<label>] ` in front of each line, so checks
 * running at the same time can be told apart in output.log. No label, no
 * prefix.
 */
function labelled(label) {
  if (!label) return log;
  let atLineStart = true;
  return (text) => {
    if (!text) return;
    let out = '';
    for (const part of text.split(/(?<=\n)/)) {
      out += atLineStart ? `[${label}] ${part}` : part;
      atLineStart = part.endsWith('\n');
    }
    log(out);
  };
}

/**
 * prompt.mjs's `io` for one check: its own log label, and a kill (its
 * timeout) that ends only this check's process.
 */
function checkIo(label) {
  const logTo = labelled(label);
  let child = null;
  return {
    spawn: (command, args, opts) =>
      spawnStep(command, args, {
        ...opts,
        logTo,
        onChild: (c) => (child = c),
      }),
    log: logTo,
    isStopped,
    kill: () => child && killGroup(child),
  };
}

/**
 * When a run's work may start. One per run.
 *   background(work)  start `work` (parallel-safe) once fewer than
 *                     PROMPT_CONCURRENCY are going; resolves when it has
 *                     started, with a promise for its end
 *   idle()            resolves once no background work is going
 */
export function promptScheduler(limit = PROMPT_CONCURRENCY) {
  const going = new Set();
  return {
    async background(work) {
      while (going.size >= limit) await Promise.race(going);
      const done = work().finally(() => going.delete(done));
      going.add(done);
      return { done };
    },
    async idle() {
      while (going.size) await Promise.allSettled([...going]);
    },
  };
}

// Where earlier results of a prompt are: dashboard runs, and the checks run
// by scripts/run-prompt.mjs.
export const BASELINE_SOURCES = [
  { dir: RUNS_DIR, file: 'run.json' },
  { dir: PROMPT_RUNS_DIR, file: 'result.json' },
];

/**
 * Run `check` (a parsed prompt file) on `env` in `dir`, and put its result
 * on `target` (a case's entry in run.json). `compareChoice`
 * is the run's "Compare with" choice, if any. `a11y` ({ seenDir }) scans
 * the pages it reaches for accessibility (runs/a11y-journey.mjs). `meta` is saved as it goes,
 * so the page shows the check running.
 */
export async function runCheckInRun(
  target,
  check,
  { env, compareChoice, dir, meta, a11y = null, io = checkIo() },
) {
  let compare;
  try {
    compare = resolveCompare(check, env, compareChoice);
  } catch (err) {
    Object.assign(target, { status: 'error', error: err.message });
    return;
  }
  target.status = 'running';
  target.startedAt = new Date().toISOString();
  await save(meta);
  const baseline =
    compare.mode === 'baseline'
      ? await findBaseline(check.slug, env.id, BASELINE_SOURCES)
      : null;
  if (compare.mode === 'site')
    io.log(
      `  Comparing ${env.name} with ${compare.envs.map((o) => `${o.name} (${o.baseURL})`).join(', ')}.\n`,
    );
  else if (compare.mode === 'baseline')
    io.log(
      baseline
        ? `  Comparing with the baseline from ${baseline.from}.\n`
        : `  No earlier run on ${env.name} to compare with: review only.\n`,
    );
  try {
    Object.assign(
      target,
      await runPromptCheck({
        check,
        env,
        compare,
        baseline,
        dir,
        relTo: RUNS_DIR,
        io,
        a11y,
      }),
    );
  } catch (err) {
    Object.assign(target, { status: 'error', error: err.message });
    io.log(`\n[dashboard] ${target.title ?? check.slug}: ${err.stack}\n`);
  }
  target.finishedAt = new Date().toISOString();
  await save(meta);
}

/**
 * The run.json entries for a plan's prompt cases that run on `env`, out of
 * `caseIds` (all of them when empty). On production the no-prod ones are
 * left out.
 */
export function promptCaseEntries(plan, env, caseIds = []) {
  return plan.cases
    .filter((c) => c.kind === 'prompt' && c.prompt && !c.prompt.problems.length)
    .filter((c) => !caseIds.length || caseIds.includes(c.id))
    .filter((c) => !(env.production && c.noProd))
    .map((c) => ({
      id: c.id,
      title: `${c.id}: ${c.title}`,
      slug: c.prompt.slug,
      file: c.prompt.file,
      role: c.prompt.role,
      prompt: c.prompt.prompt,
      viewports: c.prompt.viewports,
      parallel: c.prompt.parallel,
      a11y: c.prompt.a11y,
      status: 'pending',
    }));
}

/**
 * Run each prompt case entry (from promptCaseEntries) of `plan`, in
 * `<dir>/prompts/<id>/`, as `scheduler` (promptScheduler) allows: a
 * Parallel one in the background, any other alone. Stops starting new ones
 * once the run is stopped. Resolves once every one has started, with
 * `done`, a promise for when they have all finished.
 */
export async function runPromptCases(
  entries,
  plan,
  { env, compareChoice, dir, meta, scheduler, a11y = null },
) {
  const started = [];
  for (const entry of entries) {
    if (isStopped()) {
      entry.status = 'skipped';
      entry.skipReason = 'The run was stopped.';
      continue;
    }
    const testCase = plan.cases.find((c) => c.id === entry.id);
    const check = (io) =>
      runCheckInRun(entry, testCase.prompt, {
        env,
        compareChoice,
        dir: `${dir}/prompts/${entry.id}`,
        meta,
        a11y,
        io,
      });
    if (entry.parallel) {
      const { done } = await scheduler.background(async () => {
        if (isStopped()) {
          entry.status = 'skipped';
          entry.skipReason = 'The run was stopped.';
          return;
        }
        log(`\n=== ${entry.title} (prompt, in parallel as [${entry.id}])\n`);
        await check(checkIo(entry.id));
      });
      started.push(done);
    } else {
      await scheduler.idle();
      if (isStopped()) {
        entry.status = 'skipped';
        entry.skipReason = 'The run was stopped.';
        continue;
      }
      log(`\n=== ${entry.title} (prompt)\n`);
      await check(checkIo());
    }
  }
  return { done: Promise.allSettled(started) };
}

/**
 * A plan's part of a run: its Playwright tests (`runTests`, resolving with
 * their status; null when the plan has none) and its prompt case `entries`.
 * A Parallel plan's tests only read the site, so its Parallel prompt cases
 * start at the same time as the tests; every other prompt case runs after
 * the tests, as runPromptCases allows. Resolves once the tests have finished
 * and every prompt case has started, with the tests' status and `done`, a
 * promise for when the prompt cases have all finished.
 */
export async function runPlanWork(entries, plan, opts, runTests) {
  const alongside = plan.parallel ? entries.filter((e) => e.parallel) : [];
  const after = entries.filter((e) => !alongside.includes(e));
  // Not awaited: with more prompts than free slots, the tests still start.
  const alongsideStarted = runPromptCases(alongside, plan, opts);
  const testStatus = runTests ? await runTests() : null;
  const first = await alongsideStarted;
  const rest = await runPromptCases(after, plan, opts);
  return { testStatus, done: Promise.all([first.done, rest.done]) };
}

/** failed | attention | passed | null (no prompt cases), for prompt results. */
export function promptsStatus(entries) {
  if (!entries?.length) return null;
  const s = entries.map((e) => e.status);
  if (s.some((x) => ['failed', 'error'].includes(x))) return 'failed';
  if (s.some((x) => ['unsure', 'stopped'].includes(x))) return 'attention';
  return 'passed';
}
