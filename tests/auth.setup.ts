import * as fs from 'node:fs';
import * as path from 'node:path';
import { test as setup, expect } from '@playwright/test';
import { editorAuthFile } from './helpers/playwright-env';

// Runs once before the Chromium project (see playwright.config.ts).
// Expects a session saved by `npm run auth` — this setup only verifies it.

setup('verify editor session', async ({ page }) => {
  const authPath = path.resolve(editorAuthFile);
  if (!fs.existsSync(authPath)) {
    throw new Error(
      'Missing playwright/.auth/editor.json — run `npm run auth` first.',
    );
  }

  await page.goto('/admin/content');
  await expect(
    page.getByRole('heading', { name: 'Content' }),
    'Editor session expired — run `npm run auth` again.',
  ).toBeVisible();
});
