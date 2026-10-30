import { test, expect } from '../../helpers/fixtures';
import { SearchApiIndexPage } from '../../pages/search-api-index.page';
import { SearchPage } from '../../pages/search.page';
import {
  EventsSearchPage,
  SimilarEventsBlock,
  eventIdFromHref,
} from '../../pages/events-search.page';
import { AppointmentsSearchPage } from '../../pages/appointments-search.page';
import { siteDate } from '../../helpers/dates';

// [Smoke] - Admin Maintenance - Test Plan — AM-2, AM-3. See
// test-plans/smoke-admin-maintenance.md.
//
// AM-2 empties and refills each search index, so run off-peak on QA/stage
// only. Rebuild and reindex stay in one test per index so a failure never
// leaves an index empty unnoticed. AM-3 then checks every search backed by
// those indexes actually returns results.

test.use({ storageState: 'playwright/.auth/admin.json' });

const INDEXES = [
  { label: 'Appointment Occurrences', machineName: 'appointment_occurrences' },
  { label: 'Events More Like This', machineName: 'events_mlt' },
  { label: 'General site content index', machineName: 'general_site_content' },
  { label: 'Occupations', machineName: 'occupations' },
];

// Occupations is ~26k items; a full reindex takes minutes.
const BATCH_TIMEOUT = 25 * 60_000;

test.describe('AM-2: rebuild tracking and reindex', () => {
  for (const { label, machineName } of INDEXES) {
    test(`AM-2: ${label}`, async ({ page }) => {
      test.setTimeout(2 * BATCH_TIMEOUT + 60_000);
      const index = new SearchApiIndexPage(page, machineName);

      await index.goto();
      await index.rebuildTracking(BATCH_TIMEOUT);
      const afterRebuild = await index.progress();
      expect(
        afterRebuild.total,
        `"${label}" progress after rebuild tracking: "${afterRebuild.text}"`,
      ).toBeGreaterThan(0);
      expect(afterRebuild.indexed, afterRebuild.text).toBe(0);

      await index.indexNow(BATCH_TIMEOUT);
      await index.goto();
      const afterIndex = await index.progress();
      expect(
        afterIndex.indexed,
        `"${label}" progress after Index now: "${afterIndex.text}"`,
      ).toBe(afterIndex.total);
      expect(afterIndex.total).toBeGreaterThan(0);
      expect(
        await index.statusRowHasError(),
        `"${label}" index status row shows an error`,
      ).toBeFalsy();
    });
  }
});

test.describe('AM-3: searches work after reindex', () => {
  test('site search "job fair" returns results', async ({ page }) => {
    const search = new SearchPage(page, '/search', 'k');
    await search.search('job fair');
    expect(await search.resultCount()).toBeGreaterThan(0);
  });

  for (const keyword of ['', 'job club', 'job search']) {
    test(`events search ${keyword ? `"${keyword}"` : '(no keyword)'} returns results`, async ({
      page,
    }) => {
      const events = new EventsSearchPage(page);
      await events.search(keyword ? { fq: keyword } : {});
      expect(await events.resultCount()).toBeGreaterThan(0);
      await expect(events.cardDates.first()).toBeVisible();
    });
  }

  test('appointments search has a bookable slot within the date strip', async ({
    page,
  }) => {
    const appointments = new AppointmentsSearchPage(page);
    const found = await appointments.findDay(
      siteDate(),
      (slots) => slots.length > 0,
    );
    expect(
      found,
      'no day in the appointments date strip shows a bookable slot',
    ).not.toBeNull();
    expect(found!.slots[0].href).toMatch(/\/appointments\/\d+\/booking/);
  });

  test('similar events show on at least one of 10 random events', async ({
    page,
  }) => {
    test.setTimeout(5 * 60_000);
    const links = await new EventsSearchPage(page).allEventLinks();
    expect(links.length, 'events search returned no event links').toBeGreaterThan(0);

    const picked = [...links].sort(() => Math.random() - 0.5).slice(0, 10);
    test.info().annotations.push({
      type: 'picked events',
      description: picked.map(eventIdFromHref).join(', '),
    });

    const withSimilar: string[] = [];
    for (const href of picked) {
      const id = eventIdFromHref(href);
      await page.goto(href);
      const similar = new SimilarEventsBlock(page);
      if ((await similar.block.count()) === 0) continue;

      const ids = await similar.linkedEventIds();
      expect(ids.length, `event ${id}: Similar Events block has no event links`).toBeGreaterThan(0);
      for (const linked of ids) {
        expect(linked, `event ${id}: similar-event link has no event id`).not.toBe('');
        expect(linked, `event ${id}: Similar Events links to itself`).not.toBe(id);
      }
      withSimilar.push(id);
    }

    expect(
      withSimilar.length,
      `none of the picked events (${picked.map(eventIdFromHref).join(', ')}) show Similar Events`,
    ).toBeGreaterThan(0);
  });

  for (const keyword of ['taxi driver', 'nurse', 'project manager']) {
    test(`occupations "${keyword}" returns results`, async ({ page }) => {
      const careers = new SearchPage(page, '/explore/careers', 'otitle');
      await careers.search(keyword);
      expect(await careers.resultCount()).toBeGreaterThan(0);
    });
  }
});
