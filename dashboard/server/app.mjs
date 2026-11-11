// The dashboard's Hono app: every route, the checks that guard them, and
// how errors are answered. index.mjs starts it.
//
//   /api/environments   routes/environments.mjs
//   /api/roles          routes/logins.mjs
//   /api/sessions/...   routes/logins.mjs
//   /api/plans/...      routes/plans.mjs
//   /api/suites/...     routes/suites.mjs
//   /api/runs/...       routes/runs.mjs
//   /runs/:id/...       routes/files.mjs (a run's files, e.g. its report)
//   anything else       routes/files.mjs (the app)
//
// Each route file lists its routes, with what they take and answer.
//
// To add an API route: add it to the route file for its area (or a new
// file mounted below), check a JSON body with jsonBody() from
// routes/shared.mjs, and throw an ApiError (errors.mjs) for an error answer.

import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { HTTPException } from 'hono/http-exception';
import { ApiError } from './errors.mjs';
import { environmentRoutes } from './routes/environments.mjs';
import { appRoutes, runFileRoutes } from './routes/files.mjs';
import { roleRoutes, sessionRoutes } from './routes/logins.mjs';
import { planRoutes } from './routes/plans.mjs';
import { runRoutes } from './routes/runs.mjs';
import { suiteRoutes } from './routes/suites.mjs';

const forbidden = (c) => c.json({ error: 'Forbidden' }, 403);

// No DNS-rebound hostname: Host must be localhost. Checked for every
// request, not only the API, since run files hold traces of logged-in
// sessions.
async function localhostOnly(c, next) {
  const host = (c.req.header('host') ?? '').replace(/:\d+$/, '');
  if (host !== 'localhost' && host !== '127.0.0.1') return forbidden(c);
  await next();
}

// The API starts test runs, so only this page may change anything: no other
// website open in the same browser (no CORS headers, a JSON body forces a
// preflight, and the Origin must be us; "null" from a sandboxed frame or a
// file:// page isn't).
async function sameOriginWrites(c, next) {
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
    const origin = c.req.header('origin');
    if (origin && origin !== `http://${c.req.header('host')}`)
      return forbidden(c);
    if (!(c.req.header('content-type') ?? '').startsWith('application/json'))
      return forbidden(c);
  }
  await next();
}

// API answers are always fresh: runs change while the page watches them.
async function noStore(c, next) {
  await next();
  c.res.headers.set('cache-control', 'no-store');
}

const api = new Hono()
  .use(sameOriginWrites)
  .use(noStore)
  .use(
    bodyLimit({
      maxSize: 100_000,
      onError: (c) => c.json({ error: 'Request too large.' }, 413),
    }),
  )
  .route('/environments', environmentRoutes)
  .route('/roles', roleRoutes)
  .route('/sessions', sessionRoutes)
  .route('/plans', planRoutes)
  .route('/suites', suiteRoutes)
  .route('/runs', runRoutes)
  .all('*', (c) => c.json({ error: 'Not found' }, 404));

/** The whole app. `vite` is Vite's dev server in --dev mode, else null. */
export function createApp({ vite }) {
  const app = new Hono()
    .use(localhostOnly)
    .route('/api', api)
    .route('/runs', runFileRoutes)
    .route('/', appRoutes(vite));

  // An ApiError is an answer meant for the page: its status, message and any
  // details. Anything else is a bug, logged here; the page gets its first
  // line. Nothing a request does may take the dashboard down.
  app.onError((err, c) => {
    if (err instanceof ApiError)
      return c.json({ ...err.details, error: err.message }, err.status);
    if (err instanceof HTTPException)
      return c.json({ error: err.message }, err.status);
    console.error(err);
    return c.json({ error: err.message.split('\n')[0] }, 500);
  });
  return app;
}
