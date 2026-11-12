// Running Claude Code (`claude -p`) for the dashboard, and reading its
// answers. Two kinds of call use it:
//
//   runClaude()   one question, one JSON answer, read-only tools: explaining
//                 a case (explain.mjs), reviewing it (review.mjs), explaining
//                 a failed test (failure.mjs); or no tools: summarizing a
//                 run's failures (summary.mjs). At most CLAUDE_CONCURRENCY run
//                 at once; the rest wait their turn.
//   claudeArgs()  the arguments only, for a caller that runs `claude` itself:
//                 a suite's prompt steps (runs/suite-run.mjs) run it as a step of
//                 the run, so Stop and the run's log apply to it.
//
// Either way Claude gets the tools it is given and is denied every tool that
// writes, runs commands, browses the web or starts other agents.
//
// Env: CLAUDE_BIN (default `claude`), EXPLAIN_MODEL (default sonnet),
// EXPLAIN_TIMEOUT_MS (default 5 minutes), CLAUDE_CONCURRENCY (default 2).

import { spawn } from 'node:child_process';
import { ApiError } from '../errors.mjs';
import { killGroup } from '../lib/processes.mjs';

export const CLAUDE = process.env.CLAUDE_BIN ?? 'claude';
// Sonnet reads and describes test code well, for much less than Opus.
// EXPLAIN_MODEL (e.g. haiku, opus) picks another for every runClaude() call.
const MODEL = process.env.EXPLAIN_MODEL || 'sonnet';
const TIMEOUT_MS = Number(process.env.EXPLAIN_TIMEOUT_MS ?? 5 * 60_000);
const CONCURRENCY = Math.max(1, Number(process.env.CLAUDE_CONCURRENCY) || 2);

// Denied on every call, whatever tools it is given.
const DENIED_TOOLS = [
  'Bash',
  'Edit',
  'Write',
  'NotebookEdit',
  'WebFetch',
  'WebSearch',
  'Task',
];

const READ_TOOLS = ['Read', 'Grep', 'Glob'];

export const NOT_STARTED = `Couldn't start \`${CLAUDE}\`. Is Claude Code installed and logged in?`;

/**
 * Arguments for `claude -p`: answer `text` with JSON that fits `schema`,
 * using only `tools`. `stream` asks for stream-json (one JSON event per
 * line, the result last) instead of a single JSON result. `mcpConfig` is
 * the only MCP config it loads; without one it loads none. `deny` adds to
 * the tools always denied, e.g. "Read(./.env)".
 */
export function claudeArgs(
  text,
  schema,
  { tools, deny = [], maxTurns, model, stream = false, mcpConfig } = {},
) {
  return [
    '-p',
    text,
    '--output-format',
    ...(stream ? ['stream-json', '--verbose'] : ['json']),
    '--json-schema',
    JSON.stringify(schema),
    ...(mcpConfig ? ['--mcp-config', mcpConfig] : []),
    '--strict-mcp-config',
    ...(tools.length ? ['--allowedTools', tools.join(',')] : []),
    '--disallowedTools',
    // With no tools, Claude answers from the prompt alone.
    [...DENIED_TOOLS, ...(tools.length ? [] : READ_TOOLS), ...deny].join(','),
    '--max-turns',
    String(maxTurns),
    ...(model ? ['--model', model] : []),
  ];
}

// ---- reading an answer -----------------------------------------------------

/**
 * The JSON answer from a `claude -p` result: the structured output, or the
 * first {...} in its text. Null when there is none.
 */
export function answerOf(result) {
  if (result?.structured_output) return result.structured_output;
  if (typeof result?.result !== 'string') return null;
  try {
    return JSON.parse(result.result.match(/\{[\s\S]*\}/)?.[0] ?? '');
  } catch {
    return null;
  }
}

/** Why Claude stopped without answering, or null if it didn't. */
export function stoppedReason(result) {
  if (!result?.is_error && !result?.subtype?.startsWith('error')) return null;
  const detail = result.result
    ? ` (${String(result.result).slice(0, 300)})`
    : '';
  return `Claude stopped: ${result.subtype ?? 'error'}${detail}`;
}

/** The error to answer with when Claude stopped or answered off-schema. */
export function claudeError(result, fallback) {
  return new ApiError(502, stoppedReason(result) ?? fallback);
}

// The model that wrote the answer and the tokens it took, from the
// `claude -p` JSON result. `modelUsage` has one entry per model (Claude Code
// may also call a small model on the side); the one with the most output is
// the one that answered. Tokens in counts cached input too, since a long
// read of the code is mostly cache reads. `fallbackModel` is the model to
// name when the result doesn't say.
export function usageOf(result, fallbackModel = MODEL) {
  const perModel = Object.entries(result.modelUsage ?? {});
  if (!perModel.length) {
    const u = result.usage;
    if (!u) return { model: fallbackModel };
    return {
      model: fallbackModel,
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

// ---- runClaude -------------------------------------------------------------

let running = 0;
const waiting = [];
// The `claude` processes runClaude started that are still running, so the
// dashboard can end them when it stops.
const children = new Set();

// Take one of the CONCURRENCY slots, waiting for one if needed. A released
// slot is handed straight to the next waiter, so no new caller can slip in
// between.
async function acquire() {
  if (running < CONCURRENCY) {
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

/** End every runClaude() call still running (when the dashboard stops). */
export function stopClaudes() {
  for (const child of children) killGroup(child);
}

/**
 * Ask Claude `text`, with the Read, Grep and Glob tools only (or `tools`,
 * none for an answer from the prompt alone), for a JSON answer that fits
 * `schema`. Resolves with the `claude -p` JSON result; read it with
 * answerOf() and usageOf().
 */
export async function runClaude(
  text,
  schema,
  { tools = READ_TOOLS, maxTurns = 30 } = {},
) {
  await acquire();
  try {
    return await spawnClaude(
      claudeArgs(text, schema, { tools, maxTurns, model: MODEL }),
    );
  } finally {
    release();
  }
}

function spawnClaude(args) {
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
    }, TIMEOUT_MS);
    child.on('error', () => {
      clearTimeout(timer);
      children.delete(child);
      reject(new ApiError(500, NOT_STARTED));
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      children.delete(child);
      if (timedOut)
        return reject(
          new ApiError(
            504,
            `Claude took longer than ${TIMEOUT_MS / 60000} minutes.`,
          ),
        );
      if (signal)
        return reject(new ApiError(502, `Claude was stopped (${signal}).`));
      try {
        resolve(JSON.parse(out));
      } catch {
        reject(
          new ApiError(
            502,
            `Claude failed (exit code ${code}): ${(err || out).trim().slice(0, 300)}`,
          ),
        );
      }
    });
  });
}
