// Running one prompt check: Claude Code (`claude -p`) looks at the site in a
// browser through the Playwright MCP and answers with a verdict (pass, fail
// or unsure), a summary, findings and screenshots. The check is a prompt file
// (scripts/lib/prompts.mjs), used by:
//   - plan runs, for the plan's prompt cases (plan-run.mjs);
//   - suite runs, for the prompt cases of their plans and their own prompt
//     steps (suite-run.mjs);
//   - scripts/run-prompt.mjs, outside the dashboard (`npm run prompt`).
// The caller passes `io`, which runs the `claude` process and logs its
// actions, so this file doesn't depend on the dashboard's run lifecycle.
//
// A check can compare (`compare` from resolveCompare() in
// scripts/lib/prompts.mjs):
//   site      the same pages on another environment, in a second tab, e.g.
//             QA against Stage;
//   baseline  the screenshots of the last run of the same prompt on this
//             environment, e.g. Production before and after a deploy. They
//             are copied into the check's baseline/ folder, and Claude may
//             read only that folder.
//
// The check's folder:
//   mcp.json        the Playwright MCP config Claude gets
//   stream.jsonl    Claude's own log
//   screenshots/    what Claude saved
//   baseline/       the earlier screenshots it compared with (baseline only)

import { createWriteStream } from 'node:fs';
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import { authFile } from '../../../scripts/lib/site.mjs';
import {
  CLAUDE,
  NOT_STARTED,
  answerOf,
  claudeArgs,
  stoppedReason,
  usageOf,
} from '../claude/run.mjs';

// A check that takes longer than this is stopped and marked as an error.
// Comparing takes longer: two sites, every viewport.
const TIMEOUT_MS = Number(process.env.PROMPT_TIMEOUT_MS ?? 6 * 60_000);
const COMPARE_TIMEOUT_MS = Number(
  process.env.PROMPT_COMPARE_TIMEOUT_MS ?? 15 * 60_000,
);
const MAX_TURNS = process.env.PROMPT_MAX_TURNS ?? '40';
const COMPARE_MAX_TURNS = process.env.PROMPT_COMPARE_MAX_TURNS ?? '100';
// PROMPT_MODEL (e.g. sonnet, haiku) picks a cheaper model than your default.
const MODEL = process.env.PROMPT_MODEL;

const MCP = 'mcp__playwright-test__';
// Looking and clicking only: no file writes, no test generation, no
// arbitrary code (so no browser_evaluate: page JS could send requests that
// change data with the session's login).
const BROWSER_TOOLS = [
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
].map((t) => MCP + t);
// Baseline checks also read the earlier screenshots (Read, limited to the
// baseline folder by the prompt; these are denied outright).
const SECRET_FILES = [
  'Read(./.env)',
  'Read(./.env.*)',
  'Read(./playwright/.auth/**)',
];

const SCHEMA = {
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
          viewport: {
            type: 'string',
            description: 'The viewport it was seen at (e.g. desktop), if any.',
          },
        },
        required: ['severity', 'text'],
      },
    },
  },
  required: ['verdict', 'summary', 'findings'],
};

// ---- the prompt -----------------------------------------------------------

const viewportList = (viewports) =>
  viewports.map((v) => `${v.name} (${v.width}x${v.height})`).join(', ');

function compareRules(check, env, compare, baseline) {
  const baselineFiles = baseline?.files ?? [];
  const views = viewportList(check.viewports);
  if (compare.mode === 'site')
    return `
This is a side-by-side comparison. The site under test is ${env.baseURL} (${env.name}). The site to compare with is ${compare.env.baseURL} (${compare.env.name}); open it in a second tab with browser_tabs and visit the same paths there.
- Do it at each of these viewports, one at a time, setting the size with browser_resize: ${views}.
- At each viewport, look at each page top to bottom on both sites, and take paired screenshots named "<two-digit number>-<page>-<viewport>-<site>.png", where <site> is ${env.id} or ${compare.env.id}, e.g. "01-home-desktop-${env.id}.png" and "02-home-desktop-${compare.env.id}.png".
- The sites have different content: different jobs, events, dates, blog posts, counts and images are expected and are not differences. Compare layout and styling only: missing, extra or reordered blocks; spacing and alignment; fonts, sizes and colours; buttons and links that look different; images that are broken, stretched or cropped differently; text cut off or overlapping; sideways scrolling; the header and menu at each viewport.
- Verdict "fail" when ${env.name} has a layout or styling difference that looks unintended or broken. "pass" when the only differences are content (list them as "note" findings). Say in each finding which site and viewport it is on, and fill in its viewport.`;
  if (compare.mode === 'baseline' && baselineFiles.length)
    return `
This compares ${env.name} with how the same pages looked in an earlier run of this check on ${env.name} (the baseline, from ${baseline?.from}). Its screenshots are these files; view them with Read (read no other files):
${baselineFiles.map((f) => `  - ${f}`).join('\n')}
- Look at the same pages at the same viewports (${views}, set with browser_resize), and take screenshots named "<two-digit number>-<page>-<viewport>.png".
- Content changes (different jobs, events, dates, posts, counts, images) are expected. Compare layout and styling only: missing, extra or reordered blocks; spacing and alignment; fonts, sizes and colours; broken or differently cropped images; text cut off or overlapping; sideways scrolling; the header and menu.
- Verdict "fail" when the layout or styling changed in a way that looks unintended or broken. "pass" when only content changed (list notable changes as "note" findings).`;
  if (compare.mode === 'baseline')
    return `
There is no earlier run of this check on ${env.name} to compare with (no baseline), so review the pages on their own at each viewport (${views}, set with browser_resize): fail when something looks broken, overlapping, cut off or unstyled. Start the summary with "No baseline, review only." Take screenshots named "<two-digit number>-<page>-<viewport>.png"; the next run compares with them.`;
  return check.viewports.length > 1
    ? `
Check at each of these viewports, one at a time, setting the size with browser_resize: ${views}. Put the viewport in each screenshot's name.`
    : '';
}

function wrapPrompt(check, env, compare, shotsDir, baseline) {
  const who = check.role
    ? `logged in as ${check.role}`
    : 'as an anonymous visitor';
  return `You are doing one check of a smoke test of the CareerForce website at ${env.baseURL} (${env.name} environment), ${who}.

Setup: first call planner_setup_page with project "seed" and seedFile "tests/seed.spec.ts". That opens a browser on the site${check.role ? `, already logged in as ${check.role}` : ''}. Then use the browser tools. Paths such as /user/login are on ${env.baseURL}.

Rules:
- Read-only. Do not submit forms that create, change or delete anything, do not log out, and do not change any setting. Searching and opening pages is fine.
- Take a screenshot of what you check with browser_take_screenshot (scale "css"), saving it in "${shotsDir}/". Take at least 1 and at most ${check.screenshots}.
- Judge only what the check asks. Verdict "fail" when something it asks about is missing, broken or shows an error; "unsure" when you couldn't tell (the page didn't load, you were blocked). Name the screenshot that shows each finding.
${compareRules(check, env, compare, baseline)}

The check:
${check.prompt}`;
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

const IMAGE = /\.(png|jpe?g|webp)$/i;

const listImages = async (dir) =>
  (await readdir(dir).catch(() => [])).filter((f) => IMAGE.test(f)).sort();

// ---- baselines ----------------------------------------------------------------

/**
 * The newest earlier result of prompt `slug` on environment `envId` that
 * has screenshots, from `sources`: [{ dir, file }], where each run folder in
 * `dir` holds a `file` (run.json or result.json) and screenshot paths are
 * relative to `dir`. Returns { from, files: [absolute paths] } or null.
 */
export async function findBaseline(slug, envId, sources) {
  const found = [];
  for (const { dir, file } of sources) {
    for (const name of await readdir(dir).catch(() => [])) {
      let meta;
      try {
        meta = JSON.parse(await readFile(join(dir, name, file), 'utf8'));
      } catch {
        continue;
      }
      if ((meta.env?.id ?? 'qa') !== envId) continue;
      for (const r of promptResultsOf(meta)) {
        if (r.slug !== slug || !r.screenshots?.length) continue;
        if (!['passed', 'failed', 'unsure'].includes(r.status)) continue;
        found.push({
          at: r.finishedAt ?? meta.startedAt ?? '',
          from: `${meta.planName ?? meta.title ?? name}, ${meta.startedAt ?? name}`,
          files: r.screenshots.map((p) => resolve(dir, p)),
        });
      }
    }
  }
  found.sort((a, b) => b.at.localeCompare(a.at));
  return found[0] ?? null;
}

// Every prompt result in a run.json or result.json.
function promptResultsOf(meta) {
  return [
    ...(meta.prompts ?? []),
    ...(meta.check ? [meta.check] : []),
    ...(meta.steps ?? []).flatMap((s) => [
      ...(s.kind === 'prompt' ? [s] : []),
      ...(s.prompts ?? []),
    ]),
  ];
}

// ---- running it ---------------------------------------------------------------

/**
 * Run `check` ({ slug, role, prompt, viewports, screenshots }) on `env`,
 * comparing as `compare` says, in folder `dir`. `baseline` is findBaseline()'s
 * answer (baseline mode only). `relTo` is the folder that screenshot paths in
 * the result are relative to. `io` = { spawn(command, args, { env, onStdout })
 * → Promise<{ code }>, log(text), isStopped(), kill() }.
 *
 * Resolves with { status, verdict, summary, findings, screenshots,
 * baselineScreenshots, compare, turns, costUsd, model, tokens, durationMs,
 * error }; status is passed, failed, unsure, stopped or error. `tokens` is
 * { in, cached, out } (usageOf() in claude/run.mjs); `durationMs` is the
 * wall-clock time of the `claude` process, browser startup included.
 */
export async function runPromptCheck({
  check,
  env,
  compare,
  baseline = null,
  dir,
  relTo,
  io,
}) {
  const rel = (path) =>
    relative(resolve(relTo), resolve(path)).split('\\').join('/');
  const shotsDir = join(dir, 'screenshots');
  await mkdir(shotsDir, { recursive: true });

  // The baseline's screenshots, copied in, so the run keeps what it was
  // compared with and Claude reads only this folder.
  const baselineDir = join(dir, 'baseline');
  const baselineFiles = [];
  if (compare.mode === 'baseline' && baseline) {
    await mkdir(baselineDir, { recursive: true });
    for (const file of baseline.files) {
      const to = join(baselineDir, basename(file));
      try {
        await copyFile(file, to);
        baselineFiles.push(resolve(to));
      } catch {
        // Deleted since: compare with the rest.
      }
    }
  }
  const compareInfo = {
    mode: compare.mode,
    ...(compare.mode === 'site'
      ? {
          envId: compare.env.id,
          envName: compare.env.name,
          baseURL: compare.env.baseURL,
        }
      : {}),
    ...(compare.mode === 'baseline'
      ? { baselineFrom: baselineFiles.length ? baseline.from : null }
      : {}),
  };

  const mcpConfig = join(dir, 'mcp.json');
  const serverEnv = {
    BASE_URL: env.baseURL,
    SEED_STORAGE_STATE: check.role ? resolve(authFile(check.role, env)) : '',
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

  // One stream, so the lines stay in order.
  const stream = createWriteStream(join(dir, 'stream.jsonl'));
  stream.on('error', () => {}); // Claude's own log only; never fails the check
  let buffer = '';
  let result = null;
  const onStdout = (text) => {
    buffer += text;
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      stream.write(`${line}\n`);
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        io.log(`${line}\n`);
        continue;
      }
      if (event.type === 'result') result = event;
      else io.log(describe(event));
    }
  };

  const compares = compare.mode !== 'none';
  const timeoutMs = compares ? COMPARE_TIMEOUT_MS : TIMEOUT_MS;
  let timedOut = false;
  const timer = setTimeout(() => {
    io.log(
      `\n[dashboard] The prompt took longer than ${timeoutMs / 60000} minutes. Stopping it.\n`,
    );
    timedOut = true;
    io.kill();
  }, timeoutMs);
  const args = claudeArgs(
    wrapPrompt(check, env, compare, resolve(shotsDir), {
      from: baseline?.from,
      files: baselineFiles,
    }),
    SCHEMA,
    {
      tools: baselineFiles.length ? [...BROWSER_TOOLS, 'Read'] : BROWSER_TOOLS,
      deny: baselineFiles.length ? SECRET_FILES : [],
      maxTurns: compares ? COMPARE_MAX_TURNS : MAX_TURNS,
      model: MODEL,
      stream: true,
      mcpConfig,
    },
  );
  const spawnedAt = Date.now();
  const { code } = await io
    .spawn(CLAUDE, args, { env: serverEnv, onStdout })
    .finally(() => clearTimeout(timer));
  const durationMs = Date.now() - spawnedAt;
  if (buffer.trim()) onStdout('\n');
  await new Promise((done) => stream.end(done));

  const out = {
    compare: compareInfo,
    turns: result?.num_turns ?? null,
    costUsd: result?.total_cost_usd ?? null,
    // Tokens and model even when Claude stopped without a verdict: a
    // timed-out or stopped check still cost something.
    ...(result ? usageOf(result, MODEL ?? null) : { model: null }),
    durationMs,
    screenshots: (await listImages(shotsDir)).map((f) =>
      rel(join(shotsDir, f)),
    ),
    baselineScreenshots: baselineFiles.map(rel),
  };
  const verdict = answerOf(result);
  if (verdict?.verdict)
    return {
      ...out,
      verdict: verdict.verdict,
      summary: verdict.summary,
      findings: verdict.findings ?? [],
      status:
        verdict.verdict === 'pass'
          ? 'passed'
          : verdict.verdict === 'fail'
            ? 'failed'
            : 'unsure',
    };
  return {
    ...out,
    status: io.isStopped() ? 'stopped' : 'error',
    error: timedOut
      ? 'Timed out before giving a verdict.'
      : (stoppedReason(result) ??
        (code === null
          ? NOT_STARTED
          : `Claude finished without a verdict (exit code ${code}).`)),
  };
}
