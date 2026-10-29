import { test, expect } from '@playwright/test';
import { HomePage } from '../../pages/home.page';
import { expectedGtmId } from '../../helpers/environment';

// [Smoke] - Anonymous - Test Plan, HP-1/HP-3/HP-4.
// See test-plans/smoke-anonymous.md.

test.describe('homepage', () => {
  test('HP-1: loads for an anonymous visitor', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();
    await expect(home.main).toBeVisible();
    await expect(home.jobSearchHeading).toBeVisible();
    await expect(home.whatBringsYouHereHeading).toBeVisible();
    await expect(home.upcomingEventsHeading).toBeVisible();
    await expect(home.exploreCareersHeading).toBeVisible();
    await expect(home.upcomingTrainingProgramsHeading).toBeVisible();
    await expect(home.createAccountCta).toBeVisible();
    await expect(home.connectToServicesHeading).toBeVisible();
    await expect(home.blogHeading).toBeVisible();
  });

  test('HP-3: loads the GTM container expected for this environment', async ({
    page,
    baseURL,
  }) => {
    const home = new HomePage(page);
    await home.goto();
    const gtmId = await home.gtmContainerId();
    expect(gtmId).toBe(expectedGtmId(baseURL!));
  });

  test('HP-4: Decision Tree widget advances to a second step', async ({
    page,
  }) => {
    const home = new HomePage(page);
    await home.goto();
    await home.decisionTreeToggle().click();
    await home.firstDecisionTreeOption().click();
    await expect(home.resetDecisionTreeButton()).toBeVisible();
  });
});
