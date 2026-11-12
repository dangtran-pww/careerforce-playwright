// /api/runs: run history, one run's progress, stopping it, and asking
// Claude Code why a test failed or to summarize a run's failures.

import { Hono } from 'hono';
import { z } from 'zod';
import {
  explainFailure,
  savedFailureExplanations,
  testRef,
} from '../claude/failure.mjs';
import { savedRunSummary, summarizeRun } from '../claude/summary.mjs';
import { ApiError } from '../errors.mjs';
import { getRun, listRuns } from '../runs/history.mjs';
import { activeRunId, stopRun } from '../runs/lifecycle.mjs';
import { SLUG, flag, jsonBody } from './shared.mjs';

export const runRoutes = new Hono();

const RUN = `/:id{${SLUG}}`;

// GET /api/runs — run history, newest first.
runRoutes.get('/', async (c) =>
  c.json({ activeRun: activeRunId(), runs: await listRuns() }),
);

// GET /api/runs/:id?logFrom=N — one run, and its output from character N.
runRoutes.get(RUN, async (c) => {
  const run = await getRun(c.req.param('id'), {
    logFrom: Number(c.req.query('logFrom')) || 0,
  });
  if (!run) throw new ApiError(404, 'No such run.');
  return c.json(run);
});

// GET /api/runs/:id/explanations — the saved explanations of that run's
// failed tests.
runRoutes.get(`${RUN}/explanations`, async (c) =>
  c.json({
    explanations: await savedFailureExplanations(c.req.param('id')),
  }),
);

// POST /api/runs/:id/explanations — ask Claude Code why a test failed:
// { step?, project, file, line, title, refresh? }. Saved in the run's
// folder (about a minute). testRef checks which test it names.
runRoutes.post(
  `${RUN}/explanations`,
  jsonBody(z.looseObject({ refresh: flag })),
  async (c) => {
    const body = c.req.valid('json');
    return c.json({
      explanation: await explainFailure(c.req.param('id'), testRef(body), {
        refresh: body.refresh === true,
      }),
    });
  },
);

// GET /api/runs/:id/summary — the saved summary of a run's failures,
// or null.
runRoutes.get(`${RUN}/summary`, async (c) =>
  c.json({ summary: await savedRunSummary(c.req.param('id')) }),
);

// POST /api/runs/:id/summary — ask Claude Code to group a run's failures
// (a suite run's plan steps together) into the issues behind them: { refresh? }. Errors only, no
// files read, so it takes seconds. Saved in the run's folder.
runRoutes.post(
  `${RUN}/summary`,
  jsonBody(z.looseObject({ refresh: flag })),
  async (c) =>
    c.json({
      summary: await summarizeRun(c.req.param('id'), {
        refresh: c.req.valid('json').refresh === true,
      }),
    }),
);

// POST /api/runs/:id/stop — stop a run in progress.
runRoutes.post(`${RUN}/stop`, (c) => {
  if (!stopRun(c.req.param('id')))
    throw new ApiError(409, 'That run is not in progress.');
  return c.json({ stopping: true });
});
