import { test, expect } from '../../helpers/fixtures';
import { useRole } from '../../helpers/roles';
import { visitorPage } from '../../helpers/visitor';
import { CatalogItemForm, SessionList } from '../../pages/event-session-form.page';
import { expectNoErrors, statusMessages } from '../../pages/node-form.page';
import { readState, searchOccurrences } from './shared';

// [Smoke] - Events - Test Plan, EA-3: removes the test events. It runs last
// (after 01 to 03 by file name), whatever they did, so it is also the
// plan's `finally`. A session that has had registrations can't be deleted,
// so session S is cancelled and the catalog item set to Inactive.
// See test-suites/smoke/smoke-events.md.

useRole('admin');

test.describe('events: cleanup', { tag: ['@no-prod', '@desktop-only'] }, () => {
  test('EA-3: Remove the test events', async ({ page, browser }, testInfo) => {
    const state = readState();
    test.skip(!state?.catalogId, 'EA-1 created no catalog item in this run, so there is nothing to remove');
    const { name, catalogId } = state!;
    const list = new SessionList(page);

    await test.step('1. cancel session S', async () => {
      await list.open(name);
      const row = list.rows(name);
      if ((await row.count()) === 0) return; // EA-2 didn't save it
      await list.bulk(row.first(), 'Cancel Session');
      await expect(statusMessages(page)).toContainText('Successfully cancelled 1 session(s)');
      await list.open(name);
      expect(await list.cell(list.rows(name).first(), 'Status')).toBe('Cancelled');
    });

    await test.step('2. set the catalog item to Inactive', async () => {
      await new CatalogItemForm(page).setStatus(catalogId!, 'Inactive');
      await expect(statusMessages(page)).toContainText(`The Catalog Item ${name} has been updated.`);
      await expectNoErrors(page);
    });

    await test.step('3. gone from the Events search', async () => {
      const visitor = await visitorPage(browser, testInfo);
      try {
        await expect
          .poll(async () => (await searchOccurrences(visitor, name)).length, {
            message: `Events search for "${name}" lists nothing`,
            timeout: 60_000,
            intervals: [2_000, 5_000],
          })
          .toBe(0);
      } finally {
        await visitor.context().close();
      }
    });
  });
});
