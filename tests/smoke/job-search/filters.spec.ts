import { test, expect } from '../../helpers/fixtures';
import { expectFilterPairDiffers, type Results } from '../../helpers/results';
import { JobSearchPage } from '../../pages/job-search.page';

// [Smoke] - Job Search - Test Plan, JF-1 and JF-2 (filters).
// See test-plans/smoke-job-search.md. These were FL-5 and FL-6 in
// test-plans/smoke-public-site.md.
//
// Given: an anonymous visitor on Job Search, searching "nurse"
// When: they filter by one company (or city), then by another
// Then: each filter shows no more jobs than the unfiltered search, every job
//       listed belongs to the chosen company (or city), and the two filters
//       show different jobs.
//
// Every filter is in the page address (a GET form), so the tests open the
// filtered URL instead of clicking through the form. The filtering happens
// on the server and is the same on any device, so these run on desktop only.

test.describe('job search filters', { tag: '@desktop-only' }, () => {
  // JF-1/JF-2: the jobs come from an outside feed, so the two companies or
  // cities to compare are the two with the most jobs in the dropdown right
  // now, read from the unfiltered page.
  const JOB_FILTERS = [
    { id: 'JF-1', label: 'company', param: 'company', select: 'companySelect' },
    { id: 'JF-2', label: 'city', param: 'loc', select: 'citySelect' },
  ] as const;

  for (const { id, label, param, select } of JOB_FILTERS) {
    test(`${id}: two ${label} filters give different jobs`, async ({ page }) => {
      const jobs = new JobSearchPage(page);
      const keyword = { title: 'nurse' };
      await jobs.search(keyword);
      const all = await jobs.results();
      const options = await jobs.topOptions(jobs[select], 2);
      expect(options, `the ${label} dropdown should list at least 2 choices`).toHaveLength(2);

      const results: Results[] = [];
      for (const option of options) {
        await test.step(`${label}: ${option.name}`, async () => {
          await jobs.search({ ...keyword, [param]: option.value });
          await expect(jobs[select]).toHaveValue(option.value);
          // Each job on the page belongs to the chosen company or city.
          for (const card of await jobs.cards.all()) {
            await expect(card).toContainText(option.name);
          }
          results.push(await jobs.results());
        });
      }

      expectFilterPairDiffers(all, results[0], results[1], [
        options[0].name,
        options[1].name,
      ]);
    });
  }
});
