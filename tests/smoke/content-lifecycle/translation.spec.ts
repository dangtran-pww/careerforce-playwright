import { test, expect } from '../../helpers/fixtures';
import { useRole } from '../../helpers/roles';
import { uniqueTitle } from '../../helpers/test-data';
import { visitorPage } from '../../helpers/visitor';
import {
  NodeForm,
  deleteNode,
  expectNoErrors,
  statusMessages,
} from '../../pages/node-form.page';

// [Smoke] - Content Lifecycle - Test Plan — CL-5. See
// test-plans/smoke-content-lifecycle.md.
//
// Step 4 is where MNDEED-8191 ("Deleting translation throws PHP error")
// showed. It's Done, so the test expects no error.

useRole('admin');

let created: string[] = [];

test.afterEach(async ({ page }) => {
  for (const path of created) await deleteNode(page, path);
  created = [];
});

test(
  'CL-5: translate a page, then delete the translation',
  { tag: ['@no-prod', '@desktop-only'] },
  async ({ page, browser }, testInfo) => {
    const title = uniqueTitle();
    const spanishTitle = `Prueba de Playwright ${title.split(' ').pop()}`;
    const form = new NodeForm(page);
    const path = await form.createPage({
      title,
      body: `Body of ${title}`,
      state: 'published',
    });
    created.push(path);

    const spanishRow = page.locator('main table tbody tr', {
      hasText: 'Spanish',
    });

    // 1. Add a Spanish translation.
    await page.goto(`${path}/translations`);
    await expect(spanishRow).toContainText('Not translated');
    await spanishRow.getByRole('link', { name: 'Add' }).click();
    await expect(page).toHaveURL(/\/es\/node\/\d+\/translations\/add\/en\/es$/);

    // 2. Fill it in and publish it.
    await expect(form.bodyEditor).toBeVisible();
    await form.title.fill(spanishTitle);
    await form.replaceBody(`Cuerpo de ${spanishTitle}`);
    await form.state.selectOption('published');
    const spanishPath = await form.save();
    await expect(statusMessages(page)).toBeVisible();
    expect(spanishPath).toMatch(/^\/es\//);
    await page.goto(`${path}/translations`);
    await expect(spanishRow).toContainText('Published');

    // 3. A visitor sees each language's title.
    const visitor = await visitorPage(browser, testInfo);
    try {
      await visitor.goto(spanishPath);
      await expect(visitor.locator('h1').first()).toHaveText(spanishTitle);
      await visitor.goto(path);
      await expect(visitor.locator('h1').first()).toHaveText(title);
    } finally {
      await visitor.context().close();
    }

    // 4. Delete the Spanish translation from the Translate tab.
    await page.goto(`${path}/translations`);
    const toggle = spanishRow.getByRole('button', {
      name: 'List additional actions',
    });
    if (await toggle.count()) await toggle.click();
    await spanishRow.getByRole('link', { name: 'Delete' }).click();
    await page.getByRole('button', { name: /^Delete/ }).click();
    await expectNoErrors(page);
    await expect(statusMessages(page)).toBeVisible();
    await page.goto(`${path}/translations`);
    await expect(spanishRow).toContainText('Not translated');
  },
);
