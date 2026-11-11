// Explains, in plain words, what a test case's code does: asks Claude Code
// (`claude -p`, read-only tools) to read the case's tests and the helpers and
// page objects they call, and describe each step and what it checks.
//
// Answers are kept in reports/explanations/<plan>/<case>.json (gitignored),
// with a hash of the case's spec files. While those files are unchanged the
// saved answer is reused; `refresh` asks again (e.g. after a helper changed).

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { singleFlight } from '../lib/single-flight.mjs';
import { EXPLANATIONS_DIR as cacheDir } from '../paths.mjs';
import { caseContext, findCase, hashFiles } from './cases.mjs';
import { answerOf, claudeError, runClaude, usageOf } from './run.mjs';

const SCHEMA = {
  type: 'object',
  required: ['summary', 'steps'],
  properties: {
    summary: {
      type: 'string',
      description: 'One or two sentences: what the test proves.',
    },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        required: ['action', 'checks'],
        properties: {
          action: {
            type: 'string',
            description: 'What the test does, as a person would on the site.',
          },
          checks: {
            type: 'array',
            items: { type: 'string' },
            description: 'What it then asserts, in plain words. May be empty.',
          },
        },
      },
    },
  },
};

function prompt(plan, testCase) {
  const { where, planRow } = caseContext(testCase);
  return `You are explaining a Playwright test to a QA tester who does not read code.

Test case ${testCase.id} "${testCase.title}" from the test plan ${plan.file}.
The plan describes it as:
${planRow}

Its code:
${where}

Read those tests, and the helpers, fixtures and page objects they call (under tests/), so you know what really happens. Then explain the steps the test performs, in order, as actions on the site ("Opens /user/login", "Clicks 'DEED Staff Member'") and, for each, what it checks. Name the real pages, buttons, texts and values from the code. If there are several tests or the test loops over data, say what varies. Do not quote code or name functions.

Answer only with the JSON the schema asks for.`;
}

const cacheFile = (plan, id) => join(cacheDir, plan.slug, `${id}.json`);

/** The saved explanation, if the case's spec files haven't changed since. */
export async function savedExplanation(plan, id) {
  const testCase = findCase(plan, id);
  const saved = await readFile(cacheFile(plan, id), 'utf8')
    .then(JSON.parse)
    .catch(() => null);
  if (!saved) return null;
  const hash = await hashFiles(testCase.locations.map((l) => l.file));
  return { ...saved, stale: saved.hash !== hash };
}

// One request per case at a time: a second click waits for the first. A
// refresh doesn't join a request that may return the saved answer.
const flights = singleFlight();

/** Ask Claude for an explanation (or reuse the saved one), and save it. */
export function explainCase(plan, id, { refresh = false } = {}) {
  const key = `${plan.slug}/${id}${refresh ? '#refresh' : ''}`;
  return flights.run(key, () => generate(plan, id, refresh));
}

async function generate(plan, id, refresh) {
  const testCase = findCase(plan, id);
  const files = testCase.locations.map((l) => l.file);
  const hash = await hashFiles(files);
  if (!refresh) {
    const saved = await savedExplanation(plan, id);
    if (saved && !saved.stale) return saved;
  }

  const result = await runClaude(prompt(plan, testCase), SCHEMA);
  const answer = answerOf(result);
  if (!answer?.steps)
    throw claudeError(
      result,
      'Claude answered without an explanation. Try again.',
    );

  const saved = {
    plan: plan.slug,
    case: id,
    summary: answer.summary ?? '',
    steps: answer.steps,
    files,
    hash,
    createdAt: new Date().toISOString(),
    ...usageOf(result),
    costUsd: result.total_cost_usd ?? null,
  };
  await mkdir(join(cacheDir, plan.slug), { recursive: true });
  await writeFile(cacheFile(plan, id), JSON.stringify(saved, null, 2));
  return { ...saved, stale: false };
}
