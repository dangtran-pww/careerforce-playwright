import { authFile } from '../../helpers/environments.mjs';
import { test, expect } from '../../helpers/fixtures';
import { useRole } from '../../helpers/roles';
import { CareerDetailPage } from '../../pages/career-detail.page';
import { CareerGoalsPage } from '../../pages/career-goals.page';
import { SkillsMatcherPage } from '../../pages/skills-matcher.page';

// [Smoke] - Job Seeker Tools - Test Plan, JT-1, JT-2 and JT-5 (career goals).
// See test-suites/smoke/smoke-jobseeker-tools.md.
//
// Logged in as the job seeker. Career goals are listed on the "My Goals &
// Experience" tab (/user/<ID>/skills-experience), not on the Dashboard tab.
// These add a career to that account's goals, so they never run on Production
// (@no-prod), and only on desktop (@desktop-only). Each removes only the
// career it added, by SOC code. A job seeker can have at most 6 goals.

test.describe('career goals', { tag: ['@no-prod', '@desktop-only'] }, () => {
  useRole('jobseeker');

  // JT-2 removes the career JT-1 added, so they run in order. If JT-1 fails
  // after adding, JT-2 is skipped and afterAll removes the career instead.
  test.describe.serial('Skills Matcher goal', () => {
    let added: { soc: string; title: string } | undefined;

    test.afterAll(async ({ browser }, testInfo) => {
      if (!added) return;
      // `page` isn't available in afterAll; open a context with the same
      // site, Basic Auth and saved login, as useRole's check does.
      const { baseURL, httpCredentials, ignoreHTTPSErrors } =
        testInfo.project.use;
      const context = await browser.newContext({
        baseURL,
        httpCredentials,
        ignoreHTTPSErrors,
        storageState: authFile('jobseeker'),
      });
      try {
        await new CareerGoalsPage(await context.newPage()).cleanUp([added.soc]);
      } finally {
        await context.close();
      }
    });

    test('JT-1: Skills Matcher: add a matched career to goals', async ({
      page,
    }) => {
      const goals = new CareerGoalsPage(page);
      const skillsMatcher = new SkillsMatcherPage(page);
      await goals.expectRoom(1);

      await skillsMatcher.goto();
      await skillsMatcher.answerSkills();
      await skillsMatcher.submit();
      await expect(skillsMatcher.resultsHeading).toBeVisible();

      await expect(
        skillsMatcher.suggestions.firstSelectable(),
        'at least one matched career should not already be a goal',
      ).toBeVisible();
      added = await skillsMatcher.suggestions.selectFirst();
      expect(added.soc, 'the matched career should have a SOC code').not.toBe(
        '',
      );
      await skillsMatcher.suggestions.updateGoalsButton.click();

      await expect(page).toHaveURL(/\/user\/\d+\/skills-experience/);
      await expect(
        goals.message('Successfully updated your Career Goals.'),
      ).toBeVisible();

      await goals.goto();
      await expect(goals.goal(added.soc)).toBeVisible();
      await expect(goals.goal(added.soc)).toContainText(added.title);
    });

    test('JT-2: Remove a career from goals', async ({ page }) => {
      expect(added, 'JT-1 should have added a career').toBeDefined();
      const goals = new CareerGoalsPage(page);
      await goals.goto();
      await expect(goals.goal(added!.soc)).toBeVisible();

      await goals.remove(added!.soc);
      await expect(goals.goal(added!.soc)).toHaveCount(0);
      added = undefined;
    });
  });

  test('JT-5: Save a career from Explore Careers', async ({ page }) => {
    const SOC = '29-1141.00';
    const TITLE = 'Registered Nurses';
    const goals = new CareerGoalsPage(page);
    // A run that stopped before its cleanup can leave this career behind;
    // the button would then read "Remove from career goals".
    await goals.cleanUp([SOC]);
    await goals.expectRoom(1);

    try {
      await page.goto('/explore/careers');
      const main = page.getByRole('main');
      await main
        .getByLabel('Search by career title or keyword')
        .fill('Nursing');
      await main.getByRole('button', { name: 'Search', exact: true }).click();

      // "Learn more about …" opens the career in a new tab.
      const [tab] = await Promise.all([
        page.context().waitForEvent('page'),
        main.getByRole('link', { name: `Learn more about ${TITLE}` }).click(),
      ]);
      const career = new CareerDetailPage(tab, TITLE);
      await expect(career.heading).toBeVisible();
      expect(new URL(tab.url()).pathname).toBe(`/explore/careers/${SOC}`);

      // The site confirms with an alert, then opens My Goals & Experience.
      const alert = tab.waitForEvent('dialog');
      await career.main
        .getByRole('button', { name: 'Add to career goals' })
        .click();
      const dialog = await alert;
      expect(dialog.message()).toBe('Career goal has been added!');
      await dialog.accept();
      await expect(tab).toHaveURL(/\/user\/\d+\/skills-experience/);

      const tabGoals = new CareerGoalsPage(tab);
      await tabGoals.waitForGoals();
      await expect(tabGoals.goal(SOC)).toBeVisible();
      await expect(tabGoals.goal(SOC)).toContainText(TITLE);
    } finally {
      await goals.cleanUp([SOC]);
    }
  });
});
