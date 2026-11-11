// Explains, in plain words, why a test failed in a run: asks Claude Code
// (`claude -p`, read-only tools) to look at what the run left behind (the
// full error, the step that failed, the screenshot, Playwright's snapshot of
// the page in error-context.md) and at the test code, and say what went
// wrong, whether it looks like the site, the test, the environment or
// timing, and what to do next.
//
// A run's results never change, so each answer is saved in the run's folder,
// reports/dashboard-runs/<id>/explanations/<hash>.json, and shown again on
// coming back to the run. `refresh` asks again.

import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { loadPlan } from './plans.mjs';
import { RunError, eachTest, readMeta, runsDir, stripAnsi } from './runs.mjs';
import { answerOf, claudeError, runClaude, usageOf } from './explain.mjs';

export const CAUSES = ['site', 'test', 'environment', 'flaky', 'unclear'];

const SCHEMA = {
  type: 'object',
  required: ['cause', 'confidence', 'headline', 'whatHappened', 'why'],
  properties: {
    cause: {
      type: 'string',
      enum: CAUSES,
      description:
        'site: the site does not behave as the test expects (a bug, or a change on the site the test was not updated for). test: the test itself is wrong (bad locator, wrong expected text, a mistake in the code). environment: the site was down, slow, behind an error page, logged out, or missing the data the test needs. flaky: a timing or race problem; a retry or rerun would likely pass. unclear: the evidence does not say.',
    },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    headline: {
      type: 'string',
      description: 'One sentence: what went wrong, in plain words.',
    },
    whatHappened: {
      type: 'string',
      description:
        'What the test was doing when it failed, and what it found instead of what it expected.',
    },
    why: {
      type: 'string',
      description: 'The most likely reason, and why you think so.',
    },
    evidence: {
      type: 'array',
      items: { type: 'string' },
      description:
        'What you saw that supports it: in the screenshot, the page snapshot, the error, the code.',
    },
    nextSteps: {
      type: 'array',
      items: { type: 'string' },
      description:
        'What to do: check something on the site by hand, report a bug, change the test (say where and what, in words), rerun.',
    },
  },
};

// The test a request names: { step?, project, file, line, title }. `step`
// is the suite step's number; plan runs have none.
export function testRef(body) {
  const ref = {
    step: body.step == null ? null : Number(body.step),
    project: String(body.project ?? ''),
    file: String(body.file ?? ''),
    line: Number(body.line),
    title: String(body.title ?? ''),
  };
  if (!ref.file || !ref.title || !Number.isFinite(ref.line))
    throw new RunError(400, 'Say which test: project, file, line and title.');
  return ref;
}

const keyOf = (runId, r) =>
  `${runId}|${r.step ?? ''}|${r.project}|${r.file}:${r.line}|${r.title}`;
const hash = (text) =>
  createHash('sha256').update(text).digest('hex').slice(0, 16);
const explanationsDir = (runId) => join(runsDir, runId, 'explanations');
const fileOf = (runId, ref) =>
  join(explanationsDir(runId), `${hash(keyOf(runId, ref))}.json`);

/** Every saved explanation of a failure in the run. */
export async function savedFailureExplanations(runId) {
  if (!(await readMeta(runId))) throw new RunError(404, 'No such run.');
  const dir = explanationsDir(runId);
  const names = await readdir(dir).catch(() => []);
  const all = await Promise.all(
    names
      .filter((n) => n.endsWith('.json'))
      .map((n) =>
        readFile(join(dir, n), 'utf8')
          .then(JSON.parse)
          .catch(() => null),
      ),
  );
  return all.filter(Boolean);
}

// One request per failure at a time: a second click joins the first. A
// refresh doesn't join a request that may return the saved answer.
const pending = new Map();

/** Ask Claude why the test failed (or reuse the saved answer), and save it. */
export function explainFailure(runId, ref, { refresh = false } = {}) {
  const key = `${keyOf(runId, ref)}${refresh ? '#refresh' : ''}`;
  if (!pending.has(key))
    pending.set(
      key,
      generate(runId, ref, refresh).finally(() => pending.delete(key)),
    );
  return pending.get(key);
}

async function generate(runId, ref, refresh) {
  const file = fileOf(runId, ref);
  if (!refresh) {
    const saved = await readFile(file, 'utf8')
      .then(JSON.parse)
      .catch(() => null);
    if (saved) return saved;
  }

  const run = await readMeta(runId);
  if (!run) throw new RunError(404, 'No such run.');
  let dir = join(runsDir, runId);
  let planSlug = run.plan;
  if (ref.step != null) {
    const step = run.steps?.find((s) => s.n === ref.step && s.kind === 'plan');
    if (!step) throw new RunError(404, `No plan step ${ref.step} in this run.`);
    dir = join(dir, step.dir);
    planSlug = step.plan;
  }
  const report = await readFile(join(dir, 'results.json'), 'utf8')
    .then(JSON.parse)
    .catch(() => null);
  if (!report)
    throw new RunError(409, 'This run has no test results to look at yet.');

  let found = null;
  eachTest(report, (spec, t, title) => {
    if (
      !found &&
      t.projectName === ref.project &&
      spec.file === ref.file &&
      spec.line === ref.line &&
      title === ref.title
    )
      found = { spec, test: t };
  });
  if (!found) throw new RunError(404, 'That test is not in this run.');
  if (!['unexpected', 'flaky'].includes(found.test.status))
    throw new RunError(400, 'That test did not fail.');

  const testCase = await caseOf(planSlug, ref.file, ref.line);
  const result = await runClaude(
    prompt({ run, ref, test: found.test, testCase }),
    SCHEMA,
  );
  const answer = answerOf(result);
  if (!answer?.headline || !CAUSES.includes(answer.cause))
    throw claudeError(
      result,
      'Claude answered without an explanation. Try again.',
    );

  const saved = {
    run: runId,
    ...ref,
    cause: answer.cause,
    confidence: answer.confidence ?? 'low',
    headline: answer.headline,
    whatHappened: answer.whatHappened ?? '',
    why: answer.why ?? '',
    evidence: answer.evidence ?? [],
    nextSteps: answer.nextSteps ?? [],
    createdAt: new Date().toISOString(),
    ...usageOf(result),
    costUsd: result.total_cost_usd ?? null,
  };
  await mkdir(explanationsDir(runId), { recursive: true });
  await writeFile(file, JSON.stringify(saved, null, 2));
  return saved;
}

// The plan case whose tests include this one, for what it should check.
async function caseOf(planSlug, file, line) {
  const plan = planSlug && (await loadPlan(planSlug).catch(() => null));
  const testCase = plan?.cases.find((c) =>
    c.locations?.some(
      (l) =>
        l.line === line && (l.file === file || l.file.endsWith(`/${file}`)),
    ),
  );
  return testCase && { ...testCase, planFile: plan.file };
}

// ---- the prompt ------------------------------------------------------------

const MAX_ERROR = 4000;
const here = (path) => relative(process.cwd(), path);

// The titles of the steps down to the one that failed, e.g.
// ["Upcoming Training Programs lists items"].
function failedStepPath(steps = []) {
  for (const s of steps) {
    if (!s.error) continue;
    return [s.title, ...failedStepPath(s.steps)];
  }
  return [];
}

function attemptLine(r, i) {
  const first = stripAnsi(r.errors?.[0]?.message ?? r.error?.message ?? '')
    .split('\n')
    .find((l) => l.trim());
  return `- Attempt ${i + 1}: ${r.status}${first ? ` — ${first}` : ''}`;
}

function prompt({ run, ref, test, testCase }) {
  // The attempt to look at: the last failed one (a flaky test passed after).
  const failed = test.results.findLast((r) => r.status !== 'passed') ??
    test.results.at(-1) ?? { status: 'unknown' };
  const error = stripAnsi(
    (failed.errors ?? [failed.error])
      .filter(Boolean)
      .map((e) => [e.message, e.snippet].filter(Boolean).join('\n'))
      .join('\n\n'),
  ).slice(0, MAX_ERROR);
  const stepPath = failedStepPath(failed.steps);
  const files = (failed.attachments ?? []).filter(
    (a) =>
      a.path &&
      (a.contentType?.startsWith('image/') || a.name === 'error-context'),
  );
  const site = run.env?.baseURL ?? run.site ?? 'unknown';
  const planRow = testCase
    ? `It is test case ${testCase.id} "${testCase.title}" in the test plan ${testCase.planFile}, which describes it as:\n${testCase.details.map((d) => `${d.label}: ${d.text}`).join('\n')}`
    : 'It is not matched to a case of a test plan.';

  return `You are explaining why a Playwright test failed, to a QA tester who does not read code.

The test "${ref.title}" (tests/${ref.file}:${ref.line}, Playwright project ${ref.project}) ran against ${site} on ${run.startedAt}.
${planRow}

${test.status === 'flaky' ? 'It failed, then passed on a retry (flaky).' : 'It failed.'} Attempts:
${test.results.map(attemptLine).join('\n')}

${stepPath.length ? `It failed in the step: ${stepPath.join(' › ')}` : 'No test step is marked as the one that failed.'}

The error:
\`\`\`
${error || '(no error message)'}
\`\`\`

What the run left behind:
${files.length ? files.map((a) => `- ${here(a.path)} (${a.name === 'error-context' ? "Playwright's snapshot of the page when it failed" : 'screenshot when it failed'})`).join('\n') : '- nothing (no screenshot or page snapshot)'}

Look at those files (read the screenshot image too), then the test and the helpers, fixtures and page objects it uses (under tests/), so you know what it expected and why. Decide what most likely went wrong: the site does not do what the test expects (a bug, or the site changed), the test is wrong, the environment got in the way (site down or slow, an error page, logged out, missing test data), or timing. Say so only as firmly as the evidence allows; if you cannot tell, say "unclear" and what would settle it. Name the real pages, buttons, texts and values. Do not quote code or name functions; to suggest a change to the test, say in words where and what.

Answer only with the JSON the schema asks for.`;
}
