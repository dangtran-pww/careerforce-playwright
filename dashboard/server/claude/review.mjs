// Reviews a test case's code against its row in the test plan: asks Claude
// Code (`claude -p`, read-only tools) to read the plan and the case's tests,
// helpers and page objects, and say whether the code does what the plan
// describes, and where it falls short or goes further.
//
// Never written to disk. The latest review of each case is kept in memory
// while the dashboard server runs, so it is still there when you come back
// to the page; restarting the server forgets it. Every request asks Claude
// again. Explaining the case's code again resets it (forgetReview).

import { ApiError } from '../errors.mjs';
import { singleFlight } from '../lib/single-flight.mjs';
import { caseContext, findCase, hashFiles } from './cases.mjs';
import { answerOf, claudeError, runClaude, usageOf } from './run.mjs';

const SCHEMA = {
  type: 'object',
  required: ['verdict', 'summary', 'findings'],
  properties: {
    verdict: {
      type: 'string',
      enum: ['matches', 'partial', 'differs'],
      description:
        'matches: the code covers every step and expected result in the plan. partial: it covers most, with gaps or differences. differs: it does not test what the plan describes.',
    },
    summary: {
      type: 'string',
      description: 'One or two sentences: how well the code follows the plan.',
    },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['kind', 'text'],
        properties: {
          kind: {
            type: 'string',
            enum: ['missing', 'different', 'extra', 'covered'],
            description:
              'missing: in the plan, not in the code. different: the code does it another way or checks something weaker or other than the plan says. extra: the code checks something the plan does not mention. covered: a plan step or expected result the code does test.',
          },
          text: {
            type: 'string',
            description:
              'The plan step or expectation concerned and what the code does about it, in plain words.',
          },
        },
      },
    },
  },
};

function prompt(plan, testCase) {
  const { where, planRow } = caseContext(testCase);
  return `You are reviewing a Playwright test against its test plan, for a QA tester who does not read code.

Test case ${testCase.id} "${testCase.title}" from the test plan ${plan.file}.
The plan describes it as:
${planRow}

Its code:
${where}

Read the plan file (its overview and notes may set rules for every case), then those tests and the helpers, fixtures and page objects they call (under tests/), so you know what really happens. Compare the two: for every step and expected result in the plan, say whether the code really does and checks it, does it differently or more weakly (e.g. only checks a link exists rather than that it works), or not at all. Also list checks the code makes that the plan does not mention. Name the real pages, buttons, texts and values. Do not quote code or name functions. Do not invent problems: if the code follows the plan, say so.

Answer only with the JSON the schema asks for.`;
}

// One request per case at a time: a second click (or coming back to the
// page while it runs) joins the first.
const flights = singleFlight();
// The latest review of each case, in memory only.
const latest = new Map();

const keyOf = (plan, id) => `${plan.slug}/${id}`;
const filesOf = (plan, id) => findCase(plan, id).locations.map((l) => l.file);

/**
 * The latest review of the case from this server's memory, whether one is
 * running now, and whether the spec files changed since it was written.
 */
export async function latestReview(plan, id) {
  const files = filesOf(plan, id);
  const key = keyOf(plan, id);
  const review = latest.get(key) ?? null;
  return {
    review: review && {
      ...review,
      stale: review.hash !== (await hashFiles(files)),
    },
    reviewing: flights.has(flightOf(key)),
  };
}

// How many times each case's review was reset (forgetReview). A review
// running across a reset is not kept, and a request after the reset starts
// a new one rather than joining it.
const resets = new Map();
const flightOf = (key) => `${key}#${resets.get(key) ?? 0}`;

/** Ask Claude to review the case's code against the plan; keep it in memory. */
export function reviewCase(plan, id) {
  const key = keyOf(plan, id);
  const flight = flightOf(key);
  return flights.run(flight, async () => {
    const review = await generate(plan, id);
    if (flightOf(key) === flight) latest.set(key, review);
    return { ...review, stale: false };
  });
}

/**
 * Forget the case's review, and the result of one running now. Called when
 * the case's code is explained again: the review then has to be asked for
 * again too.
 */
export function forgetReview(plan, id) {
  const key = keyOf(plan, id);
  latest.delete(key);
  resets.set(key, (resets.get(key) ?? 0) + 1);
}

async function generate(plan, id) {
  const testCase = findCase(plan, id);
  const files = testCase.locations.map((l) => l.file);
  const result = await runClaude(prompt(plan, testCase), SCHEMA);
  const answer = answerOf(result);
  if (!answer?.verdict || !Array.isArray(answer.findings))
    throw claudeError(result, 'Claude answered without a review. Try again.');
  if (!['matches', 'partial', 'differs'].includes(answer.verdict))
    throw new ApiError(
      502,
      `Claude gave an unknown verdict: ${answer.verdict}`,
    );
  return {
    plan: plan.slug,
    case: id,
    verdict: answer.verdict,
    summary: answer.summary ?? '',
    findings: answer.findings,
    files,
    hash: await hashFiles(files),
    createdAt: new Date().toISOString(),
    ...usageOf(result),
    costUsd: result.total_cost_usd ?? null,
  };
}
