import { test, expect } from '../../helpers/fixtures';
import { expectFilterPairDiffers } from '../../helpers/results';
import { EventsSearchPage } from '../../pages/events-search.page';

// [Smoke] - Events - Test Plan, EP-5 to EP-7 (were FL-1 to FL-3 in
// smoke-public-site.md). See test-suites/smoke/smoke-events.md.
//
// Given: an anonymous visitor on the Events page
// When: they open it with no filter, then with filter X, then with filter Y
// Then: X and Y each show no more than the unfiltered list, and X and Y show
//       different results (a different total, or different events on the
//       first page). An empty result is fine; identical results are not.
//
// Every filter is a GET form, so the tests open the filtered URL instead of
// clicking through the form. Exact counts are never checked, because
// content changes.
//
// The filtering happens on the server and is the same on any device, so
// these run on desktop only.

test.describe('events filters', { tag: '@desktop-only' }, () => {
  const EVENT_FILTERS = [
    {
      id: 'EP-5',
      title: 'Events: Online and In Person formats give different results',
      x: { name: 'Online', param: 'ff[virtual]', value: 'virtual' },
      y: { name: 'In Person', param: 'ff[in_person]', value: 'in_person' },
    },
    {
      id: 'EP-6',
      title: 'Events: Resumes and Job Search topics give different results',
      x: { name: 'Resumes', param: 'ft[791]', value: '791' },
      y: { name: 'Job Search', param: 'ft[789]', value: '789' },
    },
    {
      id: 'EP-7',
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
});
