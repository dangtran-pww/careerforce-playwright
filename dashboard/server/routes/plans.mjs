// /api/plans: the test plans in test-plans/, running them, and asking
// Claude Code about their cases.

import { Hono } from 'hono';
import { z } from 'zod';
import { loadPlan, loadPlans } from '../catalog/plans.mjs';
import { explainCase, savedExplanation } from '../claude/explain.mjs';
import { latestReview, reviewCase } from '../claude/review.mjs';
import { envParam, publicEnv } from '../environments.mjs';
import { ApiError } from '../errors.mjs';
import { listRuns } from '../runs/history.mjs';
import { activeRunId } from '../runs/lifecycle.mjs';
import { startRun } from '../runs/plan-run.mjs';
import { openUiMode } from '../ui-mode.mjs';
import { CASE_ID, SLUG, envField, flag, jsonBody, strings } from './shared.mjs';

export const planRoutes = new Hono();

async function planOf(c) {
  const plan = await loadPlan(c.req.param('slug'));
  if (!plan) throw new ApiError(404, 'No such plan.');
  return plan;
}

const PLAN = `/:slug{${SLUG}}`;
const CASE = `${PLAN}/cases/:id{${CASE_ID}}`;

// GET /api/plans — every plan. ?refresh=1 asks Playwright for the test list
// again; ?env=<id> picks the environment whose last run each plan shows.
planRoutes.get('/', async (c) => {
  const env = envParam(c.req.query('env'));
  const { plans, listErrors } = await loadPlans({
    refresh: c.req.query('refresh') !== undefined,
  });
  const runs = await listRuns({ env: env.id, limit: 500 });
  const lastRun = (slug) => runs.find((r) => r.plan === slug) ?? null;
  return c.json({
    env: publicEnv(env),
    site: env.baseURL,
    activeRun: activeRunId(),
    listErrors,
    plans: plans.map((p) => ({ ...p, lastRun: lastRun(p.slug) })),
  });
});

// GET /api/plans/:slug — one plan, its cases, projects and recent runs.
planRoutes.get(PLAN, async (c) => {
  const env = envParam(c.req.query('env'));
  const plan = await planOf(c);
  return c.json({
    env: publicEnv(env),
    site: env.baseURL,
    activeRun: activeRunId(),
    plan,
    runs: await listRuns({ plan: plan.slug, limit: 10 }),
  });
});

// POST /api/plans/:slug/run — run it.
planRoutes.post(
  `${PLAN}/run`,
  jsonBody(
    z.object({
      env: envField,
      projects: strings.optional(),
      cases: strings.optional(),
      headed: flag,
    }),
  ),
  async (c) => {
    const plan = await planOf(c);
    const body = c.req.valid('json');
    const run = await startRun(plan, {
      env: envParam(body.env),
      projects: body.projects,
      cases: body.cases ?? [],
      headed: body.headed === true,
    });
    return c.json(run, 201);
  },
);

// POST /api/plans/:slug/ui — open it in Playwright UI mode, an interactive
// window. Not a run; opening another closes the one before.
planRoutes.post(
  `${PLAN}/ui`,
  jsonBody(
    z.object({
      env: envField,
      projects: strings.optional(),
      cases: strings.optional(),
    }),
  ),
  async (c) => {
    const plan = await planOf(c);
    const body = c.req.valid('json');
    return c.json(
      await openUiMode(plan, {
        env: envParam(body.env),
        projects: body.projects,
        cases: body.cases ?? [],
      }),
    );
  },
);

// GET /api/plans/:slug/cases/:id/explanation — the saved plain-words
// explanation of that case's test code ({ explanation: null } if none).
planRoutes.get(`${CASE}/explanation`, async (c) => {
  const plan = await planOf(c);
  return c.json({
    explanation: await savedExplanation(plan, c.req.param('id')),
  });
});

// POST /api/plans/:slug/cases/:id/explanation — ask Claude Code to explain
// it; waits for the answer (about a minute).
planRoutes.post(
  `${CASE}/explanation`,
  jsonBody(z.object({ refresh: flag })),
  async (c) => {
    const plan = await planOf(c);
    const { refresh } = c.req.valid('json');
    return c.json({
      explanation: await explainCase(plan, c.req.param('id'), {
        refresh: refresh === true,
      }),
    });
  },
);

// GET /api/plans/:slug/cases/:id/review — the latest review of that case,
// kept in memory only ({ review: null } if none), and whether one is
// running ({ reviewing }).
planRoutes.get(`${CASE}/review`, async (c) => {
  const plan = await planOf(c);
  return c.json(await latestReview(plan, c.req.param('id')));
});

// POST /api/plans/:slug/cases/:id/review — ask Claude Code to review that
// case's code against the plan; never written to disk (about a minute).
planRoutes.post(`${CASE}/review`, async (c) => {
  const plan = await planOf(c);
  return c.json({ review: await reviewCase(plan, c.req.param('id')) });
});
