// /api/a11y: accessibility scans along a journey. A plan or suite run scans
// with "a11y: true" in its run request (routes/plans.mjs, routes/suites.mjs);
// these routes list such runs and start a Claude journey
// (runs/a11y-run.mjs).

import { Hono } from 'hono';
import { z } from 'zod';
import { envParam } from '../environments.mjs';
import { listRuns } from '../runs/history.mjs';
import { activeRunId } from '../runs/lifecycle.mjs';
import { A11Y_DEVICES, startA11yJourney } from '../runs/a11y-run.mjs';
import { checkSessionOnce } from '../sessions.mjs';
import { ROLE, envField, jsonBody } from './shared.mjs';

export const a11yRoutes = new Hono();

// GET /api/a11y/runs?env=<id> — recent runs on that environment that
// scanned for accessibility: Claude journeys, and plan and suite runs with
// the scan on.
a11yRoutes.get('/runs', async (c) => {
  const env = envParam(c.req.query('env'));
  return c.json({
    activeRun: activeRunId(),
    runs: await listRuns({ env: env.id, a11y: true, limit: 20 }),
  });
});

// POST /api/a11y/journeys — Claude follows a journey and the browser scans
// each page it reaches: { env, journey, role?, device }. `journey` is plain
// words; `role` a saved login (none: a visitor). Its login is checked first
// (409 with { logins } when it isn't ready). Answers with the new run.
a11yRoutes.post(
  '/journeys',
  jsonBody(
    z.object({
      env: envField,
      journey: z.string().trim().min(10).max(4000),
      role: z
        .string()
        .regex(new RegExp(`^${ROLE}$`))
        .optional(),
      device: z.enum(Object.keys(A11Y_DEVICES)),
    }),
  ),
  async (c) => {
    const body = c.req.valid('json');
    const run = await startA11yJourney({
      env: envParam(body.env),
      journey: body.journey,
      role: body.role || undefined,
      device: body.device,
      checkLogin: checkSessionOnce,
    });
    return c.json(run, 201);
  },
);
