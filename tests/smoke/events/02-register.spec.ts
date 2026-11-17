import { test, expect } from '../../helpers/fixtures';
import { useRole } from '../../helpers/roles';
import { EventOccurrencePage } from '../../pages/event-occurrence.page';
import { MyEventsPage, currentUid } from '../../pages/my-events.page';
import { expectNoErrors, statusMessages } from '../../pages/node-form.page';
import { requireState } from './shared';

// [Smoke] - Events - Test Plan, ER-1 and ER-2: the job seeker registers for
// session S's 1st occurrence, then cancels. Needs 01-schedule.spec.ts to
// have run first in the same run. See test-suites/smoke/smoke-events.md.
//
// QA and Stage only: it registers for an event.

useRole('jobseeker');

test.describe('events: register and cancel', { tag: ['@no-prod', '@desktop-only'] }, () => {
  test.describe.configure({ mode: 'serial' });

  test('ER-1: Register for an event', async ({ page }) => {
    const { name, occurrences } = requireState('occurrences');
    const { id } = occurrences[0];
    const event = new EventOccurrencePage(page);
    const mine = new MyEventsPage(page);
    const uid = await currentUid(page);

    await test.step('1. Register', async () => {
      await event.goto(id);
      await event.registerButton.click();
      await expect(page).toHaveURL(new RegExp(`/events/event-occurrence/${id}/registration$`));
      await expect(page.getByRole('heading', { name: 'Confirm Your Registration' })).toBeVisible();
      await expect(event.completeRegistrationButton).toBeVisible();
    });

    await test.step('2. Complete Registration', async () => {
      await event.completeRegistrationButton.click();
      await expect(page).toHaveURL(new RegExp(`/events/event-occurrence/${id}/registration-success$`));
      await expectNoErrors(page);
    });

    await test.step('3. the event page shows the registration', async () => {
      await event.goto(id);
      await expect(event.registeredStatus).toBeVisible();
      await expect(event.cancelRegistrationLink).toBeVisible();
      await expect(event.registerButton).toHaveCount(0);
    });

    await test.step('4. the dashboard and My Events & Appointments', async () => {
      await mine.openDashboard(uid);
      await expect(mine.rows(mine.dashboardEvents, name)).toHaveCount(1);
      await expect(mine.rows(mine.dashboardEvents, name)).toContainText('Registered');
      await mine.openEventsAndAppointments(uid);
      await expect(mine.rows(mine.upcoming, name)).toHaveCount(1);
      await expect(mine.rows(mine.upcoming, name)).toContainText('Registered');
    });
  });

  test('ER-2: Cancel the event registration', async ({ page }) => {
    const { name, occurrences } = requireState('occurrences');
    const { id } = occurrences[0];
    const event = new EventOccurrencePage(page);
    const mine = new MyEventsPage(page);
    const uid = await currentUid(page);

    await test.step('1. Cancel Registration', async () => {
      await event.goto(id);
      await event.cancelRegistrationLink.click();
      await expect(event.cancelDialog).toContainText('Cancel Event Registration');
      await expect(event.cancelDialog).toContainText(
        'Are you sure you would like to cancel your event registration?',
      );
    });

    await test.step('2. Yes', async () => {
      await event.cancelDialog.getByRole('button', { name: 'Yes', exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/user/${uid}/events_appointments$`));
      await expect(statusMessages(page)).toContainText('Your registration has been cancelled.');
      await expect(mine.rows(mine.upcoming, name)).toContainText('Canceled');
    });

    await test.step('3. off the dashboard', async () => {
      await mine.openDashboard(uid);
      await expect(mine.rows(mine.dashboardEvents, name)).toHaveCount(0);
    });

    await test.step('4. Register shows again', async () => {
      await event.goto(id);
      await expect(event.registerButton).toBeVisible();
      await expect(event.registeredStatus).toHaveCount(0);
    });
  });
});
