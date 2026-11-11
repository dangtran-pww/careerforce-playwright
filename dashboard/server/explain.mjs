// Explains, in plain words, what a test case's code does: asks Claude Code
// (`claude -p`, read-only tools) to read the case's tests and the helpers and
// page objects they call, and describe each step and what it checks.
//
// Answers are kept in reports/explanations/<plan>/<case>.json (gitignored),
// with a hash of the case's spec files. While those files are unchanged the
// saved answer is reused; `refresh` asks again (e.g. after a helper changed).

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { RunError } from './runs.mjs';

const CLAUDE = process.env.CLAUDE_BIN ?? 'claude';
// Sonnet reads and describes test code well, for much less than Opus.
// EXPLAIN_MODEL (e.g. haiku, opus) picks another.
const EXPLAIN_MODEL = process.env.EXPLAIN_MODEL || 'sonnet';
const EXPLAIN_TIMEOUT_MS = Number(process.env.EXPLAIN_TIMEOUT_MS ?? 5 * 60_000);
// At most this many `claude -p` answers at once (explanations, reviews and
// failure explanations together); the rest wait their turn.
const CLAUDE_CONCURRENCY = Math.max(
  1,
  Number(process.env.CLAUDE_CONCURRENCY) || 2,
);
const cacheDir = join('reports', 'explanations');

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
  const where = testCase.locations
    .map((l) => `- ${l.file}:${l.line} — "${l.title}"`)
    .join('\n');
  const planRow = testCase.details
    .map((d) => `${d.label}: ${d.text}`)
    .join('\n');
  return `You are explaining a Playwright test to a QA tester who does not read code.

Test case ${testCase.id} "${testCase.title}" from the test plan ${plan.file}.
The plan describes it as:
${planRow || '(no more detail in the plan)'}

Its code:
${where}

Read those tests, and the helpers, fixtures and page objects they call (under tests/), so you know what really happens. Then explain the steps the test performs, in order, as actions on the site ("Opens /user/login", "Clicks 'DEED Staff Member'") and, for each, what it checks. Name the real pages, buttons, texts and values from the code. If there are several tests or the test loops over data, say what varies. Do not quote code or name functions.

Answer only with the JSON the schema asks for.`;
}

export const hashFiles = async (files) => {
  const h = createHash('sha256');
  for (const f of [...files].sort())
    h.update(f).update(await readFile(f, 'utf8').catch(() => ''));
  return h.digest('hex').slice(0, 16);
};

const cacheFile = (plan, id) => join(cacheDir, plan.slug, `${id}.json`);

export function findCase(plan, id) {
  const testCase = plan.cases.find((c) => c.id === id);
  if (!testCase) throw new RunError(404, `${id} is not a case of this plan.`);
  if (!testCase.locations?.length)
    throw new RunError(400, `${id} has no tests to explain yet.`);
  return testCase;
}

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
const pending = new Map();

/** Ask Claude for an explanation (or reuse the saved one), and save it. */
export function explainCase(plan, id, { refresh = false } = {}) {
  const key = `${plan.slug}/${id}${refresh ? '#refresh' : ''}`;
  if (!pending.has(key))
    pending.set(
      key,
      generate(plan, id, refresh).finally(() => pending.delete(key)),
    );
  return pending.get(key);
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

// The JSON answer from a `claude -p` result: the structured output, or the
// first {...} in its text.
export function answerOf(result) {
  if (result.structured_output) return result.structured_output;
  if (typeof result.result !== 'string') return null;
  try {
    return JSON.parse(result.result.match(/\{[\s\S]*\}/)?.[0] ?? '');
  } catch {
    return null;
  }
}

// The error to show when Claude stopped or answered off-schema.
export function claudeError(result, fallback) {
  return new RunError(
    502,
    result.is_error
      ? `Claude stopped: ${result.subtype ?? 'error'}${result.result ? ` (${String(result.result).slice(0, 300)})` : ''}`
      : fallback,
  );
}

// The model that wrote the answer and the tokens it took, from the
// `claude -p` JSON result. `modelUsage` has one entry per model (Claude Code
// may also call a small model on the side); the one with the most output is
// the one that answered. Tokens in counts cached input too, since a long
// read of the code is mostly cache reads.
export function usageOf(result) {
  const perModel = Object.entries(result.modelUsage ?? {});
  if (!perModel.length) {
    const u = result.usage;
    if (!u) return { model: EXPLAIN_MODEL };
    return {
      model: EXPLAIN_MODEL,
      tokens: tokens(
        u.input_tokens,
        u.cache_read_input_tokens,
        u.cache_creation_input_tokens,
        u.output_tokens,
      ),
    };
  }
  const [model] = perModel.reduce((a, b) =>
    (b[1].outputTokens ?? 0) > (a[1].outputTokens ?? 0) ? b : a,
  );
  const sum = (k) => perModel.reduce((n, [, u]) => n + (u[k] ?? 0), 0);
  return {
    model,
    tokens: tokens(
      sum('inputTokens'),
      sum('cacheReadInputTokens'),
      sum('cacheCreationInputTokens'),
      sum('outputTokens'),
    ),
  };
}

const tokens = (input = 0, cacheRead = 0, cacheWrite = 0, output = 0) => ({
  in: input + cacheRead + cacheWrite,
  cached: cacheRead,
  out: output,
});

// ---- running claude --------------------------------------------------------

let running = 0;
const waiting = [];
// The `claude` processes running now, so the dashboard can end them when it
// stops.
const children = new Set();

// Take one of the CLAUDE_CONCURRENCY slots, waiting for one if needed. A
// released slot is handed straight to the next waiter, so no new caller can
// slip in between.
async function acquire() {
  if (running < CLAUDE_CONCURRENCY) {
    running++;
    return;
  }
  await new Promise((resolve) => waiting.push(resolve));
}

function release() {
  const next = waiting.shift();
  if (next) next();
  else running--;
}

// End a `claude` process and the MCP servers and tools it started (it runs
// in its own process group).
function killGroup(child) {
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
}

/** End every `claude -p` still running (when the dashboard stops). */
export function stopClaudes() {
  for (const child of children) killGroup(child);
}

// Run `claude -p` with read-only tools, answering in the given JSON schema;
// resolve with its JSON result. review.mjs and failure.mjs use it too.
export async function runClaude(text, schema) {
  await acquire();
  try {
    return await spawnClaude(text, schema);
  } finally {
    release();
  }
}

function spawnClaude(text, schema) {
  const args = [
    '-p',
    text,
    '--output-format',
    'json',
    '--json-schema',
    JSON.stringify(schema),
    '--allowedTools',
    'Read,Grep,Glob',
    '--disallowedTools',
    'Bash,Edit,Write,NotebookEdit,WebFetch,WebSearch,Task',
    '--strict-mcp-config',
    '--max-turns',
    '30',
    '--model',
    EXPLAIN_MODEL,
  ];
  return new Promise((resolve, reject) => {
    const child = spawn(CLAUDE, args, {
      // Own process group, so a timeout ends Claude and everything it
      // started. That also keeps Ctrl+C from reaching it: stopClaudes() does.
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0' },
    });
    children.add(child);
    let out = '';
    let err = '';
    let timedOut = false;
    child.stdout.on('data', (c) => (out += c));
    child.stderr.on('data', (c) => (err += c));
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup(child);
    }, EXPLAIN_TIMEOUT_MS);
    child.on('error', () => {
      clearTimeout(timer);
      children.delete(child);
      reject(
        new RunError(
          500,
          `Couldn't start \`${CLAUDE}\`. Is Claude Code installed and logged in?`,
        ),
      );
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      children.delete(child);
      if (timedOut)
        return reject(
          new RunError(
            504,
            `Claude took longer than ${EXPLAIN_TIMEOUT_MS / 60000} minutes.`,
          ),
        );
      if (signal)
        return reject(new RunError(502, `Claude was stopped (${signal}).`));
      try {
        resolve(JSON.parse(out));
      } catch {
        reject(
          new RunError(
            502,
            `Claude failed (exit code ${code}): ${(err || out).trim().slice(0, 300)}`,
          ),
        );
      }
    });
  });
}
