// Turns a traced test run into per-step screenshots for a written report
// (the /test-plan-report skill). Playwright's trace already records every
// action and assertion with start/end times, plus a screencast of the page
// on the same clock, so each step's screenshot is the last screencast frame
// painted before that step finished. No spec has to change.
//
// Run the tests with tracing on and the JSON reporter, then this script:
//   BASE_URL=https://qa.careerforce.link npx playwright test tests/smoke/anonymous \
//     --project=smoke-desktop --trace on --output <out>/test-output --reporter=json > <out>/results.json
//   node scripts/trace-steps.mjs <out>/results.json <out>
//
// Writes <out>/steps.json (every test, its status, and its steps) and
// <out>/screenshots/<NN>-<test>/<SS>.jpeg. Screenshots are the browser
// viewport (1280×720 on Desktop Chrome), not the full page. Needs `unzip`.
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const [resultsFile, outDir] = process.argv.slice(2);
if (!resultsFile || !outDir) {
  console.error('Usage: node scripts/trace-steps.mjs <results.json> <out-dir>');
  process.exit(1);
}

// A step's result (a click that opens a panel) is often painted just after
// the step ends, so a step may take a frame up to SETTLE_MS later. Checks
// don't change the page, so frames painted during a following check still
// count; a following action can only change the page after a little while
// (NEXT_ACTION_MS), so frames from its first moments count too.
const SETTLE_MS = 250;
const NEXT_ACTION_MS = 50;
// Top-level trace entries that are a test's own steps. Hooks, fixtures and
// the route handler's "Continue request" calls (from blockTracking) are not.
const STEP_METHODS = new Set(['pw:api', 'expect', 'test.step']);

// eslint-disable-next-line no-control-regex
const stripAnsi = (text) => text?.replace(/\u001b\[[0-9;]*m/g, '');
const slug = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);

function readJsonLines(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

// The spec line a step came from: the outermost stack frame in a .spec.ts
// file (inner frames are page objects).
function specLine(stack) {
  const frame = [...(stack ?? [])]
    .reverse()
    .find((entry) => entry.file.endsWith('.spec.ts'));
  return frame ? `${path.basename(frame.file)}:${frame.line}` : undefined;
}

function readTrace(traceZip) {
  const dir = mkdtempSync(path.join(tmpdir(), 'trace-steps-'));
  try {
    execFileSync('unzip', ['-q', '-o', traceZip, '-d', dir]);
    const events = readJsonLines(path.join(dir, 'test.trace'));
    const ends = new Map(
      events
        .filter((event) => event.type === 'after')
        .map((event) => [event.callId, event]),
    );
    const all = events.filter((event) => event.type === 'before');
    const steps = all
      .filter(
        (event) =>
          !event.parentId &&
          STEP_METHODS.has(event.method) &&
          event.group !== 'route',
      )
      .map((event) => {
        const end = ends.get(event.callId);
        return {
          title: [event.title, event.subtitle].filter(Boolean).join(' '),
          kind:
            event.method === 'expect'
              ? 'check'
              : event.method === 'test.step'
                ? 'step'
                : 'action',
          at: specLine(event.stack),
          startTime: event.startTime,
          endTime: end?.endTime ?? event.startTime,
          error: stripAnsi(end?.error?.message),
          // Inner actions and checks of a test.step block.
          substeps: all
            .filter(
              (child) =>
                child.parentId === event.callId && child.group !== 'route',
            )
            .map((child) =>
              [child.title, child.subtitle].filter(Boolean).join(' '),
            ),
        };
      });

    // Browser-side traces (0-trace.trace, 1-trace.trace, …) hold the frames.
    const frames = readdirSync(dir)
      .filter((name) => /^\d+-trace\.trace$/.test(name))
      .flatMap((name) => readJsonLines(path.join(dir, name)))
      .filter((event) => event.type === 'screencast-frame')
      .sort((a, b) => a.timestamp - b.timestamp);

    steps.forEach((step, index) => {
      const next = steps[index + 1];
      const limit = !next
        ? Infinity
        : next.kind === 'check'
          ? next.endTime
          : next.startTime + NEXT_ACTION_MS;
      const until = Math.min(step.endTime + SETTLE_MS, limit);
      const frame = frames.findLast(
        (candidate) => candidate.timestamp <= until,
      );
      step.frameFile = frame && path.join(dir, frame.file);
    });
    return { dir, steps };
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });
    throw error;
  }
}

function collectTests(suite, parents = []) {
  const titles =
    suite.title && !suite.file?.endsWith(suite.title)
      ? [...parents, suite.title]
      : parents;
  return [
    ...(suite.specs ?? []).flatMap((spec) =>
      spec.tests.map((test) => ({ spec, test, describe: titles })),
    ),
    ...(suite.suites ?? []).flatMap((child) => collectTests(child, titles)),
  ];
}

const report = JSON.parse(readFileSync(resultsFile, 'utf8'));
const tests = report.suites.flatMap((suite) => collectTests(suite));
const output = [];

tests.forEach(({ spec, test, describe }, testIndex) => {
  const result = test.results.at(-1);
  const fullTitle = [...describe, spec.title].join(' › ');
  const entry = {
    id: fullTitle.match(/\b([A-Z]{2,}-\d+):/)?.[1],
    title: fullTitle,
    spec: `${spec.file}:${spec.line}`,
    project: test.projectName,
    status: result?.status ?? 'skipped',
    durationMs: result?.duration ?? 0,
    errors: (result?.errors ?? []).map((error) => stripAnsi(error.message)),
    annotations: [...(test.annotations ?? []), ...(result?.annotations ?? [])],
    steps: [],
  };
  const trace = result?.attachments.find(
    (attachment) => attachment.name === 'trace',
  );
  if (trace?.path && existsSync(trace.path)) {
    const shotDir = `screenshots/${String(testIndex + 1).padStart(2, '0')}-${slug(entry.id ?? spec.title)}`;
    mkdirSync(path.join(outDir, shotDir), { recursive: true });
    const { dir, steps } = readTrace(trace.path);
    let previousFrame;
    let screenshot;
    entry.steps = steps.map((step, stepIndex) => {
      const sameAsPrevious =
        Boolean(step.frameFile) && step.frameFile === previousFrame;
      if (!sameAsPrevious) {
        screenshot = undefined;
        if (step.frameFile && existsSync(step.frameFile)) {
          screenshot = `${shotDir}/${String(stepIndex + 1).padStart(2, '0')}.jpeg`;
          copyFileSync(step.frameFile, path.join(outDir, screenshot));
        }
      }
      previousFrame = step.frameFile;
      return {
        title: step.title,
        kind: step.kind,
        at: step.at,
        durationMs: Math.round(step.endTime - step.startTime),
        status: step.error ? 'failed' : 'passed',
        error: step.error,
        substeps: step.substeps.length ? step.substeps : undefined,
        screenshot,
        // The page did not repaint during this step, so the image is the
        // same as the previous step's.
        sameAsPrevious,
      };
    });
    rmSync(dir, { recursive: true, force: true });
  }
  output.push(entry);
});

mkdirSync(outDir, { recursive: true });
writeFileSync(
  path.join(outDir, 'steps.json'),
  JSON.stringify({ stats: report.stats, tests: output }, null, 2),
);
const shots = output.reduce(
  (sum, test) => sum + test.steps.filter((step) => step.screenshot).length,
  0,
);
console.log(
  `Wrote ${path.join(outDir, 'steps.json')}: ${output.length} tests, ${shots} screenshots.`,
);
