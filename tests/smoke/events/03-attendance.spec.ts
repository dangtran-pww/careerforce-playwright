import { test, expect } from '../../helpers/fixtures';
import { useRole } from '../../helpers/roles';
import { rolePage } from '../../helpers/visitor';
import { EventAttendeesPage } from '../../pages/event-attendees.page';
import { MyEventsPage, currentEmail, currentUid } from '../../pages/my-events.page';
import { statusMessages } from '../../pages/node-form.page';
import { requireState, shortDate } from './shared';

// [Smoke] - Events - Test Plan, ES-1: an admin adds the job seeker to
// session S's 2nd occurrence, marks them attended, and a service record
// appears. Cleanup undoes the attendance (deleting the record) and cancels
// the registration. Needs 01-schedule.spec.ts first in the same run.
// See test-suites/smoke/smoke-events.md.
//
// QA and Stage only. The test's own page is the admin; the job seeker gets a
// page of their own.

useRole('admin');

test.describe('events: attendance', { tag: ['@no-prod', '@desktop-only'] }, () => {
  test('ES-1: Mark an attendee attended and a service record appears', async ({
    page,
    browser,
  }, testInfo) => {
    const { name, occurrences } = requireState('occurrences');
    const { id, date } = occurrences[1];
    const attendees = new EventAttendeesPage(page);

    const seeker = await rolePage(browser, testInfo, 'jobseeker');
    let added = false;
    let email = '';
    try {
      const uid = await currentUid(seeker);
      email = await currentEmail(seeker, uid);

      await test.step('1. add the job seeker as an attendee', async () => {
        await attendees.open(id);
        await expect(attendees.row(email)).toHaveCount(0);
        await attendees.addAttendee(email, 'In Person');
        added = true;
        const row = attendees.row(email);
        await expect(row).toHaveCount(1);
        expect(await attendees.cell(row, 'Status')).toBe('Registered');
        expect(await attendees.cell(row, 'Format')).toBe('In Person');
      });

      await test.step('2. Mark Attended', async () => {
        await attendees.operation(attendees.row(email), 'Mark Attended');
        await expect(statusMessages(page)).toContainText(
          'Attendance marked successfully. Service record created.',
        );
        expect(await attendees.cell(attendees.row(email), 'Status')).toBe('Attended');
      });

      await test.step('3. the job seeker sees Attended', async () => {
        const mine = new MyEventsPage(seeker);
        await mine.openEventsAndAppointments(uid);
        await expect(mine.rows(mine.upcoming, name).filter({ hasText: 'Attended' })).toHaveCount(1);
      });

      await test.step('4. a service record on the Services tab', async () => {
        await page.goto(`/user/${uid}/services`);
        await expect(
          page.locator('main table tbody tr').filter({ hasText: shortDate(date) }).filter({ hasText: 'Resume Writing Assistance' }),
        ).toHaveCount(1);
      });
    } finally {
      await seeker.context().close();
      if (added) {
        await test.step('cleanup: Undo Attendance, then Mark Canceled', async () => {
          await attendees.open(id);
          const row = attendees.row(email);
          if (await row.getByRole('link', { name: 'Undo Attendance' }).count()) {
            await attendees.operation(row, 'Undo Attendance');
            await expect(statusMessages(page)).toContainText(
              'Attendance has been undone and the attendee is now Registered. Service record deleted.',
            );
          }
          if (await row.getByRole('link', { name: 'Mark Canceled' }).count()) {
            await attendees.operation(row, 'Mark Canceled');
            await expect(statusMessages(page)).toContainText('Registration canceled successfully.');
          }
        });
      }
    }
  });
});
