import { test, expect } from '../../helpers/fixtures';
import { useRole } from '../../helpers/roles';
import {
  EXPECTED_TOOLBARS,
  readToolbar,
} from '../../helpers/ckeditor-toolbars';
import { NodeForm } from '../../pages/node-form.page';

// [Smoke] - CKEditor 5 - Test Plan — CK-1. See test-suites/smoke/smoke-ckeditor.md.
// Opens the Page add form and switches the Body's text format; saves nothing.

useRole('admin');

test(
  'CK-1: the toolbar of each text format is as expected',
  { tag: ['@no-prod', '@desktop-only'] },
  async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', (error) => jsErrors.push(error.message));

    const form = new NodeForm(page);
    await form.openAdd();

    const offered = await form.textFormat
      .locator('option')
      .evaluateAll((options) =>
        options.map((o) => (o as HTMLOptionElement).value),
      );
    expect(offered.sort()).toEqual(Object.keys(EXPECTED_TOOLBARS).sort());

    for (const [format, expected] of Object.entries(EXPECTED_TOOLBARS)) {
      await test.step(format, async () => {
        // The Body is empty, so Drupal switches without asking to confirm.
        await form.textFormat.selectOption(format);
        if (expected) {
          // 1. The CKEditor formats have exactly the expected toolbar.
          await expect(form.bodyToolbar).toBeVisible();
          await expect
            .poll(() => form.bodyToolbar.evaluate(readToolbar), {
              message: `${format} toolbar`,
            })
            .toEqual(expected);
        } else {
          // 2. The others have a plain text box.
          await expect(form.bodyToolbar).toHaveCount(0);
          await expect(
            form.bodyField.locator('textarea[name="body[0][value]"]'),
          ).toBeVisible();
        }
      });
    }

    // 3. No JavaScript error.
    expect(jsErrors, 'JavaScript errors on the page').toEqual([]);
  },
);
