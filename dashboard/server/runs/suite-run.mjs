// Runs a suite (test-suites/<suite>/suite.md) for the dashboard: its plans, one step
// after another, on the environment picked in the dashboard. A step's prompt
// cases marked Parallel go on in the background while the next steps run,
// as long as those steps' plans are marked Parallel too
// (test-suites/README.md, Rule 3; see prompt-step.mjs). Uses the run lifecycle in lifecycle.mjs,
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
import { combinedStatus, requireLogins } from './plan-run.mjs';
import {
  checkPlanRunnable,
  planArgs,
  playwrightStatus,
  runPlaywright,
  shownCommand,
} from './playwright.mjs';
import {
  journeyEnv,
  journeyFromReport,
  journeyStatus,
  mergeJourneys,
} from './a11y-journey.mjs';
import {
  promptCaseEntries,
  promptScheduler,
  promptsStatus,
  runPlanWork,
} from './prompt-step.mjs';

// ---- starting --------------------------------------------------------------

/**
 * Start a suite run. `choice` says which plans to run:
 * { env, plans: [slug], headed, compare, checkLogin, a11y }. With `a11y`,
 * every page each step reaches is scanned for accessibility, each page
 * state once in the whole run (runs/a11y-journey.mjs).
 * Leaving `plans` out runs all of them. `checkLogin(role, env)`
 * resolves to a session check ({ role, status, message, loginCommand }).
 */
export async function startSuiteRun(suite, choice) {
  const { env, headed = false, compare, checkLogin, a11y = false } = choice;
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

  // Every login the run needs must work on this environment right now; a
  // missing, expired or non-admin session stops the run before anything
  // starts (requireLogins).
  const needed = new Set();
  for (const { plan } of planSteps) {
    for (const role of plan?.roles ?? []) needed.add(role);
    for (const c of plan ? promptCaseEntries(plan, env) : [])
      if (c.role) needed.add(c.role);
  }
  await requireLogins(needed, env, checkLogin);

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
        ? `Not in test-suites/${suite.slug}/.`
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
    a11yScan: a11y,
    a11y: null,
    // Kept for the runs table, which lists projects and cases.
    projects: [],
    cases: [],
    steps,
    status: 'running',
    startedAt: now.toISOString(),
    finishedAt: null,
  };
  const dir = await beginRun(meta);

  const scan = a11y ? journeyEnv(dir) : null;
  launch(meta, () => run(meta, dir, { planSteps, env, headed, compare, scan }));
  return meta;
}

// ---- running ---------------------------------------------------------------

async function run(meta, dir, { planSteps, env, headed, compare, scan }) {
  const scheduler = promptScheduler();
  // Steps whose prompt cases are still going, finished when they end.
  const finishing = [];
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
    const { plan } = planSteps.find((p) => p.entry.slug === step.plan);
    // A plan that isn't Parallel may change what other checks see, so it
    // waits for the background prompts and runs on its own.
    if (!plan.parallel) await scheduler.idle();
    if (isStopped()) {
      step.status = 'skipped';
      step.skipReason = 'The run was stopped.';
      continue;
    }
    step.status = 'running';
    step.startedAt = new Date().toISOString();
    await save(meta);
    log(`\n=== ${step.n}. ${step.title}\n`);
    const stepDir = join(dir, step.dir);
    let done;
    try {
      done = await planStep(step, stepDir, plan, {
        env,
        headed,
        compare,
        meta,
        scheduler,
        scan,
      });
    } catch (err) {
      done = failed(step, err);
    }
    finishing.push(
      done.catch((err) => failed(step, err)).then(() => finish(step, meta)),
    );
  }
  await Promise.all(finishing);
  meta.a11y = mergeJourneys(meta.steps.map((s) => s.a11y));
  meta.status = suiteStatus(meta);
  await endRun(meta);
}

function failed(step, err) {
  step.status = 'error';
  step.error = err.message;
  log(`\n[dashboard] ${step.title}: ${err.stack}\n`);
  return Promise.resolve();
}

async function finish(step, meta) {
  if (isStopped() && step.status !== 'passed') step.status = 'stopped';
  step.finishedAt = new Date().toISOString();
  await save(meta);
}

function suiteStatus(meta) {
  if (isStopped()) return 'stopped';
  const s = meta.steps.map((x) => x.status);
  const bad = s.some((x) => ['failed', 'error'].includes(x));
  if (bad) return 'failed';
  if (s.includes('unsure')) return 'attention';
  return s.every((x) => x === 'skipped') ? 'error' : 'passed';
}

// A plan: Playwright for its tests (if it has any) and its prompt cases
// (runPlanWork: Parallel ones alongside the tests in a Parallel plan).
// Resolves once its prompt cases have started, with a promise for when the
// step is done and has its status.
async function planStep(
  step,
  stepDir,
  plan,
  { env, headed, compare, meta, scheduler, scan },
) {
  const chosen = planArgs(plan, { env, projects: step.projects, headed });
  if (chosen)
    step.command = shownCommand(env, ['playwright', 'test', ...chosen.args]);
  const runTests =
    chosen &&
    (async () => {
      const result = await runPlaywright({
        dir: stepDir,
        env,
        args: chosen.args,
        progress: step,
        extraEnv: scan ?? {},
      });
      Object.assign(step, result.summary ?? {});
      step.exitCode = result.code;
      if (scan) step.a11y = await journeyFromReport(stepDir, step.n);
      return playwrightStatus(result);
    });
  const { testStatus, done } = await runPlanWork(
    step.prompts,
    plan,
    {
      env,
      compareChoice: compare,
      dir: stepDir,
      meta,
      scheduler,
      a11y: scan ? { seenDir: scan.A11Y_JOURNEY_SEEN_DIR } : null,
    },
    runTests,
  );
  return done.then(() => {
    // The tests' scans and the prompt cases' (with the step's number).
    step.a11y = mergeJourneys([
      step.a11y,
      ...step.prompts.map((p) =>
        p.a11y
          ? {
              ...p.a11y,
              pages: p.a11y.pages.map((pg) => ({
                ...pg,
                visits: pg.visits.map((v) => ({ ...v, step: step.n })),
              })),
            }
          : null,
      ),
    ]);
    const status = combinedStatus(
      testStatus,
      promptsStatus(step.prompts),
      journeyStatus(step.a11y),
    );
    // A step that needs a look is "unsure", like a prompt case.
    step.status = status === 'attention' ? 'unsure' : status;
  });
}
