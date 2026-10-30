import { test, expect } from '../../helpers/fixtures';
import { SkillsMatcherPage } from '../../pages/skills-matcher.page';
import { InterestProfilerPage } from '../../pages/interest-profiler.page';
import { EmploymentReadinessPage } from '../../pages/employment-readiness.page';

// [Smoke] - Anonymous - Test Plan, CT-1/CT-2/CT-3.
// See test-plans/smoke-anonymous.md.
//
// All three tools work for an anonymous visitor; none of this persists
// anything server-side for an anon session. Stop short of "add to goals" /
// saving results, which needs an account and is out of this plan's scope.

test('CT-1: Skills Matcher loads and accepts input', async ({ page }) => {
  const skillsMatcher = new SkillsMatcherPage(page);
  await skillsMatcher.goto();
  await skillsMatcher.answerSkills();
  await skillsMatcher.submit();
  await expect(skillsMatcher.resultsHeading).toBeVisible();
});

test('CT-2: Interest Profiler completes and scores', async ({ page }) => {
  const interestProfiler = new InterestProfilerPage(page);
  await interestProfiler.goto();
  await interestProfiler.answerAll();
  await interestProfiler.submit();
  await expect(interestProfiler.resultsHeading).toBeVisible();
});

test('CT-3: Employment Readiness Assessment entry page loads without login', async ({
  page,
}) => {
  const employmentReadiness = new EmploymentReadinessPage(page);
  await employmentReadiness.goto();
  await expect(employmentReadiness.heading).toBeVisible();
});
