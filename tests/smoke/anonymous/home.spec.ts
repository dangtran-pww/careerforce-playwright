import { test, expect } from '../../helpers/fixtures';
import { HomePage } from '../../pages/home.page';
import { expectedGtmId } from '../../helpers/environment';

// [Smoke] - Anonymous - Test Plan, HP-1/HP-3/HP-4.
// See test-plans/smoke-anonymous.md.

test('HP-1: homepage loads for an anonymous visitor', async ({ page }) => {
  const home = new HomePage(page);
  await home.goto();
  await expect(home.main).toBeVisible();
  await expect(home.jobSearchHeading).toBeVisible();
  expect(await home.jobSearchBackgroundImage()).toBe(
    'linear-gradient(to right bottom, rgb(0, 60, 111), rgb(1, 90, 167))',
  );
  // The sentence has a <br> after "exploration", so textContent would run
  // "explorationand" together; innerText renders it as a space.
  await expect(home.jobSearchIntro).toHaveText(
    "CareerForce is Minnesota's official career exploration and job search resource.",
    { useInnerText: true },
  );
  await expect(home.jobSearchKeywordInput).toBeVisible();
  await expect(home.jobSearchLocationInput).toBeVisible();
  await expect(home.jobSearchDistanceSelect).toBeVisible();
  await expect(home.jobSearchButton).toBeVisible();
  await expect(home.whatBringsYouHereHeading).toBeVisible();
  await expect(home.upcomingEventsHeading).toBeVisible();
  await expect(home.exploreCareersHeading).toBeVisible();
  await expect(home.upcomingTrainingProgramsHeading).toBeVisible();
  await expect(home.createAccountCta).toBeVisible();
  await expect(home.connectToServicesHeading).toBeVisible();
  await expect(home.blogHeading).toBeVisible();
});

test('HP-3: homepage loads the GTM container expected for this environment', async ({
  page,
  baseURL,
}) => {
  const home = new HomePage(page);
  await home.goto();
  const gtmId = await home.gtmContainerId();
  expect(gtmId).toBe(expectedGtmId(baseURL!));
});

test('HP-4: homepage Decision Tree widget advances to a second step', async ({
  page,
}) => {
  const home = new HomePage(page);
  await home.goto();
  await home.decisionTreeToggle().click();
  await home.firstDecisionTreeOption().click();
  await expect(home.resetDecisionTreeButton()).toBeVisible();
});
