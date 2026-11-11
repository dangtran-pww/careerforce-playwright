// A plan run: one test plan, or some of its projects and cases, on one
// environment. See lifecycle.mjs for the run folder and the one-run lock.

import { hostOf } from '../../../scripts/lib/site.mjs';
import { publicEnv } from '../environments.mjs';
import { beginRun, endRun, launch, newRunId } from './lifecycle.mjs';
import {
  checkPlanRunnable,
  planArgs,
  playwrightStatus,
  runPlaywright,
  shownCommand,
} from './playwright.mjs';

/**
 * Start a run of `plan` on `env`, with the chosen projects (default: the
 * plan's selected ones) and cases (default: all). Resolves with its run.json
 * once it has started; the run goes on in the background.
 */
export async function startRun(
  plan,
  { env, projects, cases = [], headed = false } = {},
) {
  checkPlanRunnable(plan, env);
  const chosen = planArgs(plan, { projects, cases, headed });

  const now = new Date();
  const meta = {
    id: newRunId(now, env.id, plan.slug),
    kind: 'plan',
    plan: plan.slug,
    planName: `${plan.type} - ${plan.name}`,
    projects: chosen.projects,
    cases: chosen.cases,
    headed,
    env: publicEnv(env),
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

  launch(meta, async () => {
    const result = await runPlaywright({ dir, env, args: chosen.args });
    meta.exitCode = result.code;
    Object.assign(meta, result.summary ?? {});
    meta.status = playwrightStatus(result);
    await endRun(meta);
  });
  return meta;
}
