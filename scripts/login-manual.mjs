// One-time, by-hand login: launches a completely ordinary, non-automated
// browser window so Google's SSO sign-in doesn't see any automation markers.
// It's Playwright's own Chromium (the one the tests run in), started as a
// plain process, not through Playwright. (Playwright's own browser launch — e.g. via `playwright codegen` — adds
// flags like --enable-automation that set navigator.webdriver = true, which
// Google's "this browser or app may not be secure" check blocks, so the
// Google sign-in page just hangs or refuses to load.) While the window is
// open, this script reads its cookies once a second over the DevTools
// protocol, at browser level only. It never attaches to a page, so the
// sign-in pages can't see it, and it never touches the login itself.
//
// Run: npm run login:manual -- <role> [--env qa|stage|prod|sandbox|local]
//      (role defaults to "partner", env to the one BASE_URL points at)
// e.g. npm run login:manual -- admin --env stage
//
// Each role gets its own saved session per environment
// (playwright/.auth/<env>/<role>.json) and its own browser profile, since
// each is a separate SSO account. Tests pick
// the role they need with `test.use({ storageState: authFile('<role>') })` —
// see playwright.config.ts and the README for the multi-role pattern.
//
// A browser window opens on the login page. On QA and Stage, click "PWW Staff
// Log In" and complete the Google sign-in. Production has no "PWW Staff Log
// In" button: open "DEED Staff Member", click its "Log In" button and
// complete that sign-in. Every time the window logs in to the site
// (including after logging out and in again), the session is saved to
// playwright/.auth/<env>/<role>.json. Close the window, or press Ctrl+C, when done.
// If the window for that role is still open from an earlier run, it's
// reused instead of opening a new one.
//
// Only the site's own cookies are saved, not the cookies of every other site
// the window visited (Google's included): the tests don't need them.
import { chromium } from '@playwright/test';
import {
  authFile as authFileFor,
  credentialsFor,
  defaultEnv,
  environmentById,
  environments,
  hostOf,
  isDrupalSession,
  isSiteCookie,
  sessionIsLoggedIn,
} from './lib/site.mjs';
import { hostResolverRules } from '../tests/helpers/blocked-hosts.mts';
import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

// `<role> [--env <id>]`: the environment defaults to the one BASE_URL points at.
const args = process.argv.slice(2);
const envFlag = args.indexOf('--env');
const envId = envFlag >= 0 ? args.splice(envFlag, 2)[1] : null;
const env = envId ? environmentById(envId) : defaultEnv;
if (!env) {
  console.error(
    `Unknown environment "${envId}". Use one of: ${environments()
      .map((e) => e.id)
      .join(', ')}.`,
  );
  process.exit(1);
}
const baseURL = env.baseURL;
const siteHost = hostOf(env);

// Which button to log in with. "PWW Staff Log In" (Google sign-in) is only on
// QA and Stage; Production staff log in through "DEED Staff Member".
const loginSteps =
  env.id === 'prod'
    ? 'open "DEED Staff Member", click its "Log In" button and finish the sign-in'
    : 'click "PWW Staff Log In" and finish the Google sign-in';

const role = args[0] ?? 'partner';
if (!/^[a-z0-9_-]+$/i.test(role)) {
  console.error(
    `Invalid role "${role}" — use letters, numbers, "-" or "_" only.`,
  );
  process.exit(1);
}

// Cookies belong to one host, so each environment has its own login file.
// The browser profile is per role only: the Google account is the same.
const authFile = authFileFor(role, env);
mkdirSync(dirname(authFile), { recursive: true });
const profileDir = `playwright/.auth/chromium-profile-${role}`;

const browserPath = chromium.executablePath();
if (!existsSync(browserPath)) {
  console.error(
    "Playwright's Chromium isn't installed. Run `npm run install:browsers`.",
  );
  process.exit(1);
}

mkdirSync(profileDir, { recursive: true });

// QA's Basic Auth gate, like httpCredentials in playwright.config.ts: the
// credentials go in the first URL the window opens, and Chromium then reuses
// them for the rest of the site in that window. (The logged-in check in
// lib/site.mjs sends them itself.)
let loginUrl = `${baseURL}/user/login`;
const credentials = credentialsFor(env);
if (credentials) {
  const url = new URL(loginUrl);
  url.username = credentials.username;
  url.password = credentials.password;
  loginUrl = url.toString();
}

// The login window can't reach the tracking hosts or the AWS WAF challenge
// SDK (see tests/helpers/blocked-hosts.mts): the browser is told at launch that
// they don't exist. That keeps the login visit out of the site's analytics.
// The tracking paths on www.google.com can't be blocked by host without
// breaking the Google sign-in; GTM being blocked covers them.

// The browser picks a free debug port (--remote-debugging-port=0) and writes
// it to DevToolsActivePort in its profile. Reading it from there means we
// always talk to this role's window. A fixed port could be held by some other
// browser on the machine, and we'd save that browser's cookies instead.
const portFile = `${profileDir}/DevToolsActivePort`;

// The browser-level DevTools WebSocket URL, or null if nothing answers.
async function browserEndpoint(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(2000),
    });
    return (await res.json()).webSocketDebuggerUrl ?? null;
  } catch {
    return null;
  }
}

function readPortFile() {
  if (!existsSync(portFile)) return null;
  return Number(readFileSync(portFile, 'utf8').split('\n')[0]) || null;
}

let endpoint = null;
const openPort = readPortFile();
if (openPort) endpoint = await browserEndpoint(openPort);

const reused = Boolean(endpoint);
if (endpoint) {
  console.log(
    `Using the Chromium window for "${role}" that is already open.`,
  );
} else {
  // A port file with nothing behind it is left over from a crash.
  rmSync(portFile, { force: true });
  console.log(
    `Opening a plain Chromium window (${browserPath}) for role "${role}"...`,
  );
  const browserProcess = spawn(
    browserPath,
    [
      '--remote-debugging-port=0',
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      `--host-resolver-rules=${hostResolverRules}`,
      loginUrl,
    ],
    { stdio: 'ignore', detached: true },
  );
  browserProcess.unref();

  for (let waited = 0; waited < 15_000 && !endpoint; waited += 250) {
    await sleep(250);
    const port = readPortFile();
    if (port) endpoint = await browserEndpoint(port);
  }
  if (!endpoint) {
    // The profile is open in a window that was started without a debug port
    // (by an older version of this script, or by hand). A new launch just
    // hands the URL to that window, so there is nothing to read from.
    console.error(
      `\nA Chromium window for "${role}" is already open, but this script ` +
        "can't read from it (it wasn't started by this version of the script).\n" +
        'Close every window of it, then run this command again. Your login is ' +
        'kept in the profile, so you may not need to sign in again.',
    );
    process.exit(1);
  }
}

// Minimal DevTools protocol client on the browser target. No page is
// attached, so nothing in the sign-in pages can detect it.
const socket = new WebSocket(endpoint);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener(
    'error',
    () => reject(new Error(`Couldn't connect to ${endpoint}`)),
    {
      once: true,
    },
  );
});
let nextId = 1;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  pending.get(msg.id)?.(msg);
  pending.delete(msg.id);
});
function send(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) =>
    pending.set(id, (msg) =>
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result),
    ),
  );
}

// The window that was already open may be on another environment: open a
// tab on this one's login page. Target.createTarget is a browser-level
// command, so it still doesn't attach to any page.
if (reused) await send('Target.createTarget', { url: loginUrl });

// The site's cookies, in Playwright's storageState format.
const toStorageState = (cookies) => ({
  cookies: cookies.filter((c) => isSiteCookie(c, env)).map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
    expires: c.session ? -1 : c.expires,
    httpOnly: c.httpOnly,
    secure: c.secure,
    sameSite: c.sameSite ?? 'Lax',
  })),
  origins: [],
});

let savedSession = null;
try {
  const saved = JSON.parse(readFileSync(authFile, 'utf8'));
  savedSession = saved.cookies.find((c) => isDrupalSession(c, env))?.value ?? null;
} catch {
  // No saved session yet.
}

console.log(
  `\nLog in in the Chromium window: ${loginSteps}.\nEach time the window logs in to ${siteHost}, the session is ` +
    `saved to ${authFile}.\nClose the window (or press Ctrl+C) when you are done.\n`,
);

const time = () => new Date().toLocaleTimeString();
let savedThisRun = false;
// The session cookie value last checked with the site, and what the site
// said about it: 'valid', 'dead' (the browser kept a cookie the site no
// longer accepts) or 'none' (no session cookie).
let checkedValue;
let windowState = 'none';
let closed = false;
socket.addEventListener('close', () => (closed = true));

while (!closed) {
  let cookies;
  try {
    ({ cookies } = await send('Storage.getCookies'));
  } catch {
    break; // window closed while asking
  }
  const value = cookies.find((c) => isDrupalSession(c, env))?.value ?? null;

  // Logging in always gives a new session cookie, so ask the site only when
  // the value changes.
  if (value !== checkedValue) {
    if (!value) {
      if (windowState === 'valid')
        console.log(
          `${time()}  Logged out in the window. Log in again and it will be saved.`,
        );
      windowState = 'none';
      checkedValue = value;
    } else {
      let works;
      try {
        works = await sessionIsLoggedIn(toStorageState(cookies), env);
      } catch (err) {
        console.log(
          `${time()}  Couldn't ask ${siteHost} whether the window is logged in (${err.message.split('\n')[0]}). Trying again...`,
        );
        await sleep(5000);
        continue;
      }
      checkedValue = value;
      if (works) {
        windowState = 'valid';
        if (value !== savedSession) {
          writeFileSync(
            authFile,
            JSON.stringify(toStorageState(cookies), null, 2),
          );
          savedSession = value;
          savedThisRun = true;
          console.log(
            `${time()}  Logged in. Saved the session to ${authFile}.`,
          );
        } else {
          console.log(
            `${time()}  The window is logged in, and ${authFile} already has that session.`,
          );
        }
      } else {
        windowState = 'dead';
        console.log(
          `${time()}  The window still has an old ${siteHost} session that the site no longer ` +
            `accepts (it expired or was logged out). To log in again, ${loginSteps}.`,
        );
      }
    }
  }
  await sleep(1000);
}

const done = savedThisRun || windowState === 'valid';
console.log(
  done
    ? 'Login window closed. Done.'
    : `Login window closed without logging in. ${authFile} was not changed.`,
);
process.exit(done ? 0 : 1);
