// Runs one prompt check outside the dashboard: a plan's prompt case by its
// ID, or a prompt file by its name. Claude Code looks at the site in a
// browser and gives a verdict (see dashboard/server/runs/prompt.mjs).
//
// Usage:
//   npm run prompt -- <case-id> [--env qa] [--compare stage,prod|baseline|default|none] [--out <dir>]
//   npm run prompt -- --prompt <slug> [same options]
//
//   --env       qa (default), stage, prod, ... or a BASE_URL
//   --compare   what a check that compares sites compares with: one or more
//               environment ids (stage,prod), baseline, default or none.
//               default is the environment's own (Local, QA, Sandbox → Stage
//               and Production, Stage → Production, Production → baseline:
//               its last run's screenshots)
//   --out       the folder to write to (default reports/prompt-runs/<stamp>-<env>-<slug>)
//
// Writes <out>/result.json, <out>/screenshots/ and Claude's log
// (stream.jsonl). Exit code: 0 pass, 1 fail, 2 unsure or no verdict.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { killGroup } from '../dashboard/server/lib/processes.mjs';
import {
  findBaseline,
  runPromptCheck,
} from '../dashboard/server/runs/prompt.mjs';
import { BASELINE_SOURCES } from '../dashboard/server/runs/prompt-step.mjs';
import {
  promptSlugInCell,
  readPrompt,
  resolveCompare,
} from './lib/prompts.mjs';
import { planFiles } from './lib/layout.mjs';
import {
  authFile,
  environmentById,
  envFor,
  loginCommand,
} from './lib/site.mjs';

const OUT_ROOT = join('reports', 'prompt-runs');

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    env: { type: 'string', default: 'qa' },
    compare: { type: 'string' },
    prompt: { type: 'string' },
    out: { type: 'string' },
  },
});

function fail(message) {
  console.error(message);
  process.exit(2);
}

// The plan and row of case `id`: { plan, title, slug, noProd }.
async function findCase(id) {
  for (const { slug: plan, file } of await planFiles()) {
    const lines = (await readFile(file, 'utf8')).split('\n');
    let header = null;
    for (const line of lines) {
      if (!line.startsWith('|')) {
        header = null;
        continue;
      }
      const cells = line
        .trim()
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());
      if (!header) {
        header = cells;
        continue;
      }
      if (cells[0] !== id) continue;
      const at = (re) => header.findIndex((h) => re.test(h.replace(/\*/g, '')));
      const promptAt = at(/^prompt$/i);
      const prod = cells[at(/^prod(uction)?$/i)] ?? '';
      const head = lines.slice(0, 25).join('\n');
      return {
        plan,
        title: cells[1],
        slug: promptAt >= 2 ? promptSlugInCell(cells[promptAt]) : null,
        noProd: /^\**prod:\**\s*no\b/im.test(head) || /^no\b/i.test(prod),
      };
    }
  }
  return null;
}

const env =
  environmentById(values.env) ??
  (/^https?:\/\//.test(values.env) ? envFor(values.env) : null);
if (!env) fail(`Unknown environment "${values.env}".`);

let caseInfo = null;
let slug = values.prompt;
if (!slug) {
  const id = positionals[0];
  if (!id) fail('Give a case ID (e.g. HP-9) or --prompt <slug>.');
  caseInfo = await findCase(id);
  if (!caseInfo) fail(`No case ${id} in the plans in test-suites/.`);
  if (!caseInfo.slug)
    fail(`${id} is not a prompt case: run it with Playwright instead.`);
  if (env.production && caseInfo.noProd)
    fail(`${id} is marked no-prod, so it never runs on ${env.name}.`);
  slug = caseInfo.slug;
}

const check = await readPrompt(slug);
if (!check) fail(`No prompt file test-suites/<suite>/prompts/${slug}.md.`);
if (check.problems.length) fail(`${check.file}: ${check.problems.join(' ')}`);
if (check.role && !existsSync(authFile(check.role, env)))
  fail(
    `This check runs as ${check.role}, and there's no saved login on ${env.name}. Run:\n  ${loginCommand(check.role, env)}`,
  );

let compare;
try {
  compare =
    values.compare === 'none'
      ? { mode: 'none' }
      : resolveCompare(check, env, values.compare);
} catch (err) {
  fail(err.message);
}
const baseline =
  compare.mode === 'baseline'
    ? await findBaseline(slug, env.id, BASELINE_SOURCES)
    : null;

const startedAt = new Date();
const stamp = startedAt
  .toISOString()
  .replace(/[-:]/g, '')
  .replace('T', '-')
  .slice(0, 15);
const dir = values.out ?? join(OUT_ROOT, `${stamp}-${env.id}-${slug}`);
await mkdir(dir, { recursive: true });

const title = caseInfo
  ? `${positionals[0]}: ${caseInfo.title}`
  : `${check.name} (${slug})`;
console.log(`${title}\nOn ${env.name} (${env.baseURL})`);
if (compare.mode === 'site')
  for (const other of compare.envs)
    console.log(`Comparing with ${other.name} (${other.baseURL})`);
else if (compare.mode === 'baseline')
  console.log(
    baseline
      ? `Comparing with the baseline from ${baseline.from}`
      : `No earlier run on ${env.name} to compare with: review only`,
  );

let child = null;
let stopped = false;
process.on('SIGINT', () => {
  stopped = true;
  if (child) killGroup(child);
});
const io = {
  log: (text) => process.stdout.write(text),
  isStopped: () => stopped,
  kill: () => child && killGroup(child),
  spawn: (command, args, { env: extra = {}, onStdout }) =>
    new Promise((done) => {
      child = spawn(command, args, {
        detached: true,
        env: { ...process.env, FORCE_COLOR: '0', ...extra },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      child.stdout.on('data', (c) => onStdout(c.toString()));
      child.stderr.on('data', (c) => process.stderr.write(c));
      child.on('error', () => done({ code: null }));
      child.on('close', (code) => done({ code }));
    }),
};

const result = await runPromptCheck({
  check,
  env,
  compare,
  baseline,
  dir,
  // Paths in result.json are relative to OUT_ROOT, like run.json's to the
  // dashboard's runs folder, so findBaseline() reads both the same way.
  relTo: values.out ? dir : OUT_ROOT,
  io,
});

await writeFile(
  join(dir, 'result.json'),
  JSON.stringify(
    {
      kind: 'prompt',
      title,
      plan: caseInfo?.plan ?? null,
      case: caseInfo ? positionals[0] : null,
      env: { id: env.id, name: env.name, baseURL: env.baseURL },
      startedAt: startedAt.toISOString(),
      check: {
        slug,
        file: check.file,
        role: check.role,
        viewports: check.viewports,
        finishedAt: new Date().toISOString(),
        ...result,
      },
    },
    null,
    2,
  ),
);

// "claude-sonnet-4-6, 23 turns, 412,300 tokens in (398,100 cached) / 6,210
// out, $0.41, 2m 13s".
function claudeUsage(r) {
  const n = (x) => x.toLocaleString('en-US');
  const s = Math.round((r.durationMs ?? 0) / 1000);
  return [
    r.model,
    r.turns != null && `${r.turns} turns`,
    r.tokens &&
      `${n(r.tokens.in)} tokens in (${n(r.tokens.cached)} cached) / ${n(r.tokens.out)} out`,
    r.costUsd != null && `$${r.costUsd.toFixed(2)}`,
    s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`,
  ]
    .filter(Boolean)
    .join(', ');
}

const shotsBase = values.out ? dir : OUT_ROOT;
console.log(
  `\n${result.status.toUpperCase()}: ${result.summary ?? result.error}`,
);
for (const f of result.findings ?? [])
  console.log(
    `  - [${f.severity}] ${f.text}${f.screenshot ? ` (${f.screenshot})` : ''}`,
  );
console.log(`\nScreenshots: ${resolve(shotsBase)}/…`);
for (const s of result.screenshots) console.log(`  ${join(shotsBase, s)}`);
console.log(`Result: ${join(dir, 'result.json')}`);
console.log(`Claude: ${claudeUsage(result)}`);
process.exit(
  result.status === 'passed' ? 0 : result.status === 'failed' ? 1 : 2,
);
