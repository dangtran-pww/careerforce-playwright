import { test, expect } from '../../helpers/fixtures';
import { useRole } from '../../helpers/roles';
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
// test-suites/smoke/smoke-admin-maintenance.md.
//
// AM-2 empties and refills each search index, so run off-peak on QA/stage
// only. Rebuild and reindex stay in one test per index so a failure never
// leaves an index empty unnoticed. AM-3 then checks every search backed by
// those indexes actually returns results.

useRole('admin');

const INDEXES = [
  { label: 'Appointment Occurrences', machineName: 'appointment_occurrences' },
  { label: 'Events More Like This', machineName: 'events_mlt' },
  { label: 'General site content index', machineName: 'general_site_content' },
  { label: 'Occupations', machineName: 'occupations' },
];

// Occupations is ~35k items; a full reindex takes minutes.
const BATCH_TIMEOUT = 25 * 60_000;

test.describe('AM-2: rebuild tracking and reindex', { tag: '@no-prod' }, () => {
  for (const { label, machineName } of INDEXES) {
    test(`AM-2: ${label}`, async ({ page }) => {
      test.setTimeout(2 * BATCH_TIMEOUT + 60_000);
      const index = new SearchApiIndexPage(page, machineName);

      const indexNow = page.getByRole('button', { name: 'Index now' });

      // 1. Fully indexed before the run, so "Index now" has nothing to do.
      await index.goto();
      const before = await index.progress();
      expect(
        before.total,
        `"${label}" progress before the run: "${before.text}"`,
      ).toBeGreaterThan(0);
      expect(before.indexed, before.text).toBe(before.total);
      await expect(indexNow).toBeDisabled();

      // 2. Rebuild tracking: confirm page, then back on the index page.
      await index.openRebuildTracker();
      await expect(
        page.getByText(
          `Are you sure you want to rebuild the tracking data for the search index ${label}?`,
        ),
      ).toBeVisible();
      await index.confirmRebuildTracker(BATCH_TIMEOUT);
      await expect(index.statusMessages).toBeVisible();
      await expect(index.errorMessages).toHaveCount(0);
      const afterRebuild = await index.progress();
      expect(
        afterRebuild.total,
        `"${label}" progress after rebuild tracking: "${afterRebuild.text}"`,
      ).toBeGreaterThan(0);
      expect(afterRebuild.indexed, afterRebuild.text).toBe(0);
      await expect(indexNow).toBeEnabled();

      // 3. Index now: the batch reports back, and everything is indexed.
      // While cron indexes, it holds the index's lock, so a batch pass
      // indexes 0 items and Search API ends the batch early with the warning
      // "Number of indexed items is less than expected". Click Index now
      // again, as an admin would, as long as each run makes progress.
      let afterIndex = afterRebuild;
      for (let run = 1; afterIndex.indexed < afterIndex.total; run++) {
        expect(run, `"${label}" still not indexed after 5 runs: "${afterIndex.text}"`).toBeLessThanOrEqual(5);
        await index.indexNow(BATCH_TIMEOUT);
        await expect(index.statusMessages).toBeVisible();
        await expect(index.errorMessages).toHaveCount(0);
        await index.goto();
        const previous = afterIndex;
        afterIndex = await index.progress();
        expect(
          afterIndex.indexed,
          `"${label}" Index now run ${run} made no progress: "${previous.text}" → "${afterIndex.text}"`,
        ).toBeGreaterThan(previous.indexed);
      }
      expect(afterIndex.indexed, afterIndex.text).toBe(afterIndex.total);
      expect(afterIndex.total).toBeGreaterThan(0);
      expect(
        await index.statusRowHasError(),
        `"${label}" index status row shows an error`,
      ).toBeFalsy();
    });
  }
});

test.describe('AM-3: searches work after reindex', { tag: '@no-prod' }, () => {
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

  // Filters: only relations to the unfiltered results, never fixed counts.
  test('events search Format Online returns online events', async ({ page }) => {
    const events = new EventsSearchPage(page);
    await events.search();
    const unfiltered = await events.resultCount();

    await events.search({ 'ff[virtual]': 'virtual' });
    const online = await events.resultCount();
    expect(online, 'no online events after reindex').toBeGreaterThan(0);
    expect(online).toBeLessThanOrEqual(unfiltered);
    const locations = await events.cardLocationTexts();
    expect(locations.length).toBeGreaterThan(0);
    for (const location of locations) {
      expect(location).toContain('Online');
    }
  });

  test('appointments search has a bookable slot, and a format filter keeps it', async ({
    page,
  }) => {
    test.setTimeout(3 * 60_000);
    const appointments = new AppointmentsSearchPage(page);
    const found = await appointments.findDay(
      siteDate(),
      (slots) => slots.length > 0,
    );
    expect(
      found,
      'no day in the appointments date strip shows a bookable slot',
    ).not.toBeNull();
    const first = found!.slots[0];
    expect(first.href).toMatch(/\/appointments\/\d+\/booking/);

    const format = first.formats[0];
    expect(format, `first slot ${first.href} lists no format`).toBeTruthy();
    await appointments.search({ start: found!.day, formats: [format] });
    const filtered = await appointments.slots();
    expect(filtered.length, `no ${format} slots on ${found!.day}`).toBeGreaterThan(0);
    expect(filtered.length).toBeLessThanOrEqual(found!.slots.length);
    for (const slot of filtered) {
      expect(slot.formats, `${slot.href} shown for ${format}`).toContain(format);
    }
  });

  test('similar events show on at least one of 10 random events', async ({
    page,
  }) => {
    test.setTimeout(5 * 60_000);
    const links = await new EventsSearchPage(page).allEventLinks();
    expect(
      links.length,
      'events search returned no event links',
    ).toBeGreaterThan(0);

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
      expect(
        ids.length,
        `event ${id}: Similar Events block has no event links`,
      ).toBeGreaterThan(0);
      for (const linked of ids) {
        expect(
          linked,
          `event ${id}: similar-event link has no event id`,
        ).not.toBe('');
        expect(linked, `event ${id}: Similar Events links to itself`).not.toBe(
          id,
        );
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
