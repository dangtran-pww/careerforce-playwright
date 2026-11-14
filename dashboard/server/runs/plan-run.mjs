// A plan run: one test plan, or some of its projects and cases, on one
// environment. See lifecycle.mjs for the run folder and the one-run lock.

import { hostOf } from '../../../scripts/lib/site.mjs';
import { publicEnv } from '../environments.mjs';
import { ApiError } from '../errors.mjs';
import {
  journeyEnv,
  journeyFromReport,
  journeyStatus,
  mergeJourneys,
} from './a11y-journey.mjs';
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
  promptScheduler,
  promptsStatus,
  runPlanWork,
} from './prompt-step.mjs';

/**
 * Start a run of `plan` on `env`, with the chosen projects (default: the
 * plan's selected ones) and cases (default: all). Every login those cases
 * need is checked first with `checkLogin(role, env)` (see requireLogins). Playwright runs the cases
 * with tests; the prompt cases run after them (prompt-step.mjs: the Parallel
 * ones a few at a time, and alongside the tests when the plan is Parallel
 * too; the others one by one),
 * comparing with `compare` when they compare (default: each environment's
 * own comparison site). With `a11y`, every page and dialog the tests and
 * prompt cases reach is scanned for accessibility (runs/a11y-journey.mjs);
 * a broken rule fails the run. Resolves with its run.json once it has
 * started; the run goes on in the background.
 */
export async function startRun(
  plan,
  {
    env,
    projects,
    cases = [],
    headed = false,
    compare,
    suite,
    checkLogin,
    a11y = false,
  } = {},
) {
  checkPlanRunnable(plan);
  checkPromptCases(plan, env, cases);
  const chosen = planArgs(plan, { env, projects, cases, headed });
  const prompts = promptCaseEntries(plan, env, cases);
  if (!chosen && !prompts.length)
    throw new ApiError(400, `Nothing of ${plan.name} to run on ${env.name}.`);
  await requireLogins(neededRoles(plan, env, chosen, prompts), env, checkLogin);

  const now = new Date();
  const meta = {
    id: newRunId(now, env.id, plan.slug),
    kind: 'plan',
    plan: plan.slug,
    suite: suite ?? null,
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
    a11yScan: a11y,
    a11y: null,
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
    const runTests =
      chosen &&
      (async () => {
        const result = await runPlaywright({
          dir,
          env,
          args: chosen.args,
          progress: meta,
          extraEnv: a11y ? journeyEnv(dir) : {},
        });
        meta.exitCode = result.code;
        Object.assign(meta, result.summary ?? {});
        if (a11y) meta.a11y = await journeyFromReport(dir);
        return playwrightStatus(result);
      });
    const { testStatus, done } = await runPlanWork(
      prompts,
      plan,
      {
        env,
        compareChoice: compare,
        dir,
        meta,
        scheduler: promptScheduler(),
        a11y: a11y ? { seenDir: journeyEnv(dir).A11Y_JOURNEY_SEEN_DIR } : null,
      },
      runTests,
    );
    await done;
    // The tests' scans and the prompt cases' (their own result keeps theirs).
    meta.a11y = mergeJourneys([meta.a11y, ...prompts.map((p) => p.a11y)]);
    meta.status = combinedStatus(
      testStatus,
      promptsStatus(prompts),
      journeyStatus(meta.a11y),
    );
    await endRun(meta);
  });
  return meta;
}

// The roles the run logs in as: those of the test cases it runs, and the
// prompt cases' Role. A run of every test case (the whole plan, or the plan
// panel's "Run test cases") also counts every role its spec files use, as a
// suite run does, in case a test isn't matched to a case.
function neededRoles(plan, env, chosen, prompts) {
  const roles = new Set(prompts.map((p) => p.role).filter(Boolean));
  if (chosen) {
    const testCases = plan.cases
      .filter((c) => c.kind !== 'prompt')
      .filter((c) => !(env.production && c.noProd));
    const ids = new Set(
      chosen.cases.length ? chosen.cases : testCases.map((c) => c.id),
    );
    for (const c of plan.cases)
      if (ids.has(c.id)) for (const r of c.roles ?? []) roles.add(r);
    const everyTest = testCases
      .filter((c) => c.testCount > 0)
      .every((c) => ids.has(c.id));
    if (everyTest) for (const r of plan.roles ?? []) roles.add(r);
  }
  return roles;
}

/**
 * Every login a run needs must work on this environment right now:
 * `checkLogin(role, env)` asks the site (GET /api/sessions/:role does the
 * same). A missing, expired or non-admin session stops the run before
 * anything starts: a 409 with { logins } listing what's wrong with each one.
 */
export async function requireLogins(roles, env, checkLogin) {
  const logins = await Promise.all(
    [...roles].map((role) => checkLogin(role, env)),
  );
  const notReady = logins.filter((s) => s.status !== 'valid');
  if (notReady.length)
    throw new ApiError(
      409,
      notReady.length === 1
        ? `The ${notReady[0].role} login isn't ready on ${env.name}, so the run didn't start.`
        : `${notReady.length} logins aren't ready on ${env.name}, so the run didn't start.`,
      { logins: notReady },
    );
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

/**
 * One run status from Playwright's (null if it didn't run), the prompts' and
 * the accessibility scans' (null when off).
 */
export function combinedStatus(tests, prompts, a11y = null) {
  if (isStopped()) return 'stopped';
  const all = [tests, prompts, a11y].filter(Boolean);
  if (!all.length) return 'error';
  for (const s of ['error', 'failed', 'attention'])
    if (all.includes(s)) return s;
  return 'passed';
}
