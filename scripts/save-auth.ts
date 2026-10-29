import { chromium, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  editorAuthFile,
  getBaseURL,
  getHttpCredentials,
} from '../tests/helpers/playwright-env';

const SSO_WAIT_MS = 10 * 60 * 1000;

async function main(): Promise<void> {
  const baseURL = getBaseURL();
  const authPath = path.resolve(editorAuthFile);
  fs.mkdirSync(path.dirname(authPath), { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    baseURL,
    httpCredentials: getHttpCredentials(),
  });
  const page = await context.newPage();

  await page.goto('/user/login');
  console.log(
    `\nLog in with SSO in the browser window (${baseURL}).\nWaiting up to ${SSO_WAIT_MS / 60_000} minutes for an editor session...\n`,
  );

  await expect(async () => {
    await page.goto('/admin/content', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Content' })).toBeVisible();
  }).toPass({ timeout: SSO_WAIT_MS });

  await context.storageState({ path: authPath });
  console.log(`Saved editor session to ${editorAuthFile}`);

  await browser.close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
