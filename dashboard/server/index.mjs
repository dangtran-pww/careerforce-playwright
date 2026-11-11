// `npm run dashboard` — a small local web app that shows how the tests are
// doing and runs test plans. Serves the React app in dashboard/ and a JSON
// API it calls. Only listens on 127.0.0.1: the API reads saved login
// sessions and starts test runs.
//
// This file starts it. The routes are a Hono app: see app.mjs for where each
// one lives (routes/), and how requests are checked and errors answered.
// The work is done by:
//   catalog/   reading test-plans/ and test-suites/
//   runs/      running plans and suites, one run at a time, and run history
//   claude/    asking Claude Code (explaining a case or a failure, reviewing
//              a case); runs/suite-run.mjs also runs it for suite prompts
//   sessions.mjs, ui-mode.mjs, environments.mjs
//   lib/       small helpers with no dashboard knowledge
// paths.mjs says where everything is; errors.mjs has the error type.
//
// On start it builds the app with Vite (dashboard/src → dashboard/dist) and
// serves the build. With --dev (`npm run dashboard:dev`) it skips the build
// and runs Vite inside this server instead: pages come straight from
// dashboard/src and reload as you edit.
//
// Opens the page in a Playwright Chromium window; closing that window stops
// the dashboard. `npm run dashboard -- --no-open` starts only the server, to
// use your own browser instead.
//
// The environment is picked on the page; BASE_URL (from .env) is only the
// default. Env: BASE_URL, BASIC_AUTH_USER/PASSWORD (and _<ENV> overrides),
// SANDBOX_URL, LOCAL_URL, DASHBOARD_PORT (default 4400), HTTPS_PROXY (used if set).

import { createServer } from 'node:http';
import { getRequestListener } from '@hono/node-server';
import { chromium } from '@playwright/test';
import { build as viteBuild, createServer as createViteServer } from 'vite';
import { defaultEnv } from '../../scripts/lib/site.mjs';
import { createApp } from './app.mjs';
import { stopClaudes } from './claude/run.mjs';
import { ROOT, VITE_CONFIG } from './paths.mjs';
import { stopActiveRun } from './runs/lifecycle.mjs';
import { closeUiMode } from './ui-mode.mjs';

// Every path the server uses is relative to the repository; see paths.mjs.
process.chdir(ROOT);

const port = Number(process.env.DASHBOARD_PORT ?? 4400);
const dev = process.argv.includes('--dev');
const viteConfig = VITE_CONFIG;

// The Node server comes first, since Vite's dev server attaches its
// live-reload connection to it; the app, which needs Vite, is set below.
let listener;
const server = createServer((req, res) => listener(req, res));

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

// A test run, a UI mode window, or a question to Claude started from the
// dashboard ends with it.
function shutdown() {
  stopActiveRun();
  closeUiMode();
  stopClaudes();
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

// overrideGlobalObjects: false leaves the process's global Request and
// Response as they are; the test runs and site checks share this process.
listener = getRequestListener(createApp({ vite }).fetch, {
  overrideGlobalObjects: false,
});

server.listen(port, '127.0.0.1', () => {
  const url = `http://localhost:${port}`;
  console.log(
    `CareerForce - Test Dashboard: ${url}  (default environment: ${defaultEnv.name}, ${defaultEnv.baseURL})`,
  );
  if (process.argv.includes('--no-open')) return;
  console.log('Opening it in a browser window. Close the window to stop.');
  openWindow(url).catch((err) =>
    console.log(
      `Couldn't open the dashboard in the window (${err.message.split('\n')[0]}). Open ${url} yourself.`,
    ),
  );
});
