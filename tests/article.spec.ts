import { test, expect } from '@playwright/test';
import {
  createTestArticle,
  deleteTestArticle,
  uniqueTitle,
} from './helpers/test-data';

// Pattern: API creates the data, the browser checks what a user can see.
// The node is deleted in `finally`, even if an assertion fails.

test('published test article is visible', async ({ page }) => {
  const title = uniqueTitle();
  const article = await createTestArticle(title);

  try {
    await page.goto(`/node/${article.nid}`);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.getByText('Playwright test body')).toBeVisible();
  } finally {
    await deleteTestArticle(article.uuid);
  }
});
