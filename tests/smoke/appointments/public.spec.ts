import { test, expect } from '../../helpers/fixtures';
import { addDays, longDate, siteDate, weekday } from '../../helpers/dates';
import { APPOINTMENTS_PATH, AppointmentsSearchPage } from '../../pages/appointments-search.page';

// [Smoke] - Appointments - Test Plan, AP-1 and AP-2: what a visitor sees in
// the appointment search. Read-only, prod-safe. See
// test-suites/smoke/smoke-appointments.md.

test('AP-1: Appointment search lists open times', async ({ page, isMobile }) => {
  const search = new AppointmentsSearchPage(page);
  const D = siteDate();
  // At the weekend the search opens on the next Monday.
  const firstDay = weekday(D) === 6 ? addDays(D, 2) : weekday(D) === 0 ? addDays(D, 1) : D;

  await test.step('1. the page', async () => {
    await page.goto(APPOINTMENTS_PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Schedule an Appointment');
    // The filters and the strip are in a drawer on a phone.
    const filters = page.locator('form').filter({ hasText: 'Distance From' }).first();
    for (const label of ['Location', 'Distance From', 'Format']) {
      const text = filters.getByText(label, { exact: true }).first();
      if (isMobile) await expect(text).toBeAttached();
      else await expect(text).toBeVisible();
    }
    const days = search.strip.locator('li.date-weekday');
    await expect(days).toHaveCount(5);
    await expect(search.heading).toHaveText(`Available appointments for ${longDate(firstDay)}`);
  });

  await test.step('2. a location card with times', async () => {
    const found = await search.findDay(D, (slots) => slots.length > 0);
    expect(found, 'a day in the strip (or the next weeks) with at least 1 time').toBeTruthy();
    const card = search.cards.filter({ has: page.locator('.appt-slots a') }).first();
    await expect(card.locator('h3')).not.toBeEmpty();
    await expect(card, 'the card shows an address').toContainText(/, MN \d{5}/);
    const buttons = card.locator('.appt-slots a');
    expect(await buttons.count()).toBeGreaterThan(0);
    for (const button of await buttons.all()) {
      await expect(button).toHaveAttribute('href', /^\/appointments\/\d+\/booking$/);
      await expect(button).toContainText(/\b\d{1,2}:\d{2} (am|pm)\b/);
      await expect(button).toContainText(/\b(online|phone|in person)\b/);
    }
  });
});

test(
  'AP-2: Nothing more than 8 days ahead is offered',
  { tag: '@desktop-only' },
  async ({ page }) => {
    test.setTimeout(180_000);
    const search = new AppointmentsSearchPage(page);
    const D = siteDate();
    const last = addDays(D, 8);

    await test.step('1. every time in the strip is within D to D+8', async () => {
      const days = await search.candidateDays(D);
      expect(days.length).toBeGreaterThan(0);
      for (const day of days) {
        await search.search({ start: day });
        for (const slot of await search.slots()) {
          const date = slot.datetime.slice(0, 10);
          expect(date, `time "${slot.text}" (${slot.href}) on ?start=${day}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          expect(date >= D && date <= last, `"${slot.text}" (${slot.href}) is dated ${date}, outside ${D} to ${last}`).toBe(true);
        }
      }
    });

    await test.step('2. D+9 to D+14 are empty', async () => {
      for (let n = 9; n <= 14; n++) {
        const day = addDays(D, n);
        if (weekday(day) === 0 || weekday(day) === 6) continue;
        await search.search({ start: day });
        await expect(search.emptyMessage, `?start=${day}`).toContainText(
          'There are no appointments available on this day.',
        );
        await expect(search.slotLinks, `?start=${day}`).toHaveCount(0);
      }
    });
  },
);
