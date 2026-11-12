// Prompt checks as part of a dashboard run: a plan's prompt cases (plan runs
// and suite plan steps). The check itself is
// run by prompt.mjs; this file gives it the run's process, log and Stop, and
// finds a baseline among earlier runs.

import { resolveCompare } from '../../../scripts/lib/prompts.mjs';
import { PROMPT_RUNS_DIR, RUNS_DIR } from '../paths.mjs';
import { isStopped, killChild, log, save, spawnStep } from './lifecycle.mjs';
import { findBaseline, runPromptCheck } from './prompt.mjs';

const io = { spawn: spawnStep, log, isStopped, kill: killChild };

// Where earlier results of a prompt are: dashboard runs, and the checks run
// by scripts/run-prompt.mjs.
export const BASELINE_SOURCES = [
  { dir: RUNS_DIR, file: 'run.json' },
  { dir: PROMPT_RUNS_DIR, file: 'result.json' },
];

/**
 * Run `check` (a parsed prompt file) on `env` in `dir`, and put its result
 * on `target` (a case's entry in run.json). `compareChoice`
 * is the run's "Compare with" choice, if any. `meta` is saved as it goes,
 * so the page shows the check running.
 */
export async function runCheckInRun(
  target,
  check,
  { env, compareChoice, dir, meta },
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
    log(
      `  Comparing ${env.name} with ${compare.env.name} (${compare.env.baseURL}).\n`,
    );
  else if (compare.mode === 'baseline')
    log(
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
      }),
    );
  } catch (err) {
    Object.assign(target, { status: 'error', error: err.message });
    log(`\n[dashboard] ${target.title ?? check.slug}: ${err.stack}\n`);
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
      status: 'pending',
    }));
}

/**
 * Run each prompt case entry (from promptCaseEntries) of `plan`, one after
 * another, in `<dir>/prompts/<id>/`. Stops starting new ones once the run
 * is stopped.
 */
export async function runPromptCases(
  entries,
  plan,
  { env, compareChoice, dir, meta },
) {
  for (const entry of entries) {
    if (isStopped()) {
      entry.status = 'skipped';
      entry.skipReason = 'The run was stopped.';
      continue;
    }
    log(`\n=== ${entry.title} (prompt)\n`);
    const testCase = plan.cases.find((c) => c.id === entry.id);
    await runCheckInRun(entry, testCase.prompt, {
      env,
      compareChoice,
      dir: `${dir}/prompts/${entry.id}`,
      meta,
    });
  }
}

/** failed | attention | passed | null (no prompt cases), for prompt results. */
export function promptsStatus(entries) {
  if (!entries?.length) return null;
  const s = entries.map((e) => e.status);
  if (s.some((x) => ['failed', 'error'].includes(x))) return 'failed';
  if (s.some((x) => ['unsure', 'stopped'].includes(x))) return 'attention';
  return 'passed';
}
