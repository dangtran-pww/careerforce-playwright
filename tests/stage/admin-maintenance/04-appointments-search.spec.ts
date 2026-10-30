import { test, expect } from '../../helpers/fixtures';
import {
  AppointmentsSearchPage,
  type Format,
  type Slot,
} from '../../pages/appointments-search.page';
import { addDays, longDate, siteDate, weekday } from '../../helpers/dates';

// [Smoke] - Admin Maintenance - Test Plan — AM-5. See
// test-plans/smoke-admin-maintenance.md, "Appointments search cases".
//
// Uses whatever slots QA already has — the tests never create appointments
// and never submit a booking. Cases that need a particular kind of day skip
// (not fail) when the strip has none; AM-3 is what catches "no appointments
// at all". Assertions only relate filtered results to the same day's
// unfiltered results, never fixed counts or location names.

test.use({ storageState: 'playwright/.auth/admin.json' });

const TEN_MILES_KM = '16.09';
const REMOTE: Format[] = ['online', 'phone'];

const hrefs = (slots: Slot[]) => slots.map((s) => s.href);
const isRemote = (s: Slot) => s.formats.some((f) => REMOTE.includes(f));
// A city far (> 10 mi) from `city`, for radius checks.
const farFrom = (city: string) => (city === 'Duluth' ? 'Bloomington' : 'Duluth');

test.describe('AM-5: appointments search date strip and filters', () => {
  test.describe.configure({ timeout: 3 * 60_000 });

  let today: string;
  test.beforeEach(() => {
    today = siteDate();
  });

  // Date strip ---------------------------------------------------------

  test('default day', async ({ page }) => {
    const appts = new AppointmentsSearchPage(page);
    await appts.search();
    await expect(appts.heading).toContainText(longDate(today));

    const pastDays = appts.strip.locator('li.past-date');
    for (let i = 0; i < (await pastDays.count()); i++) {
      await expect(pastDays.nth(i)).toHaveAttribute('aria-disabled', 'true');
    }
    await expect(
      appts.strip.locator(`a[href*="start=${today}"]`),
      'today should be the selected day (no link)',
    ).toHaveCount(0);
    await expect(appts.cards.first().or(appts.emptyMessage)).toBeVisible();
  });

  test('pick a day', async ({ page }) => {
    const appts = new AppointmentsSearchPage(page);
    await appts.search();
    const [day] = await appts.linkedDays();
    test.skip(!day, 'no other selectable day in this week of the strip');

    await appts.strip.locator(`li.date-weekday a[href*="start=${day}"]`).click();
    await expect(page).toHaveURL(new RegExp(`start=${day}`));
    await expect(appts.heading).toContainText(longDate(day));
    await expect(appts.strip.locator(`a[href*="start=${day}"]`)).toHaveCount(0);
  });

  test('week navigation', async ({ page }) => {
    const appts = new AppointmentsSearchPage(page);
    await appts.search();
    await expect(appts.strip).toContainText('Previous Week, disabled');
    test.skip(
      (await appts.nextWeekLink().count()) === 0,
      'Next Week is disabled on the current week',
    );

    await appts.goNextWeek();
    const monday = appts.currentStart() ?? '';
    expect(weekday(monday), `start=${monday} should be a Monday`).toBe(1);
    expect(monday > today).toBeTruthy();
    await expect(appts.strip.locator('li.date-weekday')).toHaveCount(5);

    await appts.goPreviousWeek();
    await expect(appts.strip).toContainText('Previous Week, disabled');
  });

  test('booking window ends', async ({ page }) => {
    const appts = new AppointmentsSearchPage(page);
    await appts.search();
    for (let i = 0; i < 6 && (await appts.nextWeekLink().count()) > 0; i++) {
      await appts.goNextWeek();
    }
    await expect(appts.strip).toContainText('Next Week, disabled');
  });

  test('empty day beyond the booking window', async ({ page }) => {
    const appts = new AppointmentsSearchPage(page);
    await appts.search();
    for (let i = 0; i < 6 && (await appts.nextWeekLink().count()) > 0; i++) {
      await appts.goNextWeek();
    }
    const lastStart = appts.currentStart() ?? today;
    // Monday after the last reachable week.
    const beyond = addDays(lastStart, (8 - weekday(lastStart)) % 7 || 7);
    await appts.search({ start: beyond });
    await expect(appts.emptyMessage).toContainText(
      'There are no appointments available on this day',
    );
    await expect(appts.cards).toHaveCount(0);
  });

  // Format filters -----------------------------------------------------

  const singleFormats: { format: Format; label: string }[] = [
    { format: 'online', label: 'Online' },
    { format: 'phone', label: 'Phone' },
    { format: 'in_person', label: 'In person' },
  ];
  for (const { format, label } of singleFormats) {
    test(`format: ${label}`, async ({ page }) => {
      const appts = new AppointmentsSearchPage(page);
      const ref = await appts.findDay(today, (s) => s.length >= 2);
      test.skip(!ref, 'no day in the strip has 2+ slots');

      await appts.search({ start: ref!.day, formats: [format] });
      const filtered = await appts.slots();
      for (const slot of filtered) {
        expect(slot.formats, `${slot.href} shown for ${format}`).toContain(format);
      }
      expect(filtered.length).toBeLessThanOrEqual(ref!.slots.length);
    });
  }

  test('formats combined (online + phone)', async ({ page }) => {
    const appts = new AppointmentsSearchPage(page);
    const ref = await appts.findDay(today, (s) => s.length >= 2);
    test.skip(!ref, 'no day in the strip has 2+ slots');

    await appts.search({ start: ref!.day, formats: ['online'] });
    const online = (await appts.slots()).length;
    await appts.search({ start: ref!.day, formats: ['phone'] });
    const phone = (await appts.slots()).length;
    await appts.search({ start: ref!.day, formats: ['online', 'phone'] });
    const combined = await appts.slots();

    for (const slot of combined) {
      expect(isRemote(slot), `${slot.href} offers neither online nor phone`).toBeTruthy();
    }
    expect(combined.length).toBeGreaterThanOrEqual(Math.max(online, phone));
  });

  test('format filter hides a slot without that format', async ({ page }) => {
    const appts = new AppointmentsSearchPage(page);
    const all: Format[] = ['online', 'phone', 'in_person'];
    const ref = await appts.findDay(today, (s) => s.some((x) => x.formats.length < 3));
    test.skip(!ref, 'every slot in the strip offers all three formats');

    const slot = ref!.slots.find((x) => x.formats.length < 3)!;
    const missing = all.find((f) => !slot.formats.includes(f))!;
    await appts.search({ start: ref!.day, formats: [missing] });
    expect(hrefs(await appts.slots())).not.toContain(slot.href);
  });

  // Location and radius ------------------------------------------------

  test('location sorts by distance', async ({ page }) => {
    const appts = new AppointmentsSearchPage(page);
    const ref = await appts.findDay(
      today,
      (s) => new Set(s.map((x) => x.location)).size >= 2,
    );
    test.skip(!ref, 'no day in the strip has 2+ locations');

    await appts.search({ start: ref!.day });
    const names = await appts.locationNames();
    const last = names[names.length - 1];

    await appts.search({ start: ref!.day, location: last, radiusKm: TEN_MILES_KM });
    expect((await appts.locationNames())[0]).toBe(last);
  });

  test('radius hides distant in-person-only slots', async ({ page }) => {
    const appts = new AppointmentsSearchPage(page);
    const inPersonOnly = (s: Slot) => s.formats.length === 1 && s.formats[0] === 'in_person';
    const ref = await appts.findDay(today, (s) => s.some(inPersonOnly));
    test.skip(!ref, 'no in-person-only slot in the strip');

    const target = ref!.slots.find(inPersonOnly)!;
    await appts.search({
      start: ref!.day,
      location: farFrom(target.location),
      radiusKm: TEN_MILES_KM,
    });
    const far = hrefs(await appts.slots());
    expect(far, `in-person-only ${target.href} still shown far away`).not.toContain(target.href);
    for (const remote of ref!.slots.filter(isRemote)) {
      expect(far, `remote slot ${remote.href} hidden by radius`).toContain(remote.href);
    }

    await appts.search({ start: ref!.day, location: target.location, radiusKm: TEN_MILES_KM });
    expect(hrefs(await appts.slots())).toContain(target.href);
  });

  test('remote slots ignore radius', async ({ page }) => {
    const appts = new AppointmentsSearchPage(page);
    const ref = await appts.findDay(today, (s) => s.some(isRemote));
    test.skip(!ref, 'no online/phone slot in the strip');

    const remote = ref!.slots.filter(isRemote);
    await appts.search({
      start: ref!.day,
      location: farFrom(remote[0].location),
      radiusKm: TEN_MILES_KM,
    });
    const shown = hrefs(await appts.slots());
    for (const slot of remote) {
      expect(shown, `remote slot ${slot.href} hidden by radius`).toContain(slot.href);
    }
  });

  // Reset and booking link ---------------------------------------------

  test('reset clears filters', async ({ page }) => {
    const appts = new AppointmentsSearchPage(page);
    const ref = await appts.findDay(today, (s) => s.length > 0);
    test.skip(!ref, 'no day in the strip has a slot');

    await appts.search({
      start: ref!.day,
      formats: ['phone'],
      location: 'Duluth',
      radiusKm: TEN_MILES_KM,
    });
    // Reset also drops `start`, so it lands on today's unfiltered results.
    await appts.clickAndWait(
      page.getByRole('button', { name: 'Reset' }).filter({ visible: true }).first(),
    );
    await expect(page).not.toHaveURL(/format%5B|format\[/);
    await expect(page).not.toHaveURL(/location%5Bloc%5D%5Btext%5D=[^&]|location\[loc\]\[text\]=[^&]/);

    const after = hrefs(await appts.slots());
    await appts.search({ start: appts.currentStart() ?? undefined });
    expect(after).toEqual(hrefs(await appts.slots()));
  });

  test('booking link target', async ({ page }) => {
    const appts = new AppointmentsSearchPage(page);
    const ref = await appts.findDay(today, (s) => s.length > 0);
    test.skip(!ref, 'no day in the strip has a slot');

    const href = ref!.slots[0].href;
    expect(href).toMatch(/\/appointments\/\d+\/booking$/);
    // Open the booking page, never submit it — that would book for real.
    const response = await page.goto(href);
    expect(response?.status()).toBeLessThan(400);
  });
});
