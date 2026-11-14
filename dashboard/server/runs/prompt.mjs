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
//   site      the same pages on other environments, one tab each, e.g.
//             QA against Stage and Production;
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
import { journeyFromFile, journeyStatus } from './a11y-journey.mjs';
import {
  CLAUDE,
  NOT_STARTED,
  answerOf,
  claudeArgs,
  stoppedReason,
  usageOf,
} from '../claude/run.mjs';

// A check that takes longer than this is stopped and marked as an error.
// Comparing takes longer: two sites, every viewport. Each further site adds
// half as much again (siteFactor).
const TIMEOUT_MS = Number(process.env.PROMPT_TIMEOUT_MS ?? 6 * 60_000);
const COMPARE_TIMEOUT_MS = Number(
  process.env.PROMPT_COMPARE_TIMEOUT_MS ?? 15 * 60_000,
);
const MAX_TURNS = process.env.PROMPT_MAX_TURNS ?? '40';
const COMPARE_MAX_TURNS = process.env.PROMPT_COMPARE_MAX_TURNS ?? '100';
// Opus unless PROMPT_MODEL (e.g. sonnet, haiku) picks another.
const MODEL = process.env.PROMPT_MODEL || 'opus';

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
          severity: {
            type: 'string',
            enum: ['problem', 'warning', 'note'],
            description:
              'problem: makes the check fail. warning: worth a look but does not fail it. note: for information.',
          },
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

// How much more a comparison takes than one with a single other site: 1 for
// one, 1.5 for two (three sites open instead of two), and so on. Scales the
// screenshot limit, the time limit and the turn limit.
const siteFactor = (compare) =>
  compare.mode === 'site' ? (compare.envs.length + 1) / 2 : 1;

/** The most screenshots Claude may take in this run of `check`. */
const screenshotLimit = (check, compare) =>
  Math.ceil(check.screenshots * siteFactor(compare));

// "Stage", "Stage and Production", "QA, Stage and Production".
const andList = (words, and = 'and') =>
  words.length < 2
    ? words.join('')
    : `${words.slice(0, -1).join(', ')} ${and} ${words.at(-1)}`;

const viewportList = (viewports) =>
  viewports.map((v) => `${v.name} (${v.width}x${v.height})`).join(', ');

function compareRules(check, env, compare, baseline) {
  const baselineFiles = baseline?.files ?? [];
  const views = viewportList(check.viewports);
  if (compare.mode === 'site') {
    const others = compare.envs;
    const one = others.length === 1;
    const ids = [env.id, ...others.map((o) => o.id)];
    return `
This is a side-by-side comparison. The site under test is ${env.baseURL} (${env.name}). ${
      one
        ? `The site to compare with is ${others[0].baseURL} (${others[0].name}); open it in a second tab with browser_tabs and visit the same paths there.`
        : `The sites to compare with are ${andList(others.map((o) => `${o.baseURL} (${o.name})`))}; open each in a tab of its own with browser_tabs and visit the same paths there. Compare ${env.name} with each of them.`
    }
- Do it at each of these viewports, one at a time, setting the size with browser_resize: ${views}.
- At each viewport, look at each page top to bottom on every site, and take matching screenshots named "<two-digit number>-<page>-<viewport>-<site>.png", where <site> is ${andList(ids, 'or')}, e.g. ${ids.map((id, i) => `"0${i + 1}-home-desktop-${id}.png"`).join(', ')}.
- The sites have different content: different jobs, events, dates, blog posts, counts and images are expected and are not differences. Compare layout and styling only: missing, extra or reordered blocks; spacing and alignment; fonts, sizes and colours; buttons and links that look different; images that are broken, stretched or cropped differently; text cut off or overlapping; sideways scrolling; the header and menu at each viewport.
- Verdict "fail" when ${env.name} has a layout or styling difference ${one ? '' : 'from any of them '}that looks unintended or broken (a "problem" finding). "pass" when there is none. A layout or styling difference that looks deliberate, or a block that is missing or different only because of content (an event list, a CMS box), is a "warning"; list what you compared and found the same as "note" findings.${
      one
        ? ''
        : ` When ${env.name} matches one site but not another (say, a change not yet on ${others.at(-1).name}), say so in the finding, and make it a "warning".`
    } Say in each finding which sites and viewport it is on, and fill in its viewport.`;
  }
  if (compare.mode === 'baseline' && baselineFiles.length)
    return `
This compares ${env.name} with how the same pages looked in an earlier run of this check on ${env.name} (the baseline, from ${baseline?.from}). Its screenshots are these files; view them with Read (read no other files):
${baselineFiles.map((f) => `  - ${f}`).join('\n')}
- Look at the same pages at the same viewports (${views}, set with browser_resize), and take screenshots named "<two-digit number>-<page>-<viewport>.png".
- Content changes (different jobs, events, dates, posts, counts, images) are expected. Compare layout and styling only: missing, extra or reordered blocks; spacing and alignment; fonts, sizes and colours; broken or differently cropped images; text cut off or overlapping; sideways scrolling; the header and menu.
- Verdict "fail" when the layout or styling changed in a way that looks unintended or broken (a "problem" finding). A change that looks deliberate, or a block that is missing or different only because of content, is a "warning"; other notable content changes are "note" findings.`;
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
- Take a screenshot of what you check with browser_take_screenshot (scale "css"), saving it in "${shotsDir}/". Take at least 1 and at most ${screenshotLimit(check, compare)}.
- Judge only what the check asks. Verdict "fail" when something it asks about is missing, broken or shows an error; "unsure" when you couldn't tell (the page didn't load, you were blocked). Name the screenshot that shows each finding.
- Give each finding a severity:
  - "problem": what makes the verdict "fail". A "fail" has at least one problem, and a "pass" has none.
  - "warning": something someone should look at that doesn't fail the check, e.g. a difference that looks deliberate, or a block that is missing or different because of the site's content.
  - "note": for information only, e.g. what you checked and found as expected.
${compareRules(check, env, compare, baseline)}${check.a11y ? a11yRules(check) : ''}

The check:
${check.prompt}`;
}

// For an accessibility journey (a prompt file with "Accessibility scan:
// yes", or one started from the dashboard's Accessibility Scan page).
const a11yRules = (check) => `

This is an accessibility check that follows a journey. Before anything else, set the browser size with browser_resize to ${viewportList(check.viewports.slice(0, 1))}${check.viewports.length > 1 ? `; then follow the journey again at ${viewportList(check.viewports.slice(1))}` : ''}: the scan checks the page at the size it is shown. While you follow it, the browser scans every page and dialog you reach with axe on its own: you don't run that scan, and its results are added to this check's result. After each page loads or a dialog opens, wait 2 seconds (browser_wait_for) before you act, so the scan can finish. Your part is what a script can't judge:
- On each page of the journey, use the keyboard: press Tab (browser_press_key) through the main controls, and Enter or Space on the ones the journey uses. Take a screenshot when something is wrong.
- A "problem": keyboard focus you can't see; a control the journey needs that you can't reach or use with the keyboard; focus that is lost, or goes behind a dialog, when the dialog opens, or that doesn't come back when it closes; focus stuck in a place you can't leave; a link or button whose name doesn't say what it does; a form field with no label you can read; an error message that doesn't say what to fix.
- A "warning": a Tab order that jumps around the page in a confusing way; an icon-only control whose purpose isn't clear.
- Verdict "fail" when there is any problem. Fill in fields as the journey asks, but submit nothing it doesn't ask you to.`;

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
  a11y = null,
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
          sites: compare.envs.map((o) => ({
            envId: o.id,
            envName: o.name,
            baseURL: o.baseURL,
          })),
        }
      : {}),
    ...(compare.mode === 'baseline'
      ? { baselineFrom: baselineFiles.length ? baseline.from : null }
      : {}),
  };

  const mcpConfig = join(dir, 'mcp.json');
  // Accessibility scans along the way: for an accessibility journey, or
  // any prompt in a run with "Scan pages for accessibility" on (`a11y`:
  // { seenDir }, the run's record of the states already scanned).
  const scanning = Boolean(check.a11y || a11y);
  const journeyFile = resolve(join(dir, 'a11y-journey.jsonl'));
  const serverEnv = {
    BASE_URL: env.baseURL,
    SEED_STORAGE_STATE: check.role ? resolve(authFile(check.role, env)) : '',
    ...(scanning
      ? {
          A11Y_JOURNEY: '1',
          A11Y_JOURNEY_FILE: journeyFile,
          A11Y_JOURNEY_SEEN_DIR: resolve(
            a11y?.seenDir ?? join(dir, 'a11y-seen'),
          ),
        }
      : {}),
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
  const timeoutMs = compares
    ? Math.round(COMPARE_TIMEOUT_MS * siteFactor(compare))
    : TIMEOUT_MS;
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
      maxTurns: compares
        ? String(Math.ceil(Number(COMPARE_MAX_TURNS) * siteFactor(compare)))
        : MAX_TURNS,
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
    ...(result ? usageOf(result, MODEL) : { model: null }),
    durationMs,
    screenshots: (await listImages(shotsDir)).map((f) =>
      rel(join(shotsDir, f)),
    ),
    baselineScreenshots: baselineFiles.map(rel),
    ...(scanning ? { a11y: await journeyFromFile(journeyFile) } : {}),
  };
  const verdict = answerOf(result);
  if (verdict?.verdict) {
    const status =
      verdict.verdict === 'pass'
        ? 'passed'
        : verdict.verdict === 'fail'
          ? 'failed'
          : 'unsure';
    return {
      ...out,
      verdict: verdict.verdict,
      summary: verdict.summary,
      findings: verdict.findings ?? [],
      // A broken accessibility rule fails the check, whatever Claude said.
      status: journeyStatus(out.a11y) === 'failed' ? 'failed' : status,
    };
  }
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
