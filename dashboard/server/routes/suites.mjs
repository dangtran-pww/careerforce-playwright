// /api/suites: the suites in test-suites/ (plans plus Claude prompts), and
// running them.

import { Hono } from 'hono';
import { z } from 'zod';
import { loadSuite, loadSuites } from '../catalog/suites.mjs';
import { envParam, publicEnv } from '../environments.mjs';
import { ApiError } from '../errors.mjs';
import { listRuns } from '../runs/history.mjs';
import { activeRunId } from '../runs/lifecycle.mjs';
import { startSuiteRun } from '../runs/suite-run.mjs';
import { checkSessionOnce } from '../sessions.mjs';
import { SLUG, envField, flag, jsonBody, strings } from './shared.mjs';

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
    activeRun: activeRunId(),
    suites: suites.map((s) => ({
      ...s,
      lastRun: runs.find((r) => r.suite === s.slug) ?? null,
    })),
  });
});

// GET /api/suites/:slug — one suite, its steps and recent runs.
suiteRoutes.get(SUITE, async (c) => {
  const suite = await suiteOf(c);
  return c.json({
    activeRun: activeRunId(),
    suite,
    runs: await listRuns({ suite: suite.slug, limit: 10 }),
  });
});

// POST /api/suites/:slug/run — run it, or the plans and prompts picked.
suiteRoutes.post(
  `${SUITE}/run`,
  jsonBody(
    z.object({
      env: envField,
      plans: strings.optional(),
      prompts: strings.optional(),
      headed: flag,
    }),
  ),
  async (c) => {
    const suite = await suiteOf(c);
    const body = c.req.valid('json');
    const run = await startSuiteRun(suite, {
      env: envParam(body.env),
      plans: body.plans,
      prompts: body.prompts,
      headed: body.headed === true,
      checkLogin: checkSessionOnce,
    });
    return c.json(run, 201);
  },
);
