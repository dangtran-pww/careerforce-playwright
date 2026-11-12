import { test, expect } from '../fixtures';
import { useRole } from '../../../helpers/roles';
import {
  KEYWORD,
  checkAccountUnchanged,
  expectJobSeekerTools,
} from './helpers';

// [Functional] - Job Search - Logged-in Job Seeker - Test Plan, LI-1.
// See test-suites/job-search/functional-job-search-logged-in.md.

test.describe(
  'the page as a job seeker',
  { tag: ['@no-prod', '@desktop-only'] },
  () => {
    useRole('jobseeker');
    checkAccountUnchanged();

    test("LI-1: Job Search shows the job seeker's own tools", async ({
      page,
    }) => {
      const tracker = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return (
          url.pathname === '/careerforce/jobseeker-tools-tracker' &&
          url.searchParams.get('active_path') === '/job-search'
        );
      });
      await page.goto(`/job-search?title=${KEYWORD}`);

      await expectJobSeekerTools(page);

      await test.step('the tools tracker is told about the visit', async () => {
        const response = await tracker;
        expect(response.status(), 'tracker answers 2xx').toBeGreaterThanOrEqual(
          200,
        );
        expect(response.status(), 'tracker answers 2xx').toBeLessThan(300);
      });
    });
  },
);
