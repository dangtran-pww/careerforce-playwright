// /api/suites: the suites in test-suites/ (plans plus Claude prompts). Their
// plans run through /api/plans; runs of a whole suite from before are still
// listed on a suite's page.

import { Hono } from 'hono';
import { loadSuite, loadSuites } from '../catalog/suites.mjs';
import { envParam, publicEnv } from '../environments.mjs';
import { ApiError } from '../errors.mjs';
import { listRuns } from '../runs/history.mjs';
import { activeRunId } from '../runs/lifecycle.mjs';
import { SLUG } from './shared.mjs';

export const suiteRoutes = new Hono();

async function suiteOf(c) {
  const suite = await loadSuite(c.req.param('slug'));
  if (!suite) throw new ApiError(404, 'No such suite.');
  return suite;
}

const SUITE = `/:slug{${SLUG}}`;

// GET /api/suites?env=<id> — every suite, with the latest results of its
// plans there: each plan's latest full run (all its cases; a run of a few
// cases is a spot check), plus any run of its plans going on now.
suiteRoutes.get('/', async (c) => {
  const env = envParam(c.req.query('env'));
  const suites = await loadSuites({
    refresh: c.req.query('refresh') !== undefined,
  });
  // Plan runs; old ones have no kind.
  const runs = (await listRuns({ env: env.id, limit: 500 })).filter(
    (r) => r.plan && (r.kind ?? 'plan') === 'plan',
  );
  return c.json({
    env: publicEnv(env),
    activeRun: activeRunId(env.id),
    suites: suites.map((s) => {
      const slugs = new Set(s.plans.map((p) => p.slug));
      const own = runs.filter((r) => slugs.has(r.plan));
      // Newest first, so the first full run of each plan is its latest.
      const latest = new Map();
      for (const r of own)
        if (r.status !== 'running' && !r.cases?.length && !latest.has(r.plan))
          latest.set(r.plan, r);
      return {
        ...s,
        planRuns: [...latest.values()],
        runningRun: own.find((r) => r.status === 'running')?.id ?? null,
      };
    }),
  });
});

// GET /api/suites/:slug?env=<id> — one suite, its steps and recent runs
// (its own runs and the plan runs started from its page), and the run in
// progress on that environment.
suiteRoutes.get(SUITE, async (c) => {
  const env = envParam(c.req.query('env'));
  const suite = await suiteOf(c);
  return c.json({
    activeRun: activeRunId(env.id),
    suite,
    runs: await listRuns({ suite: suite.slug, limit: 10 }),
  });
});
