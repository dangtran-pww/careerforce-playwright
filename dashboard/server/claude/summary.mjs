// A quick summary of a run's failures: asks Claude Code (`claude -p`,
// no tools, so it answers from the prompt alone in seconds) to read the
// errors of every failed and flaky test and group them into the issues that
// repeat across tests, each with the tests it hits and what to do.
//
// For a plan run, or a suite run's plan steps together (its prompt steps
// have their own findings). A run's results never change, so the answer is saved as
// reports/dashboard-runs/<id>/summary.json and shown again on coming back to
// the run. `refresh` asks again.

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ApiError } from '../errors.mjs';
import { singleFlight } from '../lib/single-flight.mjs';
import { RUNS_DIR as runsDir } from '../paths.mjs';
import { readMeta } from '../runs/history.mjs';
import { eachTest, stripAnsi } from '../runs/playwright.mjs';
import {
  CAUSES,
  caseOf,
  failedStepPath,
  savedFailureExplanations,
} from './failure.mjs';
import { answerOf, claudeError, runClaude, usageOf } from './run.mjs';

const SCHEMA = {
  type: 'object',
  required: ['headline', 'overview', 'issues'],
  properties: {
    headline: {
      type: 'string',
      description: 'One sentence: the state of the run, in plain words.',
    },
    overview: {
      type: 'string',
      description:
        'Two or three sentences: what failed, what the failures have in common, and how worried to be.',
    },
    issues: {
      type: 'array',
      description:
        'One per distinct problem. Tests that fail for the same reason share one issue. Most tests first.',
      items: {
        type: 'object',
        required: ['title', 'cause', 'tests', 'detail'],
        properties: {
          title: {
            type: 'string',
            description: 'A short name for the problem.',
          },
          cause: {
            type: 'string',
            enum: CAUSES,
            description:
              'site: the site does not behave as the tests expect. test: the tests are wrong. environment: the site was down, slow, logged out or missing data. flaky: timing; a rerun would likely pass. unclear: the errors do not say.',
          },
          tests: {
            type: 'array',
            items: { type: 'string' },
            description:
              'The tests it hits, by the label given for each failure (e.g. "#3").',
          },
          detail: {
            type: 'string',
            description:
              'What goes wrong, what the tests found instead of what they expected, and why you think so.',
          },
          nextStep: {
            type: 'string',
            description: 'What to do about it.',
          },
        },
      },
    },
    nextSteps: {
      type: 'array',
      items: { type: 'string' },
      description: 'What to do first, across the issues. At most three.',
    },
  },
};

const fileOf = (runId) => join(runsDir, runId, 'summary.json');

/** The saved summary of the run, or null. */
export async function savedRunSummary(runId) {
  if (!(await readMeta(runId))) throw new ApiError(404, 'No such run.');
  return readFile(fileOf(runId), 'utf8')
    .then(JSON.parse)
    .catch(() => null);
}

// One request per run at a time: a second click joins the first. A refresh
// doesn't join a request that may return the saved answer.
const flights = singleFlight();

/** Summarize the run's failures (or reuse the saved summary), and save it. */
export function summarizeRun(runId, { refresh = false } = {}) {
  return flights.run(`${runId}${refresh ? '#refresh' : ''}`, () =>
    generate(runId, refresh),
  );
}

async function generate(runId, refresh) {
  if (!refresh) {
    const saved = await savedRunSummary(runId);
    if (saved) return saved;
  }
  const run = await readMeta(runId);
  if (!run) throw new ApiError(404, 'No such run.');
  if (run.status === 'running')
    throw new ApiError(409, 'The run is still going.');

  const all = await testsOf(run);
  if (!all) throw new ApiError(409, 'This run has no test results to look at.');
  const failed = all.filter((t) =>
    ['unexpected', 'flaky'].includes(t.test.status),
  );

  let answer;
  let usage = {};
  if (!failed.length) {
    // Nothing to ask Claude about.
    answer = {
      headline: `All ${all.length} tests passed.`,
      overview: 'No test failed or needed a retry.',
      issues: [],
      nextSteps: [],
    };
  } else {
    const explained = await savedFailureExplanations(runId).catch(() => []);
    const failures = await Promise.all(
      failed.map((f, i) => failureOf(f, i, explained)),
    );
    const result = await runClaude(prompt(run, all, failures), SCHEMA, {
      tools: [],
      maxTurns: 3,
    });
    answer = answerOf(result);
    if (!answer?.headline || !Array.isArray(answer.issues))
      throw claudeError(
        result,
        'Claude answered without a summary. Try again.',
      );
    // Labels ("#3") back to test titles, for the page.
    const titleOf = (label) =>
      failures.find((f) => f.label === label.trim())?.name ?? label;
    answer.issues = answer.issues.map((issue) => ({
      title: issue.title,
      cause: CAUSES.includes(issue.cause) ? issue.cause : 'unclear',
      tests: (issue.tests ?? []).map(titleOf),
      detail: issue.detail ?? '',
      nextStep: issue.nextStep ?? '',
    }));
    usage = { ...usageOf(result), costUsd: result.total_cost_usd ?? null };
  }

  const saved = {
    run: runId,
    headline: answer.headline,
    overview: answer.overview ?? '',
    issues: answer.issues,
    nextSteps: answer.nextSteps ?? [],
    createdAt: new Date().toISOString(),
    costUsd: null,
    ...usage,
  };
  await writeFile(fileOf(runId), JSON.stringify(saved, null, 2));
  return saved;
}

// Every test of the run, with the plan it belongs to: a plan run's, or for
// a suite run those of each plan step (`step` is its number; prompt steps
// have no tests). Null when there are no test results at all.
async function testsOf(run) {
  const dir = join(runsDir, run.id);
  const sources =
    run.kind === 'suite'
      ? (run.steps ?? [])
          .filter((s) => s.kind === 'plan' && s.dir)
          .map((s) => ({
            step: s.n,
            stepTitle: s.title,
            plan: s.plan,
            dir: join(dir, s.dir),
          }))
      : [{ step: null, stepTitle: null, plan: run.plan, dir }];
  let found = false;
  const all = [];
  for (const source of sources) {
    const report = await readFile(join(source.dir, 'results.json'), 'utf8')
      .then(JSON.parse)
      .catch(() => null);
    if (!report) continue;
    found = true;
    eachTest(report, (spec, test, title) =>
      all.push({ ...source, spec, test, title }),
    );
  }
  return found ? all : null;
}

// ---- the prompt ------------------------------------------------------------

const MAX_ERROR = 600;

// What the prompt says about one failed or flaky test.
async function failureOf(
  { step, stepTitle, plan, spec, test, title },
  i,
  explained,
) {
  const attempt =
    test.results.findLast((r) => r.status !== 'passed') ??
    test.results.at(-1) ??
    {};
  const error = stripAnsi(
    (attempt.errors ?? [attempt.error])
      .filter(Boolean)
      .map((e) => e.message)
      .join('\n'),
  )
    .trim()
    .slice(0, MAX_ERROR);
  const testCase = await caseOf(plan, spec.file, spec.line);
  const explanation = explained.find(
    (e) =>
      (e.step ?? null) === step &&
      e.project === test.projectName &&
      e.file === spec.file &&
      e.line === spec.line &&
      e.title === title,
  );
  const stepPath = failedStepPath(attempt.steps);
  const name = `${title} (${test.projectName})`;
  const label = `#${i + 1}`;
  const text = [
    `${label} ${name}${test.status === 'flaky' ? ' — flaky: failed, then passed on a retry' : ''}`,
    step != null && `  Suite step ${step}: ${stepTitle}`,
    `  tests/${spec.file}:${spec.line}`,
    testCase && `  Plan case ${testCase.id} "${testCase.title}"`,
    stepPath.length && `  Failed in step: ${stepPath.join(' › ')}`,
    `  Error: ${error.replace(/\n/g, '\n    ') || '(no error message)'}`,
    explanation &&
      `  Already looked into: ${explanation.cause} — ${explanation.headline}`,
  ]
    .filter(Boolean)
    .join('\n');
  // In a suite, the page names the step too.
  return {
    label,
    name: step != null ? `${name} — step ${step}` : name,
    text,
  };
}

function prompt(run, all, failures) {
  const count = (s) => all.filter((t) => t.test.status === s).length;
  const site = run.env?.baseURL ?? run.site ?? 'unknown';
  const what =
    run.kind === 'suite'
      ? `The test suite "${run.planName}" (its plan steps: ${run.steps
          .filter((s) => s.kind === 'plan')
          .map((s) => `${s.n}. ${s.title}`)
          .join(', ')})`
      : `The run of the test plan "${run.planName}"`;
  return `You are summarizing a Playwright test run for a QA tester who does not read code.

${what} ran against ${site} on ${run.startedAt}.
${all.length} tests: ${count('expected')} passed, ${count('unexpected')} failed, ${count('flaky')} flaky, ${count('skipped')} skipped.

The failed and flaky tests, each with its label, file, plan case, the step that failed and the start of its error:

${failures.map((f) => f.text).join('\n\n')}

Group the failures into the problems behind them: tests that fail for the same reason (the same error, the same missing element or text, the same page, a login or environment problem) share one issue. List the issues with the most tests first, and name each issue's tests by their labels. For each, say what most likely went wrong: the site does not do what the tests expect, the tests are wrong, the environment got in the way, or timing; only as firmly as the errors allow, and "unclear" when they do not say. Name the real pages, buttons, texts and values. Do not quote code or name functions. Keep it short.

Answer only with the JSON the schema asks for.`;
}
