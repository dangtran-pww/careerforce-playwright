// /api/suites: the suites in test-suites/ (plans plus Claude prompts), and
// running them.

import { Hono } from 'hono';
import { z } from 'zod';
import { loadSuite, loadSuites } from '../catalog/suites.mjs';
import { compareParam, envParam, publicEnv } from '../environments.mjs';
import { ApiError } from '../errors.mjs';
import { listRuns } from '../runs/history.mjs';
import { activeRunId } from '../runs/lifecycle.mjs';
import { startSuiteRun } from '../runs/suite-run.mjs';
import { checkSessionOnce } from '../sessions.mjs';
import {
  SLUG,
  compareField,
  envField,
  flag,
  jsonBody,
  strings,
} from './shared.mjs';

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
      lastRun:
        runs.find((r) => r.kind === 'suite' && r.suite === s.slug) ?? null,
    })),
  });
});

// GET /api/suites/:slug — one suite, its steps and recent runs (its own
// runs and the plan runs started from its page).
suiteRoutes.get(SUITE, async (c) => {
  const suite = await suiteOf(c);
  return c.json({
    activeRun: activeRunId(),
    suite,
    runs: await listRuns({ suite: suite.slug, limit: 10 }),
  });
});

// POST /api/suites/:slug/run — run it, or the plans and prompts picked.
// `a11y: true` scans every page it reaches for accessibility.
suiteRoutes.post(
  `${SUITE}/run`,
  jsonBody(
    z.object({
      env: envField,
      plans: strings.optional(),
      headed: flag,
      // Scan every page the run reaches for accessibility.
      a11y: flag,
      compare: compareField,
    }),
  ),
  async (c) => {
    const suite = await suiteOf(c);
    const body = c.req.valid('json');
    const run = await startSuiteRun(suite, {
      env: envParam(body.env),
      plans: body.plans,
      headed: body.headed === true,
      compare: compareParam(body.compare),
      checkLogin: checkSessionOnce,
      a11y: body.a11y === true,
    });
    return c.json(run, 201);
  },
);
