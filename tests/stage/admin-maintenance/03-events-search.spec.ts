import { test, expect } from '@playwright/test';
import { EventsSearchPage, type EventsQuery } from '../../pages/events-search.page';
import { addDays, siteDate } from '../../helpers/dates';

// [Smoke] - Admin Maintenance - Test Plan — AM-4. See
// test-plans/smoke-admin-maintenance.md, "Events search sort and filter cases".
//
// Assertions compare against the unfiltered count and against what's on the
// cards — never fixed numbers — so they hold as events come and go.

test.use({ storageState: 'playwright/.auth/admin.json' });

async function countFor(events: EventsSearchPage, query: EventsQuery) {
  await events.search(query);
  return events.resultCount();
}

test.describe('AM-4: events search sort and filters', () => {
  let unfiltered = 0;

  test.beforeEach(async ({ page }) => {
    unfiltered = await countFor(new EventsSearchPage(page), {});
    expect(unfiltered, 'unfiltered events search is empty').toBeGreaterThan(0);
  });

  const narrowing: { name: string; query: EventsQuery }[] = [
    { name: 'topic filter (Job Search)', query: { 'ft[789]': '789' } },
    { name: 'event type: Job Club', query: { 'fy[783]': '783' } },
    { name: 'event type: Workshop', query: { 'fy[785]': '785' } },
    {
      name: 'location radius (55401, 10 mi)',
      query: { 'fp[loc][text]': '55401', 'fp[radius]': '16.09' },
    },
  ];
  for (const { name, query } of narrowing) {
    test(name, async ({ page }) => {
      const count = await countFor(new EventsSearchPage(page), query);
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThanOrEqual(unfiltered);
    });
  }

  test('format: Online', async ({ page }) => {
    const events = new EventsSearchPage(page);
    const count = await countFor(events, { 'ff[virtual]': 'virtual' });
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(unfiltered);
    const locations = await events.cardLocationTexts();
    expect(locations.length).toBeGreaterThan(0);
    for (const location of locations) {
      expect(location).toContain('Online');
    }
  });

  test('date range (today to +30 days)', async ({ page }) => {
    const events = new EventsSearchPage(page);
    const from = siteDate();
    const to = addDays(from, 30);
    await events.search({ fs: from, fe: to });
    const dates = await events.cardDateTimes();
    expect(dates.length, 'no events in the next 30 days').toBeGreaterThan(0);
    for (const dt of dates) {
      const day = dt.slice(0, 10);
      expect(day >= from && day <= to, `card date ${day} outside ${from}..${to}`).toBeTruthy();
    }
  });

  test('featured statewide event', async ({ page }) => {
    // No featured events on QA at the time of writing — either outcome passes.
    const events = new EventsSearchPage(page);
    await events.search({ fa: '605' });
    await expect(events.cardDates.first().or(events.emptyMessage)).toBeVisible();
  });

  test('keyword + filter combined', async ({ page }) => {
    const events = new EventsSearchPage(page);
    const keywordOnly = await countFor(events, { fq: 'job' });
    const combined = await countFor(events, { fq: 'job', 'fy[783]': '783' });
    expect(combined).toBeLessThanOrEqual(keywordOnly);
  });

  test('sort: Relevance', async ({ page }) => {
    const events = new EventsSearchPage(page);
    const count = await countFor(events, { fq: 'job', sort_by: 'sr' });
    expect(count).toBeGreaterThan(0);
    const times = (await events.cardDateTimes()).map((dt) => Date.parse(dt));
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  test('sort: Distance with location', async ({ page }) => {
    const events = new EventsSearchPage(page);
    const count = await countFor(events, {
      fq: 'job',
      'fp[loc][text]': 'Minneapolis',
      'fp[radius]': '160.93',
      sort_by: 'sp',
    });
    expect(count).toBeGreaterThan(0);
    expect((await events.cardLocationTexts())[0]).toContain('Minneapolis');
  });

  test('no match', async ({ page }) => {
    const events = new EventsSearchPage(page);
    await events.search({ fq: 'zzzxqqnomatch' });
    await expect(events.emptyMessage).toContainText('No results found.');
    await expect(events.cardDates).toHaveCount(0);
  });
});
