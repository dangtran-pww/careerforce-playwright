// Reading runs back: one run with its output, and the run history. The run
// in progress comes from lifecycle.mjs, finished ones from their run.json.

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { RUNS_DIR } from '../paths.mjs';
import { activeRun } from './lifecycle.mjs';

// run.json of runs that are over, by id. A finished run's run.json never
// changes again (only the run in progress is written to, and that one is
// read from lifecycle.mjs), so it is read from disk once.
const metaCache = new Map();

/** The run's run.json (or the run in progress), without its output. */
export async function readMeta(id) {
  if (!/^[\w-]+$/.test(id)) return null;
  const running = activeRun(id);
  if (running) return running.meta;
  const cached = metaCache.get(id);
  if (cached) return cached;
  try {
    const meta = JSON.parse(
      await readFile(join(RUNS_DIR, id, 'run.json'), 'utf8'),
    );
    // Left "running" by a dashboard that was closed mid-run.
    if (meta.status === 'running') meta.status = 'interrupted';
    for (const step of meta.steps ?? [])
      if (step.status === 'running') step.status = 'interrupted';
    meta.kind ??= 'plan';
    // Unless it started while being read (beginRun saves run.json first).
    if (!activeRun(id)) metaCache.set(id, meta);
    return meta;
  } catch {
    return null;
  }
}

/**
 * The run, with its output from character `logFrom` on, so the page can
 * fetch only what's new while it runs.
 */
export async function getRun(id, { logFrom = 0 } = {}) {
  const meta = await readMeta(id);
  if (!meta) return null;
  const log =
    activeRun(id)?.log ??
    (await readFile(join(RUNS_DIR, id, 'output.log'), 'utf8').catch(() => ''));
  return { ...meta, logLength: log.length, log: log.slice(logFrom) };
}

/**
 * Newest first, without per-test results or output. `plan` / `suite` /
 * `env` narrow it down; `a11y` keeps the runs that scanned for
 * accessibility.
 */
export async function listRuns({ plan, suite, env, a11y, limit = 50 } = {}) {
  const names = (await readdir(RUNS_DIR).catch(() => [])).sort().reverse();
  const runs = [];
  // A batch of run.json files is read at once, newest first, until there
  // are `limit` matches.
  const BATCH = 32;
  for (let i = 0; i < names.length && runs.length < limit; i += BATCH) {
    const metas = await Promise.all(
      names.slice(i, i + BATCH).map((name) => readMeta(name)),
    );
    for (const meta of metas) {
      if (runs.length >= limit) break;
      if (!meta) continue;
      if (plan && meta.plan !== plan) continue;
      if (suite && meta.suite !== suite) continue;
      if (env && (meta.env?.id ?? 'qa') !== env) continue;
      if (a11y && !meta.a11yScan) continue;
      runs.push({
        ...meta,
        results: undefined,
        // Just how many pages and broken rules, for tables.
        a11y: meta.a11y
          ? {
              scanned: meta.a11y.scanned,
              pages: meta.a11y.pages.length,
              violations: meta.a11y.pages.reduce(
                (n, p) => n + p.violations.length,
                0,
              ),
            }
          : null,
        steps: meta.steps?.map((s) => ({
          id: s.id,
          kind: s.kind,
          title: s.title,
          status: s.status,
        })),
      });
    }
  }
  return runs;
}
