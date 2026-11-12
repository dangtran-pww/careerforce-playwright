// A plan run: one test plan, or some of its projects and cases, on one
// environment. See lifecycle.mjs for the run folder and the one-run lock.

import { hostOf } from '../../../scripts/lib/site.mjs';
import { publicEnv } from '../environments.mjs';
import { ApiError } from '../errors.mjs';
import { beginRun, endRun, isStopped, launch, newRunId } from './lifecycle.mjs';
import {
  checkPlanRunnable,
  planArgs,
  playwrightStatus,
  runPlaywright,
  shownCommand,
} from './playwright.mjs';
import {
  promptCaseEntries,
  promptsStatus,
  runPromptCases,
} from './prompt-step.mjs';

/**
 * Start a run of `plan` on `env`, with the chosen projects (default: the
 * plan's selected ones) and cases (default: all). Playwright runs the cases
 * with tests; then the prompt cases run one by one (prompt-step.mjs),
 * comparing with `compare` when they compare (default: each environment's
 * own comparison site). Resolves with its run.json once it has started; the
 * run goes on in the background.
 */
export async function startRun(
  plan,
  { env, projects, cases = [], headed = false, compare } = {},
) {
  checkPlanRunnable(plan);
  checkPromptCases(plan, env, cases);
  const chosen = planArgs(plan, { env, projects, cases, headed });
  const prompts = promptCaseEntries(plan, env, cases);
  if (!chosen && !prompts.length)
    throw new ApiError(400, `Nothing of ${plan.name} to run on ${env.name}.`);

  const now = new Date();
  const meta = {
    id: newRunId(now, env.id, plan.slug),
    kind: 'plan',
    plan: plan.slug,
    planName: `${plan.type} - ${plan.name}`,
    projects: chosen?.projects ?? [],
    cases: [...(chosen?.cases ?? []), ...prompts.map((p) => p.id)].filter(
      (id) => cases.includes(id),
    ),
    headed,
    env: publicEnv(env),
    site: hostOf(env),
    command: chosen
      ? shownCommand(env, ['playwright', 'test', ...chosen.args])
      : null,
    compare: compare ?? null,
    status: 'running',
    startedAt: now.toISOString(),
    finishedAt: null,
    exitCode: null,
    stats: null,
    results: null,
    prompts,
  };
  const dir = await beginRun(meta);

  launch(meta, async () => {
    let testStatus = null;
    if (chosen) {
      const result = await runPlaywright({ dir, env, args: chosen.args });
      meta.exitCode = result.code;
      Object.assign(meta, result.summary ?? {});
      testStatus = playwrightStatus(result);
    }
    await runPromptCases(prompts, plan, {
      env,
      compareChoice: compare,
      dir,
      meta,
    });
    meta.status = combinedStatus(testStatus, promptsStatus(prompts));
    await endRun(meta);
  });
  return meta;
}

// Refuse picked prompt cases that can't run: a broken prompt file, or a
// no-prod case on production.
function checkPromptCases(plan, env, cases) {
  for (const id of cases) {
    const c = plan.cases.find((x) => x.id === id && x.kind === 'prompt');
    if (!c) continue;
    if (c.promptProblems?.length)
      throw new ApiError(400, `${id}: ${c.promptProblems.join(' ')}`);
    if (env.production && c.noProd)
      throw new ApiError(
        400,
        `${id} is marked no-prod, so it never runs on ${env.name} (${hostOf(env)}).`,
      );
  }
}

/** One run status from Playwright's (null if it didn't run) and the prompts'. */
export function combinedStatus(tests, prompts) {
  if (isStopped()) return 'stopped';
  const all = [tests, prompts].filter(Boolean);
  if (!all.length) return 'error';
  for (const s of ['error', 'failed', 'attention'])
    if (all.includes(s)) return s;
  return 'passed';
}
