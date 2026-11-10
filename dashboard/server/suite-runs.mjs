// Runs a suite (test-suites/*.md) for the dashboard: its plans, then its
// prompts, one step after another, on the
// environment picked in the dashboard. Uses the run lifecycle in runs.mjs,
// so a suite takes the same one-run-at-a-time lock and can be stopped the
// same way (Stop ends the current step and skips the rest).
//
// reports/dashboard-runs/<id>/
//   run.json                 kind "suite", env and the steps
//   output.log               every step's output
//   steps/<n>-<step>/        one folder per step:
//     plan:    results.json, report/, test-results/
//     prompt:  mcp.json, stream.jsonl (Claude's own log), screenshots/

import { appendFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { loadPlan } from './plans.mjs';
import {
  RunError,
  beginRun,
  checkPlanRunnable,
  endRun,
  envInfo,
  isStopped,
  killChild,
  log,
  newRunId,
  planArgs,
  playwrightStatus,
  runPlaywright,
  runsDir,
  save,
  shownCommand,
  spawnStep,
} from './runs.mjs';
import { authFile, hostOf } from '../../scripts/lib/site.mjs';

// A prompt that takes longer than this is stopped and marked as an error.
const PROMPT_TIMEOUT_MS = Number(process.env.PROMPT_TIMEOUT_MS ?? 6 * 60_000);
const PROMPT_MAX_TURNS = process.env.PROMPT_MAX_TURNS ?? '40';
const CLAUDE = process.env.CLAUDE_BIN ?? 'claude';
// PROMPT_MODEL (e.g. sonnet, haiku) picks a cheaper model than your default.
const PROMPT_MODEL = process.env.PROMPT_MODEL;

const relRun = (path) => relative(resolve(runsDir), resolve(path));

// ---- starting --------------------------------------------------------------

/**
 * Start a suite run. `choice` says which steps to run:
 * { env, plans: [slug], prompts: [id], headed, checkLogin }.
 * Leaving `plans` / `prompts` out runs all of them. `checkLogin(role, env)`
 * resolves to a session check ({ role, status, message, loginCommand }).
 */
export async function startSuiteRun(suite, choice) {
  const { env, headed = false, checkLogin } = choice;
  const pick = (all, chosen, key) =>
    chosen ? all.filter((x) => chosen.includes(x[key])) : all;

  const plans = pick(suite.plans, choice.plans, 'slug');
  const prompts = pick(suite.prompts, choice.prompts, 'id');

  if (!plans.length && !prompts.length)
    throw new RunError(400, 'Pick at least one plan or prompt to run.');

  // The plans that will actually run (a plan with no tests yet is skipped).
  const planSteps = [];
  for (const entry of plans) {
    if (!entry.found || !entry.runnable) {
      planSteps.push({ entry, plan: null });
      continue;
    }
    const plan = await loadPlan(entry.slug);
    checkPlanRunnable(plan, env);
    // Check the projects now, so a bad suite file fails before anything runs.
    planArgs(plan, { projects: entry.projects, headed });
    planSteps.push({ entry, plan });
  }
  if (plans.some((p) => p.changesData) && env.production)
    throw new RunError(
      400,
      `This suite has plans that change data, and ${env.name} is production.`,
    );

  // Every login the run needs must work on this environment right now:
  // `checkLogin(role, env)` asks the site (GET /api/sessions/:role does the
  // same). A missing, expired or non-admin session stops the run before
  // anything starts, with what to do for each one.
  const needed = new Set();
  for (const { plan } of planSteps)
    for (const role of plan?.roles ?? []) needed.add(role);
  for (const p of prompts) if (p.role) needed.add(p.role);
  const logins = await Promise.all(
    [...needed].map((role) => checkLogin(role, env)),
  );
  const notReady = logins.filter((s) => s.status !== 'valid');
  if (notReady.length)
    throw new RunError(
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

  for (const { entry, plan } of planSteps) {
    add({
      id: entry.slug,
      kind: 'plan',
      title: plan ? `${plan.type} - ${plan.name}` : (entry.name ?? entry.slug),
      plan: entry.slug,
      projects: plan
        ? planArgs(plan, { projects: entry.projects }).projects
        : [],
      skipReason: !entry.found
        ? 'Not in test-plans/.'
        : plan
          ? null
          : 'No tests yet.',
    });
  }
  for (const p of prompts)
    add({
      id: p.id,
      kind: 'prompt',
      title: `${p.id}: ${p.name}`,
      file: p.file,
      prompt: p.prompt,
      role: p.role,
    });
  for (const step of steps) step.dir = `steps/${step.n}-${step.id}`;

  const now = new Date();
  const meta = {
    id: newRunId(now, env.id, 'suite', suite.slug),
    kind: 'suite',
    suite: suite.slug,
    planName: `Suite - ${suite.name}`,
    env: envInfo(env),
    site: hostOf(env),
    headed,
    // Kept for the runs table, which lists projects and cases.
    projects: [],
    cases: [],
    steps,
    status: 'running',
    startedAt: now.toISOString(),
    finishedAt: null,
  };
  const dir = await beginRun(meta);

  run(meta, dir, { planSteps, env, headed }).catch(async (err) => {
    log(`\n[dashboard] ${err.stack}\n`);
    meta.status = 'error';
    await endRun(meta);
  });
  return meta;
}

// ---- running ---------------------------------------------------------------

async function run(meta, dir, { planSteps, env, headed }) {
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
      if (step.kind === 'plan') {
        const { plan } = planSteps.find((p) => p.entry.slug === step.plan);
        await planStep(step, stepDir, plan, env, headed);
      } else {
        await promptStep(step, stepDir, env);
      }
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

async function planStep(step, stepDir, plan, env, headed) {
  const { args } = planArgs(plan, { projects: step.projects, headed });
  step.command = shownCommand(env, ['playwright', 'test', ...args]);
  const result = await runPlaywright({ dir: stepDir, env, args });
  Object.assign(step, result.summary ?? {});
  step.exitCode = result.code;
  step.status = playwrightStatus(result);
}

// ---- prompts (Claude in a browser) -----------------------------------------

const MCP = 'mcp__playwright-test__';
// Looking and clicking only: no file writes, no test generation, no
// arbitrary code.
const PROMPT_TOOLS = [
  'planner_setup_page',
  'browser_navigate',
  'browser_navigate_back',
  'browser_snapshot',
  'browser_take_screenshot',
  'browser_click',
  'browser_hover',
  'browser_type',
  'browser_press_key',
  'browser_select_option',
  'browser_wait_for',
  'browser_resize',
  'browser_tabs',
  'browser_console_messages',
  'browser_network_requests',
  'browser_evaluate',
].map((t) => MCP + t);

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['pass', 'fail', 'unsure'] },
    summary: {
      type: 'string',
      description: 'One or two sentences: what was checked and the outcome.',
    },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['problem', 'note'] },
          text: { type: 'string' },
          screenshot: {
            type: 'string',
            description: 'File name of the screenshot that shows it, if any.',
          },
        },
        required: ['severity', 'text'],
      },
    },
  },
  required: ['verdict', 'summary', 'findings'],
};

function wrapPrompt(step, env, shotsDir) {
  const who = step.role
    ? `logged in as ${step.role}`
    : 'as an anonymous visitor';
  return `You are doing one check of a smoke test of the CareerForce website at ${env.baseURL} (${env.name} environment), ${who}.

Setup: first call planner_setup_page with project "seed" and seedFile "tests/seed.spec.ts". That opens a browser on the site${step.role ? `, already logged in as ${step.role}` : ''}. Then use the browser tools. Paths such as /user/login are on ${env.baseURL}.

Rules:
- Read-only. Do not submit forms that create, change or delete anything, do not log out, and do not change any setting. Searching and opening pages is fine.
- Take a screenshot of what you check with browser_take_screenshot (scale "css"), saving it as "${shotsDir}/<two-digit number>-<short-name>.png". Take at least 1 and at most 6.
- Judge only what the check asks. Verdict "fail" when something it asks about is missing, broken or shows an error; "unsure" when you couldn't tell (the page didn't load, you were blocked). Name the screenshot that shows each finding.

The check:
${step.prompt}`;
}

// One line of Claude's stream, as a short line for the run's output.
function describe(event) {
  if (event.type !== 'assistant') return '';
  return (event.message?.content ?? [])
    .map((part) => {
      if (part.type === 'text' && part.text.trim())
        return `  ${part.text.trim().replace(/\n+/g, '\n  ')}\n`;
      if (part.type === 'tool_use') {
        const input = JSON.stringify(part.input ?? {});
        return `  → ${part.name.replace(MCP, '')} ${input.length > 140 ? `${input.slice(0, 137)}…` : input}\n`;
      }
      return '';
    })
    .join('');
}

async function promptStep(step, stepDir, env) {
  const shotsDir = join(stepDir, 'screenshots');
  await mkdir(shotsDir, { recursive: true });
  const mcpConfig = join(stepDir, 'mcp.json');
  const serverEnv = {
    BASE_URL: env.baseURL,
    SEED_STORAGE_STATE: step.role ? resolve(authFile(step.role, env)) : '',
  };
  await writeFile(
    mcpConfig,
    JSON.stringify(
      {
        mcpServers: {
          'playwright-test': {
            command: 'npx',
            args: ['playwright', 'run-test-mcp-server'],
            env: serverEnv,
          },
        },
      },
      null,
      2,
    ),
  );

  const streamFile = join(stepDir, 'stream.jsonl');
  let buffer = '';
  let result = null;
  const onStdout = (text) => {
    buffer += text;
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      appendFile(streamFile, `${line}\n`).catch(() => {});
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        log(`${line}\n`);
        continue;
      }
      if (event.type === 'result') result = event;
      else log(describe(event));
    }
  };

  const timer = setTimeout(() => {
    log(
      `\n[dashboard] The prompt took longer than ${PROMPT_TIMEOUT_MS / 60000} minutes. Stopping it.\n`,
    );
    step.timedOut = true;
    killChild();
  }, PROMPT_TIMEOUT_MS);
  const { code } = await spawnStep(
    CLAUDE,
    [
      '-p',
      wrapPrompt(step, env, resolve(shotsDir)),
      '--output-format',
      'stream-json',
      '--verbose',
      '--json-schema',
      JSON.stringify(VERDICT_SCHEMA),
      '--mcp-config',
      mcpConfig,
      '--strict-mcp-config',
      '--allowedTools',
      PROMPT_TOOLS.join(','),
      '--disallowedTools',
      'Bash,Edit,Write,NotebookEdit,WebFetch,WebSearch,Task',
      '--max-turns',
      PROMPT_MAX_TURNS,
      ...(PROMPT_MODEL ? ['--model', PROMPT_MODEL] : []),
    ],
    { env: serverEnv, onStdout },
  ).finally(() => clearTimeout(timer));
  if (buffer.trim()) onStdout('\n');

  step.exitCode = code;
  step.costUsd = result?.total_cost_usd ?? null;
  step.turns = result?.num_turns ?? null;
  let verdict = result?.structured_output ?? null;
  if (!verdict && typeof result?.result === 'string') {
    try {
      verdict = JSON.parse(result.result.match(/\{[\s\S]*\}/)?.[0] ?? '');
    } catch {
      // Not JSON: no verdict.
    }
  }
  step.screenshots = (await readdir(shotsDir).catch(() => []))
    .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
    .sort()
    .map((f) => relRun(join(shotsDir, f)));

  if (verdict?.verdict) {
    step.verdict = verdict.verdict;
    step.summary = verdict.summary;
    step.findings = verdict.findings ?? [];
    step.status =
      verdict.verdict === 'pass'
        ? 'passed'
        : verdict.verdict === 'fail'
          ? 'failed'
          : 'unsure';
  } else {
    step.status = isStopped() ? 'stopped' : 'error';
    step.error = step.timedOut
      ? 'Timed out before giving a verdict.'
      : result?.is_error || result?.subtype?.startsWith('error')
        ? `Claude stopped: ${result.subtype ?? 'error'}${result.result ? ` (${String(result.result).slice(0, 300)})` : ''}`
        : code === null
          ? `Couldn't start \`${CLAUDE}\`. Is Claude Code installed and logged in?`
          : `Claude finished without a verdict (exit code ${code}).`;
  }
}
