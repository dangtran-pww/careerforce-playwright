import { test, expect } from '@playwright/test';
import { HomePage } from '../pages/home.page';
import { expectedGtmId } from '../helpers/environment';

// Phase 1 — Read-Only Smoke Test Plan, HP-1/HP-3/HP-4.
// See docs/phase1-read-only-smoke-test-plan.md.

test.describe('homepage', () => {
  test('loads for an anonymous visitor', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();
    await expect(home.main).toBeVisible();
  });

  test('loads the GTM container expected for this environment', async ({
    page,
    baseURL,
  }) => {
    const home = new HomePage(page);
    await home.goto();
    const gtmId = await home.gtmContainerId();
    expect(gtmId).toBe(expectedGtmId(baseURL!));
  });

  test('Decision Tree widget advances to a second step', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();
    await home.decisionTreeToggle().click();
    await home.firstDecisionTreeOption().click();
    await expect(home.resetDecisionTreeButton()).toBeVisible();
  });
});
