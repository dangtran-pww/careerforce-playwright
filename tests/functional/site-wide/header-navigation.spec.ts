import { test, expect } from '../../helpers/fixtures';
import { HomePage } from '../../pages/home.page';

// spec: test-suites/site-wide/functional-site-wide-header-navigation.md (HN-1)
// seed: tests/seed.spec.ts
//
// A visitor who isn't logged in; nothing is changed, so every case is
// prod-safe. On a phone, tests/helpers/fixtures.ts also checks the page
// doesn't scroll sideways.

test('HN-1: "Skip to main content" moves keyboard focus past the header', async ({
  page,
}) => {
  const home = new HomePage(page);
  await home.goto();
  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skipLink).toHaveAttribute('href', '#main-content');
  await expect(page.locator('#main-content')).toBeAttached();

  // It's hidden until focused; the first Tab focuses it and shows it.
  await page.keyboard.press('Tab');
  await expect(skipLink).toBeFocused();
  await expect
    .poll(async () => (await skipLink.boundingBox())?.width ?? 0, {
      message: 'the skip link should show at full size once focused',
    })
    .toBeGreaterThan(10);

  // Following it, the next Tab lands inside the main content, not in the
  // header menu.
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main-content$/);
  await page.keyboard.press('Tab');
  await expect(page.locator('#main-content :focus')).toHaveCount(1);
});
