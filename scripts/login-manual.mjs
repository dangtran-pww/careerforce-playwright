// One-time, by-hand login: opens a real, visible browser so a human can
// complete the actual login flow (including SSO/MFA, which Playwright must
// never automate with real credentials) and then saves the resulting
// session to playwright/.auth/editor.json. Tests that need a logged-in user
// reuse that file via `storageState` in playwright.config.ts — see the
// `chromium` project there.
//
// Run: npm run login:manual
// Close the opened browser window when you're done logging in; that's what
// triggers Playwright to write the storage state file.
import 'dotenv/config';
import { spawnSync } from 'node:child_process';

const baseURL = process.env.BASE_URL ?? 'https://qa.careerforce.link';
const authFile = 'playwright/.auth/editor.json';

const args = ['playwright', 'codegen', `--save-storage=${authFile}`];

if (process.env.BASIC_AUTH_USER) {
  args.push(
    `--http-credentials=${process.env.BASIC_AUTH_USER}:${process.env.BASIC_AUTH_PASSWORD ?? ''}`,
  );
}

args.push(baseURL);

const result = spawnSync('npx', args, { stdio: 'inherit' });
process.exit(result.status ?? 1);
