// One-time, by-hand login: launches a completely ordinary, non-automated
// Chrome window so Google's SSO sign-in doesn't see any automation markers.
// (Playwright's own browser launch — e.g. via `playwright codegen` — adds
// flags like --enable-automation that set navigator.webdriver = true, which
// Google's "this browser or app may not be secure" check blocks, so the
// Google sign-in page just hangs or refuses to load.) Once you've logged
// in, this script attaches to the already-running Chrome over the DevTools
// protocol purely to read out the resulting cookies — it never touches the
// login itself.
//
// Run: npm run login:manual -- <role>   (role defaults to "partner")
// e.g. npm run login:manual -- admin
//
// Each role gets its own saved session (playwright/.auth/<role>.json) and
// its own Chrome profile, since each is a separate SSO account. Tests pick
// the role they need with `test.use({ storageState: 'playwright/.auth/<role>.json' })` —
// see playwright.config.ts and the README for the multi-role pattern.
//
// A Chrome window opens on the login page. Click "PWW Staff Log In",
// complete the Google sign-in, and once you land back on the site logged
// in, return to this terminal and press Enter.
import 'dotenv/config';
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import readline from 'node:readline/promises';

const role = process.argv[2] ?? 'partner';
if (!/^[a-z0-9_-]+$/i.test(role)) {
  console.error(`Invalid role "${role}" — use letters, numbers, "-" or "_" only.`);
  process.exit(1);
}

const baseURL = process.env.BASE_URL ?? 'https://qa.careerforce.link';
const authFile = `playwright/.auth/${role}.json`;
const profileDir = `playwright/.auth/chrome-profile-${role}`;
const debugPort = 9333;

const chromeCandidates = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].filter((candidate) => candidate && existsSync(candidate));

const chromePath = chromeCandidates[0];
if (!chromePath) {
  console.error(
    'Could not find a real Chrome install. Set CHROME_PATH to its full path and re-run.',
  );
  process.exit(1);
}

mkdirSync(profileDir, { recursive: true });

let loginUrl = `${baseURL}/user/login`;
if (process.env.BASIC_AUTH_USER) {
  const url = new URL(loginUrl);
  url.username = process.env.BASIC_AUTH_USER;
  url.password = process.env.BASIC_AUTH_PASSWORD ?? '';
  loginUrl = url.toString();
}

console.log(`Opening a plain Chrome window (${chromePath}) for role "${role}"...`);
const chromeProcess = spawn(
  chromePath,
  [
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    loginUrl,
  ],
  { stdio: 'ignore', detached: true },
);
chromeProcess.unref();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
await rl.question(
  '\nClick "PWW Staff Log In", complete the Google sign-in, and once you are ' +
    'back on the site logged in, press Enter here... ',
);
rl.close();

let browser;
try {
  browser = await chromium.connectOverCDP(`http://localhost:${debugPort}`);
  const context = browser.contexts()[0];
  await context.storageState({ path: authFile });
  console.log(`Saved "${role}" session to ${authFile}.`);
} catch (error) {
  console.error(
    'Could not read the session from Chrome — did you close the window before pressing Enter?',
  );
  throw error;
} finally {
  await browser?.close();
}
