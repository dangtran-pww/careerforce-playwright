import { test, expect } from '../../helpers/fixtures';
import { longDate } from '../../helpers/dates';
import { useRole } from '../../helpers/roles';
import { uniqueTitle } from '../../helpers/test-data';
import { visitorPage } from '../../helpers/visitor';
import {
  CATALOG_ADD,
  CatalogItemForm,
  CatalogList,
  SessionForm,
  SessionList,
  saveButton,
  sessionOccurrenceRows,
} from '../../pages/event-session-form.page';
import { expectNoErrors, statusMessages } from '../../pages/node-form.page';
import {
  catalogItem,
  readState,
  requireState,
  saveState,
  searchOccurrences,
  sessionS,
  sessionWeekdays,
} from './shared';

// [Smoke] - Events - Test Plan, EA-1 and EA-2: an admin creates a catalog
// item and schedules session S from it. 02-register, 03-attendance and
// 04-cleanup (EA-3) use them. See test-suites/smoke/smoke-events.md.
//
// QA and Stage only: it creates events visitors can see.

useRole('admin');

const session = sessionS();
const days = sessionWeekdays(session);

test.describe('events: schedule', { tag: ['@no-prod', '@desktop-only'] }, () => {
  test.describe.configure({ mode: 'serial' });

  test('EA-1: Create an event catalog item', async ({ page }) => {
    const name = uniqueTitle();
    saveState({ name });
    const list = new CatalogList(page);

    await test.step('1. fill in and save the catalog item', async () => {
      await new CatalogItemForm(page).create(catalogItem(name));
      await page.waitForURL((url) => url.pathname !== CATALOG_ADD);
      await expect(statusMessages(page)).toContainText(`New Catalog Item ${name} has been created.`);
      await expectNoErrors(page);
    });

    await test.step('2. listed once, Active, with Schedule', async () => {
      await list.open(name);
      const row = list.rows(name);
      await expect(row).toHaveCount(1);
      await expect(row).toContainText('Active');
      const schedule = await list.scheduleLink(row).getAttribute('href');
      const id = schedule?.match(/\/happenings\/catalog-item\/(\d+)\/schedule/)?.[1];
      expect(id, `Schedule link of "${name}": ${schedule}`).toBeTruthy();
      saveState({ name, catalogId: id });
    });
  });

  test('EA-2: Schedule a short recurring session', async ({ page, browser }, testInfo) => {
    const { name, catalogId } = requireState('catalog');
    const form = new SessionForm(page);

    await test.step('1. fill in session S, preview, and save', async () => {
      await form.open(catalogId);
      await form.fillWhen(session);
      const preview = await form.previewDates();
      expect(preview, 'Preview Occurrence Dates').toEqual(
        days.map((d) => `${longDate(d)} ${session.startTime}`),
      );
      expect(preview.filter((l) => /^(Saturday|Sunday)/.test(l))).toEqual([]);
      await form.fillDetails(session);
      await saveButton(page).click();
      // Saving runs an occurrence-generation batch, then opens the session.
      await page.waitForURL(/\/location-events\/[^/]+\/\d+$/);
      await expect(statusMessages(page)).toBeVisible();
      await expectNoErrors(page);
    });

    await test.step('2. the session list and the session page', async () => {
      const list = new SessionList(page);
      await list.open(name);
      const row = list.rows(name);
      await expect(row).toHaveCount(1);
      expect(await list.cell(row, 'Status')).toBe('Active');
      expect(await list.cell(row, 'Repeats on')).toBe(
        'Weekly on Monday, Tuesday, Wednesday, Thursday or Friday',
      );
      expect(await list.cell(row, 'Seats')).toBe(session.seats);
      await row.getByRole('link', { name, exact: true }).first().click();
      await expect(sessionOccurrenceRows(page)).toHaveCount(days.length);
    });

    await test.step('3. every occurrence on the Events search', async () => {
      const visitor = await visitorPage(browser, testInfo);
      try {
        let found: { id: string; date: string }[] = [];
        await expect
          .poll(async () => (found = await searchOccurrences(visitor, name)).length, {
            message: `Events search for "${name}" lists ${days.length} occurrences`,
            timeout: 60_000,
            intervals: [2_000, 5_000],
          })
          .toBe(days.length);
        expect(found.map((o) => o.date)).toEqual(days);
        for (const o of found) expect(o.id, `occurrence link on ${o.date}`).toMatch(/^\d+$/);
        saveState({ ...readState()!, occurrences: found });
      } finally {
        await visitor.context().close();
      }
    });
  });
});
