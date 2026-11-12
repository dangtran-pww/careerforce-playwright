import { test, expect } from '../../helpers/fixtures';
import { useRole } from '../../helpers/roles';
import { uniqueTitle, uniqueToken } from '../../helpers/test-data';
import { visitorPage } from '../../helpers/visitor';
import {
  NodeForm,
  deleteNode,
  expectNoErrors,
  statusMessages,
} from '../../pages/node-form.page';

// [Smoke] - Content Lifecycle - Test Plan — CL-1, CL-2, CL-6. See
// test-plans/smoke-content-lifecycle.md.
//
// Each test creates a Page and deletes it afterwards, even when it fails.
// A published test page is briefly visible to visitors: QA/stage only.

useRole('admin');

let created: string[] = [];

test.afterEach(async ({ page }) => {
  for (const path of created) await deleteNode(page, path);
  created = [];
});

test.describe(
  'content lifecycle: publish',
  { tag: ['@no-prod', '@desktop-only'] },
  () => {
    test('CL-1: create and publish a page', async ({
      page,
      browser,
    }, testInfo) => {
      const title = uniqueTitle();
      const body = `Body of ${title}`;
      const form = new NodeForm(page);

      // 1. Create it as Published.
      const path = await form.createPage({ title, body, state: 'published' });
      created.push(path);
      expect(path, 'the page has a URL alias, not /node/<nid>').not.toMatch(
        /^\/node\/\d+$/,
      );
      await expect(page.locator('h1').first()).toHaveText(title);

      // 2. A visitor sees it.
      const visitor = await visitorPage(browser, testInfo);
      try {
        const response = await visitor.goto(path);
        expect(response?.status()).toBe(200);
        await expect(visitor.locator('h1').first()).toHaveText(title);
        await expect(visitor.getByText(body)).toBeVisible();
      } finally {
        await visitor.context().close();
      }
    });

    test('CL-2: archive a page, then restore it', async ({
      page,
      browser,
    }, testInfo) => {
      const title = uniqueTitle();
      const body = `Body of ${title}`;
      const form = new NodeForm(page);
      const path = await form.createPage({ title, body, state: 'published' });
      created.push(path);

      const visitor = await visitorPage(browser, testInfo);
      try {
        // 1. Archive it.
        await form.openEdit(path);
        await form.state.selectOption('archived');
        await form.save();
        await expect(statusMessages(page)).toBeVisible();

        // 2. The visitor is denied.
        const denied = await visitor.goto(path);
        expect(denied?.status()).toBe(403);
        await expect(visitor.getByText(title)).toHaveCount(0);
        await expect(visitor.getByText(body)).toHaveCount(0);

        // 3. The admin still sees it, listed as Unpublished.
        await page.goto(path);
        await expect(page.locator('h1').first()).toHaveText(title);
        await page.goto(
          `/admin/content?title=${encodeURIComponent(title)}&type=All`,
        );
        const row = page.locator('table tbody tr', { hasText: title });
        await expect(row).toHaveCount(1);
        await expect(row).toContainText('Unpublished');

        // 4. Restore it; the visitor sees it again.
        await form.openEdit(path);
        await form.state.selectOption('published');
        await form.save();
        const restored = await visitor.goto(path);
        expect(restored?.status()).toBe(200);
        await expect(visitor.locator('h1').first()).toHaveText(title);
      } finally {
        await visitor.context().close();
      }
    });

    test('CL-6: a published page can be found by search', async ({
      page,
      browser,
    }, testInfo) => {
      const token = uniqueToken();
      const title = `Playwright test ${token}`;
      const form = new NodeForm(page);

      // 1. Create it as Published.
      const path = await form.createPage({
        title,
        body: `Body of ${title}`,
        state: 'published',
      });
      created.push(path);

      // 2. A visitor searches for its unique word. The index is set to index
      // on save; the poll only allows for the search server's commit delay.
      const visitor = await visitorPage(browser, testInfo);
      try {
        await expect
          .poll(
            async () => {
              await visitor.goto(`/search?k=${token}`);
              await expectNoErrors(visitor);
              return visitor.locator(`main a[href$="${path}"]`).count();
            },
            {
              message: `search for "${token}" links to ${path}`,
              timeout: 60_000,
              intervals: [2_000, 5_000],
            },
          )
          .toBeGreaterThan(0);
      } finally {
        await visitor.context().close();
      }
    });
  },
);
