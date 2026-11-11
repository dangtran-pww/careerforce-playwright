// `npm run dashboard` — a small local web app that shows how the tests are
// doing and runs test plans. Serves the React app in dashboard/ and a JSON
// API it calls. Only listens on 127.0.0.1: the API reads saved login
// sessions and starts test runs.
//
// On start it builds the app with Vite (dashboard/src → dashboard/dist) and
// serves the build. With --dev (`npm run dashboard:dev`) it skips the build
// and runs Vite inside this server instead: pages come straight from
// dashboard/src and reload as you edit.
//
//   GET  /api/environments     the environments to pick from, and the default
//   GET  /api/roles            every role to list in the Logins menu (?env=<id>)
//   GET  /api/sessions/:role   is the saved session for that role still
//                              logged in? (?env=<id>; playwright/.auth/<env>/<role>.json)
//   GET  /api/plans            every plan in test-plans/ (?refresh=1 asks
//                              Playwright for the test list again; ?env=<id>
//                              for the last run on that environment)
//   GET  /api/plans/:slug      one plan, its cases, projects and recent runs
//   POST /api/plans/:slug/run  run it: { env, projects?, cases?, headed? }
//   POST /api/plans/:slug/ui   open it in Playwright UI mode, an interactive
//                              window: { env, projects?, cases? }. Not a run;
//                              opening another closes the one before
//   GET  /api/plans/:slug/cases/:id/explanation
//                              the saved plain-words explanation of that
//                              case's test code ({ explanation: null } if none)
//   POST /api/plans/:slug/cases/:id/explanation
//                              ask Claude Code to explain it ({ refresh? });
//                              waits for the answer (about a minute)
//   GET  /api/plans/:slug/cases/:id/review
//                              the latest review of that case, kept in memory
//                              only ({ review: null } if none), and whether
//                              one is running ({ reviewing })
//   POST /api/plans/:slug/cases/:id/review
//                              ask Claude Code to review that case's code
//                              against the plan; never written to disk
//                              (about a minute)
//   GET  /api/suites           every suite in test-suites/ (?env=<id>)
//   GET  /api/suites/:slug     one suite, its steps and recent runs
//   POST /api/suites/:slug/run run it: { env, plans?, prompts?, headed? }
//   GET  /api/runs             run history, newest first
//   GET  /api/runs/:id         one run (?logFrom=N: output from character N)
//   GET  /api/runs/:id/explanations
//                              the saved explanations of that run's failed
//                              tests
//   POST /api/runs/:id/explanations
//                              ask Claude Code why a test failed:
//                              { step?, project, file, line, title, refresh? };
//                              saved in the run's folder (about a minute)
//   POST /api/runs/:id/stop    stop a run in progress
//   GET  /runs/:id/report/...  that run's Playwright HTML report
//
// See plans.mjs, suites.mjs, runs.mjs and suite-runs.mjs; explain.mjs,
// review.mjs and failure.mjs ask Claude Code.
//
// The session check asks the site, the same way
// useRole in tests/helpers/roles.ts does: request /admin/reports/status with
// the saved cookies and see whether Drupal sends us to /user/login. The
// cookie's expiry date alone isn't enough, because Drupal also ends sessions
// server-side (autologout after inactivity, or a login somewhere else).
//
// Opens the page in a Playwright Chromium window; closing that window stops
// the dashboard. `npm run dashboard -- --no-open` starts only the server, to
// use your own browser instead.
//
// The environment is picked on the page; BASE_URL (from .env) is only the
// default. Env: BASE_URL, BASIC_AUTH_USER/PASSWORD (and _<ENV> overrides),
// SANDBOX_URL, LOCAL_URL, DASHBOARD_PORT (default 4400), HTTPS_PROXY (used if set).

import { createServer } from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { build as viteBuild, createServer as createViteServer } from 'vite';
import {
  authFile as authFileFor,
  defaultEnv,
  environmentById,
  environments,
  hostOf,
  isActive,
  isDrupalSession,
  loginCommand as loginCommandFor,
  siteRequest,
} from '../../scripts/lib/site.mjs';
import { explainCase, savedExplanation } from './explain.mjs';
import {
  explainFailure,
  savedFailureExplanations,
  testRef,
} from './failure.mjs';
import { latestReview, reviewCase } from './review.mjs';
import { loadPlan, loadPlans } from './plans.mjs';
import { loadSuite, loadSuites } from './suites.mjs';
import { startSuiteRun } from './suite-runs.mjs';
import { closeUiMode, openUiMode } from './ui-mode.mjs';
import {
  RunError,
  activeRunId,
  changesData,
  getRun,
  listRuns,
  runsDir,
  startRun,
  stopActiveRun,
  stopRun,
} from './runs.mjs';

const port = Number(process.env.DASHBOARD_PORT ?? 4400);
const dev = process.argv.includes('--dev');
const viteConfig = resolve('dashboard/vite.config.mts');
const staticDir = resolve('dashboard/dist');
const runFilesDir = resolve(runsDir);

async function checkSession(role, env) {
  const baseURL = env.baseURL;
  const siteHost = hostOf(env);
  const authFile = authFileFor(role, env);
  const loginCommand = loginCommandFor(role, env);
  const result = {
    role,
    env: env.id,
    envName: env.name,
    baseURL,
    authFile,
    loginCommand,
    checkedAt: new Date().toISOString(),
    savedAt: null,
  };

  let state;
  try {
    const [text, info] = await Promise.all([
      readFile(authFile, 'utf8'),
      stat(authFile),
    ]);
    state = JSON.parse(text);
    result.savedAt = info.mtime.toISOString();
  } catch (err) {
    if (err.code === 'ENOENT') {
      return {
        ...result,
        status: 'missing',
        message: `No saved ${role} session.`,
      };
    }
    return {
      ...result,
      status: 'error',
      message: `Couldn't read ${authFile}: ${err.message}`,
    };
  }

  const cookie = (state.cookies ?? []).find((c) => isDrupalSession(c, env));
  if (!cookie) {
    return {
      ...result,
      status: 'expired',
      message: `The saved session has no login cookie for ${siteHost}.`,
    };
  }

  const started = Date.now();
  const ctx = await siteRequest(state, env);
  try {
    // Other roles: Drupal sends a logged-in user from /user to their own
    // page, and a logged-out one to /user/login.
    if (role !== 'admin') {
      const res = await ctx.get('/user', { maxRedirects: 0 });
      result.httpStatus = res.status();
      result.durationMs = Date.now() - started;
      const location = res.headers().location ?? '';
      const redirected = res.status() >= 300 && res.status() < 400;
      if (redirected && !location.includes('/user/login'))
        return {
          ...result,
          status: 'valid',
          message: `Logged in as ${role}.`,
          email: await accountEmail(ctx, location),
        };
      if (redirected || res.status() === 200)
        return {
          ...result,
          status: 'expired',
          message:
            'The site sent the saved session to the login page. It has expired or was logged out.',
        };
      return {
        ...result,
        status: 'error',
        message: `Unexpected answer from the site: HTTP ${res.status()}.`,
      };
    }
    const res = await ctx.get('/admin/reports/status', { maxRedirects: 0 });
    result.httpStatus = res.status();
    result.durationMs = Date.now() - started;
    const location = res.headers().location ?? '';

    if (
      res.status() >= 300 &&
      res.status() < 400 &&
      location.includes('/user/login')
    ) {
      return {
        ...result,
        status: 'expired',
        message:
          'The site sent the saved session to the login page. It has expired or was logged out.',
      };
    }
    if (res.status() === 403) {
      return {
        ...result,
        status: 'no-access',
        message: `Logged in, but this account can't open the status report, so it isn't an admin.`,
        email: await accountEmail(ctx),
      };
    }
    if (res.status() === 200 && (await res.text()).includes('Status report')) {
      return {
        ...result,
        status: 'valid',
        message: 'Logged in as an admin.',
        email: await accountEmail(ctx),
      };
    }
    return {
      ...result,
      status: 'error',
      message: `Unexpected answer from the site: HTTP ${res.status()}${location ? ` to ${location}` : ''}.`,
    };
  } catch (err) {
    result.durationMs = Date.now() - started;
    return {
      ...result,
      status: 'error',
      message: `Couldn't reach ${baseURL}: ${err.message.split('\n')[0]}`,
    };
  } finally {
    await ctx.dispose();
  }
}

// The email of the account a logged-in session belongs to, read from the
// Email block of its edit form (<user page>/edit). Users log in with
// their email, and it's also their display name. `userPage` is where /user
// redirected to, when already known. Undefined when it can't be read; that
// never changes the session's status.
async function accountEmail(ctx, userPage) {
  try {
    if (!userPage) {
      const res = await ctx.get('/user', { maxRedirects: 0 });
      userPage = res.headers().location;
      if (!userPage || userPage.includes('/user/login')) return undefined;
    }
    const path = new URL(userPage, 'http://site').pathname.replace(/\/$/, '');
    const res = await ctx.get(`${path}/edit`, { maxRedirects: 0 });
    if (res.status() !== 200) return undefined;
    const html = await res.text();
    // CareerForce shows the email as text with a "change email" link
    // (fam-operation-link--edit-email) instead of the core input.
    const shown = html.match(
      /fam-operation-link--edit-email[\s\S]*?<label[^>]*>[\s\S]*?<\/label>\s*<div>\s*([^<\s][^<]*?)\s*<\/div>/,
    )?.[1];
    const input = html.match(/<input\b[^>]*\bname="mail"[^>]*>/);
    const value = shown ?? input?.[0].match(/\bvalue="([^"]*)"/)?.[1];
    return value ? decodeHtml(value) : undefined;
  } catch {
    return undefined;
  }
}

// Enough HTML entity decoding for an attribute value that holds an email.
function decodeHtml(text) {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

// One check per role and environment at a time: a second request while one
// is running shares its answer instead of hitting the site again.
const inFlight = new Map();
function checkSessionOnce(role, env) {
  const key = `${env.id}:${role}`;
  if (!inFlight.has(key)) {
    inFlight.set(
      key,
      checkSession(role, env).finally(() => inFlight.delete(key)),
    );
  }
  return inFlight.get(key);
}

// Every role the header's Logins menu lists for an environment: admin, the
// roles any plan or suite prompt logs in as, and any role with a saved
// session there (playwright/.auth/<env>/<role>.json). Admin first, then A–Z.
async function knownRoles(env) {
  const roles = new Set(['admin']);
  const [{ plans }, suites, saved] = await Promise.all([
    loadPlans(),
    loadSuites(),
    readdir(dirname(authFileFor('admin', env))).catch(() => []),
  ]);
  for (const p of plans) for (const r of p.roles) roles.add(r);
  for (const s of suites) for (const r of s.roles) roles.add(r);
  for (const name of saved) {
    const m = name.match(/^([a-z-]+)\.json$/);
    if (m) roles.add(m[1]);
  }
  const rest = [...roles].filter((r) => r !== 'admin').sort();
  return ['admin', ...rest];
}

// The environment a request names (?env= or body.env), else the default.
function envParam(id) {
  if (!id) return defaultEnv;
  const env = environmentById(id);
  if (!env) throw new RunError(400, `Unknown environment "${id}".`);
  return env;
}

const publicEnv = (env) => ({
  id: env.id,
  name: env.name,
  baseURL: env.baseURL,
  production: env.production,
});

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/vnd.microsoft.icon',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.log': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webm': 'video/webm',
  '.zip': 'application/zip',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function sendJson(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 100_000) throw new RunError(413, 'Request too large.');
  }
  try {
    return body ? JSON.parse(body) : {};
  } catch {
    throw new RunError(400, 'The request body is not valid JSON.');
  }
}

// The API starts test runs, so only this page may call it: no other website
// open in the same browser (no CORS headers, a JSON body forces a preflight,
// and the Origin must be us), and no DNS-rebound hostname (Host must be
// localhost).
function allowed(req) {
  const host = (req.headers.host ?? '').replace(/:\d+$/, '');
  if (!['localhost', '127.0.0.1'].includes(host)) return false;
  if (req.method === 'GET') return true;
  const origin = req.headers.origin;
  if (origin && new URL(origin).host !== req.headers.host) return false;
  return (req.headers['content-type'] ?? '').startsWith('application/json');
}

const planSummary = (plan) => ({ ...plan, changesData: changesData(plan) });

async function api(req, res, pathname, searchParams) {
  if (!allowed(req)) return sendJson(res, 403, { error: 'Forbidden' });
  let m;

  if (pathname === '/api/environments' && req.method === 'GET') {
    // The default is BASE_URL's environment, even when it isn't in the list
    // (some other host). The local DDEV site is listed only while it's
    // running; checked on each page load, so starting DDEV and reloading
    // brings it back.
    const all = environments();
    if (!all.some((e) => e.id === defaultEnv.id)) all.push(defaultEnv);
    const up = await Promise.all(all.map((e) => isActive(e)));
    const list = all.filter((_, i) => up[i]);
    const fallback = list.some((e) => e.id === defaultEnv.id)
      ? defaultEnv.id
      : list[0]?.id;
    return sendJson(res, 200, {
      default: fallback,
      environments: list.map(publicEnv),
    });
  }

  if (pathname === '/api/roles' && req.method === 'GET')
    return sendJson(res, 200, {
      roles: await knownRoles(envParam(searchParams.get('env'))),
    });

  if (
    (m = pathname.match(/^\/api\/sessions\/([a-z-]+)$/)) &&
    req.method === 'GET'
  )
    return sendJson(
      res,
      200,
      await checkSessionOnce(m[1], envParam(searchParams.get('env'))),
    );

  if (pathname === '/api/plans' && req.method === 'GET') {
    const env = envParam(searchParams.get('env'));
    const { plans, listErrors } = await loadPlans({
      refresh: searchParams.has('refresh'),
    });
    const runs = await listRuns({ env: env.id, limit: 500 });
    const lastRun = (slug) => runs.find((r) => r.plan === slug) ?? null;
    return sendJson(res, 200, {
      env: publicEnv(env),
      site: env.baseURL,
      activeRun: activeRunId(),
      listErrors,
      plans: plans.map((p) => ({
        ...planSummary(p),
        lastRun: lastRun(p.slug),
      })),
    });
  }

  if (
    (m = pathname.match(/^\/api\/plans\/([\w-]+)$/)) &&
    req.method === 'GET'
  ) {
    const env = envParam(searchParams.get('env'));
    const plan = await loadPlan(m[1]);
    if (!plan) return sendJson(res, 404, { error: 'No such plan.' });
    return sendJson(res, 200, {
      env: publicEnv(env),
      site: env.baseURL,
      activeRun: activeRunId(),
      plan: planSummary(plan),
      runs: await listRuns({ plan: plan.slug, limit: 10 }),
    });
  }

  if (
    (m = pathname.match(/^\/api\/plans\/([\w-]+)\/run$/)) &&
    req.method === 'POST'
  ) {
    const plan = await loadPlan(m[1]);
    if (!plan) return sendJson(res, 404, { error: 'No such plan.' });
    const body = await readJsonBody(req);
    const run = await startRun(plan, {
      env: envParam(body.env),
      projects: Array.isArray(body.projects)
        ? body.projects.map(String)
        : undefined,
      cases: Array.isArray(body.cases) ? body.cases.map(String) : [],
      headed: body.headed === true,
    });
    return sendJson(res, 201, run);
  }

  if (
    (m = pathname.match(/^\/api\/plans\/([\w-]+)\/ui$/)) &&
    req.method === 'POST'
  ) {
    const plan = await loadPlan(m[1]);
    if (!plan) return sendJson(res, 404, { error: 'No such plan.' });
    const body = await readJsonBody(req);
    return sendJson(
      res,
      200,
      await openUiMode(plan, {
        env: envParam(body.env),
        projects: Array.isArray(body.projects)
          ? body.projects.map(String)
          : undefined,
        cases: Array.isArray(body.cases) ? body.cases.map(String) : [],
      }),
    );
  }

  if (
    (m = pathname.match(
      /^\/api\/plans\/([\w-]+)\/cases\/([A-Z][A-Z0-9]*-\d+)\/explanation$/,
    ))
  ) {
    const plan = await loadPlan(m[1]);
    if (!plan) return sendJson(res, 404, { error: 'No such plan.' });
    if (req.method === 'GET')
      return sendJson(res, 200, {
        explanation: await savedExplanation(plan, m[2]),
      });
    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, {
        explanation: await explainCase(plan, m[2], {
          refresh: body.refresh === true,
        }),
      });
    }
  }

  if (
    (m = pathname.match(
      /^\/api\/plans\/([\w-]+)\/cases\/([A-Z][A-Z0-9]*-\d+)\/review$/,
    ))
  ) {
    const plan = await loadPlan(m[1]);
    if (!plan) return sendJson(res, 404, { error: 'No such plan.' });
    if (req.method === 'GET')
      return sendJson(res, 200, await latestReview(plan, m[2]));
    if (req.method === 'POST')
      return sendJson(res, 200, { review: await reviewCase(plan, m[2]) });
  }

  if (pathname === '/api/suites' && req.method === 'GET') {
    const env = envParam(searchParams.get('env'));
    const suites = await loadSuites({ refresh: searchParams.has('refresh') });
    const runs = await listRuns({ env: env.id, limit: 500 });
    return sendJson(res, 200, {
      env: publicEnv(env),
      activeRun: activeRunId(),
      suites: suites.map((s) => ({
        ...s,
        lastRun: runs.find((r) => r.suite === s.slug) ?? null,
      })),
    });
  }

  if (
    (m = pathname.match(/^\/api\/suites\/([\w-]+)$/)) &&
    req.method === 'GET'
  ) {
    const suite = await loadSuite(m[1]);
    if (!suite) return sendJson(res, 404, { error: 'No such suite.' });
    return sendJson(res, 200, {
      activeRun: activeRunId(),
      suite,
      runs: await listRuns({ suite: suite.slug, limit: 10 }),
    });
  }

  if (
    (m = pathname.match(/^\/api\/suites\/([\w-]+)\/run$/)) &&
    req.method === 'POST'
  ) {
    const suite = await loadSuite(m[1]);
    if (!suite) return sendJson(res, 404, { error: 'No such suite.' });
    const body = await readJsonBody(req);
    const list = (x) => (Array.isArray(x) ? x.map(String) : undefined);
    const run = await startSuiteRun(suite, {
      env: envParam(body.env),
      plans: list(body.plans),
      prompts: list(body.prompts),
      headed: body.headed === true,
      checkLogin: checkSessionOnce,
    });
    return sendJson(res, 201, run);
  }

  if (pathname === '/api/runs' && req.method === 'GET')
    return sendJson(res, 200, {
      activeRun: activeRunId(),
      runs: await listRuns(),
    });

  if ((m = pathname.match(/^\/api\/runs\/([\w-]+)$/)) && req.method === 'GET') {
    const run = await getRun(m[1], {
      logFrom: Number(searchParams.get('logFrom')) || 0,
    });
    return run
      ? sendJson(res, 200, run)
      : sendJson(res, 404, { error: 'No such run.' });
  }

  if ((m = pathname.match(/^\/api\/runs\/([\w-]+)\/explanations$/))) {
    if (req.method === 'GET')
      return sendJson(res, 200, {
        explanations: await savedFailureExplanations(m[1]),
      });
    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, {
        explanation: await explainFailure(m[1], testRef(body), {
          refresh: body.refresh === true,
        }),
      });
    }
  }

  if (
    (m = pathname.match(/^\/api\/runs\/([\w-]+)\/stop$/)) &&
    req.method === 'POST'
  ) {
    return stopRun(m[1])
      ? sendJson(res, 200, { stopping: true })
      : sendJson(res, 409, { error: 'That run is not in progress.' });
  }

  return sendJson(res, 404, { error: 'Not found' });
}

async function sendFile(res, file) {
  const body = await readFile(file);
  res.writeHead(200, {
    'content-type': contentTypes[extname(file)] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  res.end(body);
}

const server = createServer(async (req, res) => {
  const { pathname, searchParams } = new URL(req.url, 'http://localhost');

  if (pathname.startsWith('/api/')) {
    try {
      return await api(req, res, pathname, searchParams);
    } catch (err) {
      if (err instanceof RunError)
        return sendJson(res, err.status, {
          ...err.details,
          error: err.message,
        });
      console.error(err);
      return sendJson(res, 500, { error: err.message.split('\n')[0] });
    }
  }

  // A run's files: /runs/<id>/report/ is its HTML report.
  const runFile = pathname.match(/^\/runs\/([\w-]+)\/(.+)$/);
  if (runFile) {
    const file = normalize(
      join(runFilesDir, runFile[1], decodeURIComponent(runFile[2])),
    );
    if (file.startsWith(runFilesDir + '/')) {
      try {
        const target = (await stat(file)).isDirectory()
          ? join(file, 'index.html')
          : file;
        return await sendFile(res, target);
      } catch {
        // fall through to 404
      }
    }
    res.writeHead(404, { 'content-type': 'text/plain' });
    return res.end('Not found');
  }

  // In dev mode Vite serves the app.
  if (vite) return vite.middlewares(req, res);

  // The built app; any other path gets index.html.
  const file = normalize(
    join(staticDir, pathname === '/' ? 'index.html' : pathname),
  );
  const target =
    file.startsWith(staticDir) && extname(file)
      ? file
      : join(staticDir, 'index.html');
  try {
    await sendFile(res, target);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
  }
});

async function openWindow(url) {
  let browser;
  try {
    browser = await chromium.launch({ headless: false });
  } catch (err) {
    console.log(
      `Couldn't open a browser window (${err.message.split('\n')[0]}).\n` +
        `Open ${url} yourself, or run \`npm run install:browsers\` first.`,
    );
    return;
  }
  // Closing the window ends the dashboard, like closing an app.
  browser.on('disconnected', () => {
    console.log('Dashboard window closed. Stopping.');
    shutdown();
  });
  // viewport: null lets the page follow the window size.
  const page = await browser.newPage({ viewport: null });
  // Closing the last tab doesn't always end the browser process, so do it.
  page.on('close', () => browser.close());
  await page.goto(url);
}

// A test run, or a UI mode window, started from the dashboard ends with it.
function shutdown() {
  stopActiveRun();
  closeUiMode();
  server.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.on('error', (err) => {
  if (err.code !== 'EADDRINUSE') throw err;
  console.error(
    `Port ${port} is already in use, most likely by a dashboard that is still running.\n` +
      `Stop it (Ctrl+C in its terminal, or: kill $(lsof -t -iTCP:${port} -sTCP:LISTEN)),\n` +
      `or start this one on another port: DASHBOARD_PORT=4401 npm run dashboard`,
  );
  process.exit(1);
});

// Build the app, or in dev mode start Vite on this server (its live-reload
// connection shares the port).
let vite = null;
if (dev) {
  vite = await createViteServer({
    configFile: viteConfig,
    appType: 'spa',
    server: { middlewareMode: true, hmr: { server } },
  });
} else {
  console.log('Building the dashboard…');
  await viteBuild({ configFile: viteConfig, logLevel: 'warn' });
}

server.listen(port, '127.0.0.1', () => {
  const url = `http://localhost:${port}`;
  console.log(
    `CareerForce - Test Dashboard: ${url}  (default environment: ${defaultEnv.name}, ${defaultEnv.baseURL})`,
  );
  if (process.argv.includes('--no-open')) return;
  console.log('Opening it in a browser window. Close the window to stop.');
  openWindow(url);
});
