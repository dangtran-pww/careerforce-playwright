import { test, expect } from '../../helpers/fixtures';
import { SkillsMatcherPage } from '../../pages/skills-matcher.page';
import { InterestProfilerPage } from '../../pages/interest-profiler.page';
import { EmploymentReadinessPage } from '../../pages/employment-readiness.page';

// [Smoke] - Job Seeker Tools - Test Plan, JT-6 to JT-8 (were CT-1 to CT-3
// in smoke-public-site.md). See test-suites/smoke/smoke-jobseeker-tools.md.
//
// All three tools work for an anonymous visitor; none of this persists
// anything server-side for an anon session. Stop short of "add to goals" /
// saving results, which needs an account: JT-1 to JT-5, logged in.

test('JT-6: Skills Matcher loads and accepts input', async ({ page }) => {
  const skillsMatcher = new SkillsMatcherPage(page);
  await skillsMatcher.goto();
  await skillsMatcher.answerSkills();
  await skillsMatcher.submit();
  await expect(skillsMatcher.resultsHeading).toBeVisible();
});

test('JT-7: Interest Profiler completes and scores', async ({ page }) => {
  const interestProfiler = new InterestProfilerPage(page);
  await interestProfiler.goto();
  await interestProfiler.answerAll();
  await interestProfiler.submit();
  await expect(interestProfiler.resultsHeading).toBeVisible();
});

test('JT-8: Employment Readiness Assessment entry page loads without login', async ({
  page,
}) => {
  const employmentReadiness = new EmploymentReadinessPage(page);
  await employmentReadiness.goto();
  await expect(employmentReadiness.heading).toBeVisible();
});
