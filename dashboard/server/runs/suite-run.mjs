// Runs a suite (test-suites/*.md) for the dashboard: its plans, one step
// after another, on the environment picked in the dashboard. Uses the run lifecycle in lifecycle.mjs,
// so a suite takes the same one-run-at-a-time lock and can be stopped the
// same way (Stop ends the current step and skips the rest).
//
// reports/dashboard-runs/<id>/
//   run.json                 kind "suite", env and the steps
//   output.log               every step's output
//   steps/<n>-<step>/        one folder per step:
//     results.json, report/, test-results/, and prompts/<case>/ for the
//     plan's prompt cases (see prompt.mjs)
//
// Runs from before suites dropped their own prompt steps can still have
// steps of kind "prompt"; the run page shows them.

import { join } from 'node:path';
import { hostOf } from '../../../scripts/lib/site.mjs';
import { allNoProd, loadPlan } from '../catalog/plans.mjs';
import { publicEnv } from '../environments.mjs';
import { ApiError } from '../errors.mjs';
import {
  beginRun,
  endRun,
  isStopped,
  launch,
  log,
  newRunId,
  save,
} from './lifecycle.mjs';
import { combinedStatus } from './plan-run.mjs';
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

// ---- starting --------------------------------------------------------------

/**
 * Start a suite run. `choice` says which plans to run:
 * { env, plans: [slug], headed, compare, checkLogin }.
 * Leaving `plans` out runs all of them. `checkLogin(role, env)`
 * resolves to a session check ({ role, status, message, loginCommand }).
 */
export async function startSuiteRun(suite, choice) {
  const { env, headed = false, compare, checkLogin } = choice;
  const plans = choice.plans
    ? suite.plans.filter((p) => choice.plans.includes(p.slug))
    : suite.plans;

  if (!plans.length) throw new ApiError(400, 'Pick at least one plan to run.');

  // The plans that will actually run (a plan with no tests yet is skipped).
  // On production a no-prod plan, or one whose cases are all no-prod, is
  // skipped too; the others run without their no-prod cases.
  const planSteps = [];
  for (const entry of plans) {
    if (!entry.found || !entry.runnable) {
      planSteps.push({ entry, plan: null });
      continue;
    }
    const plan = await loadPlan(entry.slug);
    checkPlanRunnable(plan);
    if (env.production && allNoProd(plan)) {
      planSteps.push({
        entry,
        plan: null,
        offProd: plan.noProd
          ? 'The plan is no-prod.'
          : 'Every case is no-prod.',
      });
      continue;
    }
    // Check the projects now, so a bad suite file fails before anything runs.
    planArgs(plan, { env, projects: entry.projects, headed });
    planSteps.push({ entry, plan });
  }

  // Every login the run needs must work on this environment right now:
  // `checkLogin(role, env)` asks the site (GET /api/sessions/:role does the
  // same). A missing, expired or non-admin session stops the run before
  // anything starts, with what to do for each one.
  const needed = new Set();
  for (const { plan } of planSteps) {
    for (const role of plan?.roles ?? []) needed.add(role);
    for (const c of plan ? promptCaseEntries(plan, env) : [])
      if (c.role) needed.add(c.role);
  }
  const logins = await Promise.all(
    [...needed].map((role) => checkLogin(role, env)),
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

  // ---- the run's steps ----
  const steps = [];
  const add = (step) =>
    steps.push({
      n: steps.length + 1,
      status: 'pending',
      startedAt: null,
      finishedAt: null,
      ...step,
    });

  for (const { entry, plan, offProd } of planSteps) {
    add({
      id: entry.slug,
      kind: 'plan',
      title: plan ? `${plan.type} - ${plan.name}` : (entry.name ?? entry.slug),
      plan: entry.slug,
      projects: plan
        ? (planArgs(plan, { env, projects: entry.projects })?.projects ?? [])
        : [],
      // The plan's prompt cases, run after its tests.
      prompts: plan ? promptCaseEntries(plan, env) : [],
      skipReason: !entry.found
        ? 'Not in test-plans/.'
        : plan
          ? null
          : (offProd ?? 'No tests yet.'),
    });
  }
  for (const step of steps) step.dir = `steps/${step.n}-${step.id}`;

  const now = new Date();
  const meta = {
    id: newRunId(now, env.id, 'suite', suite.slug),
    kind: 'suite',
    suite: suite.slug,
    planName: `Suite - ${suite.name}`,
    env: publicEnv(env),
    site: hostOf(env),
    headed,
    compare: compare ?? null,
    // Kept for the runs table, which lists projects and cases.
    projects: [],
    cases: [],
    steps,
    status: 'running',
    startedAt: now.toISOString(),
    finishedAt: null,
  };
  const dir = await beginRun(meta);

  launch(meta, () =>
    run(meta, dir, { planSteps, env, headed, compare }),
  );
  return meta;
}

// ---- running ---------------------------------------------------------------

async function run(meta, dir, { planSteps, env, headed, compare }) {
  for (const step of meta.steps) {
    if (isStopped()) {
      step.status = 'skipped';
      step.skipReason = 'The run was stopped.';
      continue;
    }
    if (step.skipReason) {
      step.status = 'skipped';
      log(`\n=== ${step.n}. ${step.title}: skipped (${step.skipReason})\n`);
      await save(meta);
      continue;
    }
    step.status = 'running';
    step.startedAt = new Date().toISOString();
    await save(meta);
    log(`\n=== ${step.n}. ${step.title}\n`);
    const stepDir = join(dir, step.dir);
    try {
      const { plan } = planSteps.find((p) => p.entry.slug === step.plan);
      await planStep(step, stepDir, plan, { env, headed, compare, meta });
    } catch (err) {
      step.status = 'error';
      step.error = err.message;
      log(`\n[dashboard] ${step.title}: ${err.stack}\n`);
    }
    if (isStopped() && step.status !== 'passed') step.status = 'stopped';
    step.finishedAt = new Date().toISOString();
    await save(meta);
  }
  meta.status = suiteStatus(meta);
  await endRun(meta);
}

function suiteStatus(meta) {
  if (isStopped()) return 'stopped';
  const s = meta.steps.map((x) => x.status);
  const bad = s.some((x) => ['failed', 'error'].includes(x));
  if (bad) return 'failed';
  if (s.includes('unsure')) return 'attention';
  return s.every((x) => x === 'skipped') ? 'error' : 'passed';
}

// A plan: Playwright for its tests (if it has any), then its prompt cases.
async function planStep(step, stepDir, plan, { env, headed, compare, meta }) {
  const chosen = planArgs(plan, { env, projects: step.projects, headed });
  let testStatus = null;
  if (chosen) {
    step.command = shownCommand(env, ['playwright', 'test', ...chosen.args]);
    const result = await runPlaywright({
      dir: stepDir,
      env,
      args: chosen.args,
      progress: step,
    });
    Object.assign(step, result.summary ?? {});
    step.exitCode = result.code;
    testStatus = playwrightStatus(result);
  }
  await runPromptCases(step.prompts, plan, {
    env,
    compareChoice: compare,
    dir: stepDir,
    meta,
  });
  const status = combinedStatus(testStatus, promptsStatus(step.prompts));
  // A step that needs a look is "unsure", like a prompt case.
  step.status = status === 'attention' ? 'unsure' : status;
}
