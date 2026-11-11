// The routes outside /api: each run's files, and the dashboard app itself.

import { extname, join, normalize, sep } from 'node:path';
import { RESPONSE_ALREADY_SENT } from '@hono/node-server/utils/response';
import { Hono } from 'hono';
import { fileResponse } from '../lib/serve-file.mjs';
import { APP_DIST_DIR, RUNS_DIR, fromRoot } from '../paths.mjs';
import { SLUG } from './shared.mjs';

// Absolute, since they're resolved when this module loads.
const runFilesDir = fromRoot(RUNS_DIR);
const staticDir = fromRoot(APP_DIST_DIR);

const notFound = (c) => c.text('Not found', 404);

export const runFileRoutes = new Hono();

// GET /runs/:id/<path> — a file from that run's folder; /runs/:id/report/
// is its Playwright HTML report. The path is read from the raw URL and
// decoded here, and must stay inside the run's folder.
runFileRoutes.get(`/:id{${SLUG}}/*`, async (c) => {
  const id = c.req.param('id');
  const raw = new URL(c.req.url).pathname.slice(`/runs/${id}/`.length);
  let rest;
  try {
    rest = decodeURIComponent(raw);
  } catch {
    return c.text('Bad path', 400);
  }
  const file = normalize(join(runFilesDir, id, rest));
  if (!file.startsWith(runFilesDir + sep)) return notFound(c);
  try {
    return await fileResponse(c, file);
  } catch {
    // A folder: its index.html.
    return fileResponse(c, join(file, 'index.html')).catch(() => notFound(c));
  }
});

/**
 * The dashboard app. In dev mode Vite serves it from dashboard/src, writing
 * the answer to Node's response itself. Otherwise it's the build in
 * dashboard/dist, where any path that isn't a file gets index.html, so a
 * reload on any page still opens the app.
 */
export function appRoutes(vite) {
  const routes = new Hono();
  if (vite) {
    routes.all('*', (c) => {
      vite.middlewares(c.env.incoming, c.env.outgoing);
      return RESPONSE_ALREADY_SENT;
    });
    return routes;
  }
  routes.get('*', async (c) => {
    const { pathname } = new URL(c.req.url);
    const file = normalize(
      join(staticDir, pathname === '/' ? 'index.html' : pathname),
    );
    const target =
      file.startsWith(staticDir + sep) && extname(file)
        ? file
        : join(staticDir, 'index.html');
    return fileResponse(c, target).catch(() => notFound(c));
  });
  return routes;
}
