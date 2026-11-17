// /api/suites: the suites in test-suites/ (plans plus Claude prompts). Their
// plans run through /api/plans; runs of a whole suite from before are still
// listed.

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

// GET /api/suites?env=<id> — every suite, with its last run there.
suiteRoutes.get('/', async (c) => {
  const env = envParam(c.req.query('env'));
  const suites = await loadSuites({
    refresh: c.req.query('refresh') !== undefined,
  });
  const runs = await listRuns({ env: env.id, limit: 500 });
  return c.json({
    env: publicEnv(env),
    activeRun: activeRunId(env.id),
    suites: suites.map((s) => ({
      ...s,
      lastRun:
        runs.find((r) => r.kind === 'suite' && r.suite === s.slug) ?? null,
    })),
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
