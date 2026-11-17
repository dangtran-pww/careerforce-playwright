import { test, expect } from '../../helpers/fixtures';
import { useRole } from '../../helpers/roles';
import { CareerGoalsPage } from '../../pages/career-goals.page';
import { EmploymentReadinessPage } from '../../pages/employment-readiness.page';
import { InterestProfilerPage } from '../../pages/interest-profiler.page';

// [Smoke] - Job Seeker Tools - Test Plan, JT-3 and JT-4 (assessments as a
// job seeker). See test-suites/smoke/smoke-jobseeker-tools.md.
//
// Logged in as the job seeker. The Interest Profiler saves its answers on the
// account (My Goals & Experience then offers "See my interest profiler
// results"); the Employment Readiness Assessment saves nothing and only shows
// its results in a printable tab. Both are no-prod in the plan (@no-prod) and
// run on desktop only (@desktop-only). Nothing to clean up: the saved
// Interest Profiler answers are replaced by the next run ("Start Over").

test.describe('assessments', { tag: ['@no-prod', '@desktop-only'] }, () => {
  useRole('jobseeker');

  test('JT-3: Interest Profiler as a job seeker', async ({ page }) => {
    const interestProfiler = new InterestProfilerPage(page);
    // goto() clicks "Start Over" if answers are saved from an earlier run, so
    // the check on My Goals & Experience is about this run's answers.
    await interestProfiler.goto();
    await interestProfiler.answerAll();
    await interestProfiler.submit();
    await expect(interestProfiler.resultsHeading).toBeVisible();

    const goals = new CareerGoalsPage(page);
    await goals.goto();
    const card = goals.toolCard('interest-profiler');
    await expect(card).toContainText('See my interest profiler results');
    await expect(
      card.getByRole('link', { name: 'View careers' }),
    ).toBeVisible();
  });

  test('JT-4: Employment Readiness Assessment as a job seeker', async ({
    page,
  }) => {
    const employmentReadiness = new EmploymentReadinessPage(page);
    await employmentReadiness.goto();
    await expect(employmentReadiness.heading).toBeVisible();

    const answered = await employmentReadiness.answerAll();
    expect(answered, 'the assessment should have 12 questions').toBe(12);
    await expect(employmentReadiness.recommendations.first()).toBeVisible();

    const results = await employmentReadiness.openPrintableResults();
    await expect(EmploymentReadinessPage.resultsHeading(results)).toBeVisible();
  });
});
