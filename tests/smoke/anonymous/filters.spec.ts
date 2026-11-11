import { test, expect } from '../../helpers/fixtures';
import { expectFilterPairDiffers, type Results } from '../../helpers/results';
import { EventsSearchPage } from '../../pages/events-search.page';
import { SearchPage } from '../../pages/search.page';

// [Smoke] - Public Site - General - Test Plan, FL-1 to FL-4, FL-7, FL-8.
// See test-plans/smoke-public-site.md. FL-5 and FL-6 (Job Search) moved to
// test-plans/smoke-job-search.md as JF-1 and JF-2.
//
// Given: an anonymous visitor on a filterable listing
// When: they open it with no filter, then with filter X, then with filter Y
// Then: X and Y each show no more than the unfiltered list, and X and Y show
//       different results (a different total, or different items on the
//       first page). An empty result is fine; identical results are not.
//
// Every filter here is a GET form, so the tests open the filtered URL
// instead of clicking through the form. Exact counts are never checked,
// because content changes.
//
// The filtering happens on the server and is the same on any device, so
// these run on desktop only.

test.describe('filters', { tag: '@desktop-only' }, () => {
  const EVENT_FILTERS = [
    {
      id: 'FL-1',
      title: 'Events: Online and In Person formats give different results',
      x: { name: 'Online', param: 'ff[virtual]', value: 'virtual' },
      y: { name: 'In Person', param: 'ff[in_person]', value: 'in_person' },
    },
    {
      id: 'FL-2',
      title: 'Events: Resumes and Job Search topics give different results',
      x: { name: 'Resumes', param: 'ft[791]', value: '791' },
      y: { name: 'Job Search', param: 'ft[789]', value: '789' },
    },
    {
      id: 'FL-3',
      title: 'Events: Workshop and Job Club event types give different results',
      x: { name: 'Workshop', param: 'fy[785]', value: '785' },
      y: { name: 'Job Club', param: 'fy[783]', value: '783' },
    },
  ];

  for (const { id, title, x, y } of EVENT_FILTERS) {
    test(`${id}: ${title}`, async ({ page }) => {
      const events = new EventsSearchPage(page);
      await events.search();
      const all = await events.results();

      await events.search({ [x.param]: x.value });
      await expect(events.filterCheckbox(x.param)).toBeChecked();
      const xResults = await events.results();

      await events.search({ [y.param]: y.value });
      await expect(events.filterCheckbox(y.param)).toBeChecked();
      const yResults = await events.results();

      expectFilterPairDiffers(all, xResults, yResults, [x.name, y.name]);
    });
  }

  test('FL-4: Programs and Services: two keywords give different results', async ({
    page,
  }) => {
    const programs = new SearchPage(page, '/programs-services', 'keyword', 'article h3 a');
    await programs.searchWith({});
    const all = await programs.results();

    const found: Record<string, string[]> = {};
    const results: Results[] = [];
    for (const keyword of ['veterans', 'youth']) {
      await programs.searchWith({ keyword });
      await expect(page.locator('main input[name="keyword"]')).toHaveValue(keyword);
      const result = await programs.results();
      found[keyword] = result.items;
      results.push(result);
    }

    expectFilterPairDiffers(all, results[0], results[1], ['veterans', 'youth']);
    // The service named after the keyword should be among the results.
    expect(found.veterans.some((t) => /veteran/i.test(t)), `"veterans" titles: ${found.veterans}`).toBe(true);
    expect(found.youth.some((t) => /youth/i.test(t)), `"youth" titles: ${found.youth}`).toBe(true);
  });

  test('FL-7: Site search: newest and oldest first give a different order', async ({
    page,
  }) => {
    const search = new SearchPage(page, '/search', 'k');
    const keyword = { k: 'job' };
    await search.searchWith(keyword);
    const all = await search.results();

    const byDate = { ...keyword, sort_by: 'field_article_date' };
    await search.searchWith({ ...byDate, sort_order: 'DESC' });
    await expect(page.locator('main select[name="sort_order"]')).toHaveValue('DESC');
    const newest = await search.results();
    await search.searchWith({ ...byDate, sort_order: 'ASC' });
    await expect(page.locator('main select[name="sort_order"]')).toHaveValue('ASC');
    const oldest = await search.results();

    // Sorting changes the order, never the number of results.
    expect(newest.total).toBe(all.total);
    expect(oldest.total).toBe(all.total);
    expectFilterPairDiffers(all, newest, oldest, ['newest first', 'oldest first']);
  });

  test('FL-8: Training programs: virtual and not virtual give different results', async ({
    page,
  }) => {
    const training = new SearchPage(page, '/training-programs', 'keyword', 'article h3 a');
    await training.searchWith({});
    const all = await training.results();

    // Virtual/Hybrid "True" and "False" split the programs in two, so they
    // can't give the same programs while there's at least 1 program.
    await training.searchWith({ field_virtual: '1' });
    await expect(page.locator('main select[name="field_virtual"]')).toHaveValue('1');
    const virtual = await training.results();
    await training.searchWith({ field_virtual: '0' });
    await expect(page.locator('main select[name="field_virtual"]')).toHaveValue('0');
    const notVirtual = await training.results();

    expectFilterPairDiffers(all, virtual, notVirtual, ['virtual', 'not virtual']);
  });
});
