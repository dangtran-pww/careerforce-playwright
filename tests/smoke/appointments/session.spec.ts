import type { Browser, Page, TestInfo } from '@playwright/test';

import { test, expect } from '../../helpers/fixtures';
import { addDays, longDate, siteDate, weekday } from '../../helpers/dates';
import { currentEnv, loginCommand } from '../../helpers/environments.mjs';
import { useRole } from '../../helpers/roles';
import { uniqueTitle } from '../../helpers/test-data';
import { rolePage, visitorPage } from '../../helpers/visitor';
import { AppointmentSessionForm } from '../../pages/appointment-session-form.page';
import {
  BookingPage,
  ServiceRecordForm,
  SlotPage,
  statusMessage,
} from '../../pages/appointment-slot.page';
import { AppointmentsSearchPage } from '../../pages/appointments-search.page';
import { AITKIN, LocationAppointments, type SessionSlot } from '../../pages/location-appointments.page';
import { expectNoErrors } from '../../pages/node-form.page';

// [Smoke] - Appointments - Test Plan, AA-1 to AA-3, AB-1, AB-2 and AS-1 to
// AS-3: an admin creates a short appointment session S at CareerForce in
// Aitkin, a job seeker books and cancels one of its slots, the admin adds and
// cancels attendees, marks one attended and cancels a slot, and AA-3 cancels
// the test slots and the session. See test-suites/smoke/smoke-appointments.md.
//
// The cases share session S, so they run in order. A case run on its own
// creates S first (ensureSession). afterAll cancels whatever is left when an
// earlier case failed. QA and Stage only: it creates appointments visitors
// can book.

useRole('admin');

const D = siteDate();
const marker = uniqueTitle();

// The next weekday at least 2 days ahead.
function firstWeekdayFrom(ymd: string): string {
  let day = ymd;
  while (weekday(day) === 0 || weekday(day) === 6) day = addDays(day, 1);
  return day;
}
const startDate = firstWeekdayFrom(addDays(D, 2));
const until = addDays(D, 14);

const expectedDates: string[] = [];
for (let day = startDate; day <= until; day = addDays(day, 1)) {
  if (weekday(day) !== 0 && weekday(day) !== 6) expectedDates.push(day);
}

const BOOKING_PHONE = '555-555-0101';
const SERVICE = 'Resume Writing Assistance';

// Set by the cases as they go.
let sessionId: string | undefined;
let staffName = '';
let slots: SessionSlot[] = [];
let cleanedUp = false;
let saveClicked = false;
let booked = false;

type JobSeeker = { uid: string; first: string; last: string; email: string };
let jobSeeker: JobSeeker | undefined;

/** "11/20/2026" or "November 20, 2026", however a page writes the day. */
function dayPattern(ymd: string): RegExp {
  const [y, m, d] = ymd.split('-').map(Number);
  const month = longDate(ymd).split(' ')[1];
  return new RegExp(`(\\b${m}/${d}/${y}\\b|\\b0?${m}/0?${d}/${y}\\b|${month} ${d}, ${y})`);
}

const slot = (n: number) => slots[n - 1];

async function withPage<T>(page: Promise<Page>, fn: (page: Page) => Promise<T>): Promise<T> {
  const p = await page;
  try {
    return await fn(p);
  } finally {
    await p.context().close();
  }
}

const asVisitor = <T>(browser: Browser, testInfo: TestInfo, fn: (page: Page) => Promise<T>) =>
  withPage(visitorPage(browser, testInfo), fn);

async function asJobSeeker<T>(browser: Browser, testInfo: TestInfo, fn: (page: Page) => Promise<T>) {
  return withPage(rolePage(browser, testInfo, 'jobseeker'), async (page) => {
    if (!jobSeeker) {
      await page.goto('/user');
      const path = new URL(page.url()).pathname;
      expect(
        path,
        `The saved jobseeker session has expired. Run \`${loginCommand('jobseeker', currentEnv())}\` and try again.`,
      ).not.toBe('/user/login');
      const uid = /^\/user\/(\d+)/.exec(path)?.[1];
      expect(uid, `job seeker's user ID from ${path}`).toBeTruthy();
      await page.goto(`/user/${uid}/edit`);
      jobSeeker = {
        uid: uid!,
        first: await page.locator('input[name="field_first_name[0][value]"]').inputValue(),
        last: await page.locator('input[name="field_last_name[0][value]"]').inputValue(),
        email: await page.locator('input[name="email"]').inputValue(),
      };
    }
    return fn(page);
  });
}

/** Loads the job seeker's details (user ID, name, email) once. */
async function jobSeekerDetails(browser: Browser, testInfo: TestInfo): Promise<JobSeeker> {
  if (!jobSeeker) await asJobSeeker(browser, testInfo, async () => undefined);
  return jobSeeker!;
}

/** Creates session S as the admin; returns the session page's message. */
async function createSession(page: Page): Promise<string> {
  const admin = new LocationAppointments(page);
  await admin.openTab();
  await admin.createLink().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Create appointment');
  const form = new AppointmentSessionForm(page);
  await expect(form.serviceLocation).toHaveValue(/^CareerForce in Aitkin \(\d+\)$/);
  staffName = await form.fill({
    date: startDate,
    startTime: '15:00',
    until,
    videoLink: 'https://example.com/playwright-test-meeting',
    additionalInformation: marker,
    accommodationPhone: '555-555-0100',
  });
  saveClicked = true;
  sessionId = await form.save();
  const message = ((await statusMessage(page).textContent()) ?? '').replace(/\s+/g, ' ').trim();
  slots = await admin.sessionSlots();
  return message;
}

async function ensureSession(page: Page) {
  if (!sessionId) await createSession(page);
  expect(slots.length, 'slots of session S').toBeGreaterThanOrEqual(4);
}

/** Reloads the slot list of S (statuses and registrants change). */
async function reloadSlots(page: Page) {
  const admin = new LocationAppointments(page);
  await admin.openSession(sessionId!);
  slots = await admin.sessionSlots();
}

/**
 * Polls the search for slot `s`'s day until its time button is there
 * (`present`) or gone, allowing for the search index to catch up.
 */
async function expectInSearch(visitor: Page, s: SessionSlot, present: boolean) {
  const search = new AppointmentsSearchPage(visitor);
  await expect
    .poll(
      async () => {
        await search.search({ start: s.date });
        return search.slotLink(s.id).count();
      },
      {
        message: `the search on ?start=${s.date} ${present ? 'offers' : 'no longer offers'} slot ${s.id}`,
        timeout: 60_000,
        intervals: [2_000, 5_000],
      },
    )
    .toBe(present ? 1 : 0);
}

/** The job seeker's upcoming appointment row for a slot, on My Events & Appointments. */
function upcomingRow(page: Page, s: SessionSlot) {
  return page
    .locator('main table tbody tr')
    .filter({ hasText: dayPattern(s.date) })
    .filter({ hasText: /3:00 PM/i });
}

/** Books slot 1 as the job seeker, as in AB-1 steps 1 and 2. */
async function bookSlotOne(page: Page): Promise<void> {
  const search = new AppointmentsSearchPage(page);
  await search.search({ start: slot(1).date });
  await search.cardSlotLink(AITKIN.name, slot(1).id).click();
  await page.waitForURL(new RegExp(`/appointments/${slot(1).id}/booking$`));
  await new BookingPage(page).book({
    format: 'Phone',
    phone: BOOKING_PHONE,
    topics: ['Resumes', 'Job Search'],
  });
  booked = true;
}

/** Adds the job seeker to slot `s` as the admin (AS-1 step 1 and 2). */
async function addJobSeeker(page: Page, s: SessionSlot, format: 'In Person' | 'Online') {
  const admin = new LocationAppointments(page);
  const slotPage = new SlotPage(page);
  await slotPage.goto(admin.slotPath(sessionId!, s.id));
  await slotPage.action('Add attendee').click();
  await slotPage.addAttendee(jobSeeker!.email, format);
}

/**
 * Cancels every registration and slot of S that is left, then the session.
 * Quiet about what is already done; used by AA-3 and afterAll.
 */
async function cancelEverything(page: Page) {
  const admin = new LocationAppointments(page);
  await reloadSlots(page);
  const slotPage = new SlotPage(page);
  for (const s of slots.filter((x) => x.registrant && x.status !== 'Cancelled')) {
    await slotPage.goto(s.viewHref);
    if (await slotPage.action('Undo Attendance').isVisible()) await slotPage.undoAttendance();
    if (await slotPage.action('Cancel registration').isVisible()) await slotPage.cancelRegistration();
  }
  await reloadSlots(page);
  const open = slots.filter((s) => s.status !== 'Cancelled').map((s) => s.id);
  if (open.length) await admin.cancelOccurrences(open);
  await admin.openSessionList();
  if ((await admin.sessionListStatus(sessionId!)) !== 'Cancelled') {
    await admin.cancelSession(sessionId!);
  }
}

test.describe('appointments: session, booking and staff actions', { tag: ['@no-prod', '@desktop-only'] }, () => {
  test.describe.configure({ mode: 'serial', timeout: 240_000 });

  test.afterAll(async ({ browser }, testInfo) => {
    test.setTimeout(180_000);
    if (cleanedUp || (!sessionId && !saveClicked)) return;
    await withPage(rolePage(browser, testInfo, 'admin'), async (page) => {
      // Save was clicked but the session page never came: find S by its marker.
      sessionId ??= await new LocationAppointments(page).findSessionByMarker(marker);
      if (sessionId) await cancelEverything(page);
    });
  });

  test('AA-1: Create a short appointment session', async ({ page }) => {
    const admin = new LocationAppointments(page);

    await test.step('1. the Create appointment form', async () => {
      await admin.openTab();
      await admin.createLink().click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Create appointment');
      await expect(new AppointmentSessionForm(page).serviceLocation).toHaveValue(
        /^CareerForce in Aitkin \(\d+\)$/,
      );
    });

    await test.step('2. save session S', async () => {
      const message = await createSession(page);
      expect(message).toContain(
        `The appointment session Appointment session #${sessionId} has been created.`,
      );
      await expectNoErrors(page);
      expect(slots.map((s) => s.date)).toEqual(expectedDates);
      for (const s of slots) {
        expect(s.time, `slot ${s.id} on ${s.date}`).toBe('15:00');
        expect(s.text).toContain('3:00 PM');
        expect(s.status, `slot ${s.id}`).toBe('Active');
        expect(s.staffMember, `slot ${s.id}`).toBe(staffName);
        expect(s.registrant, `slot ${s.id}`).toBe('');
      }
    });

    await test.step('3. the slots on the Appointments tab', async () => {
      // The plan's step filters the whole range at once. On QA, earlier runs'
      // cancelled slots at the same times make the paged list skip rows, so
      // the same filter is applied one day at a time.
      for (const day of expectedDates) {
        await admin.openTab({ from: day, to: day });
        const rows = await admin.allTabRows(sessionId!);
        expect(rows, `rows of session S on ${day}`).toHaveLength(1);
        expect(rows[0]['Status']).toBe('Active');
        expect(rows[0]['Staff Member']).toBe(staffName);
        expect(rows[0]['Available Formats']).toBe('Online, Phone, In person');
        expect(rows[0]['Registrant']).toBe('');
      }
    });
  });

  test('AA-2: The session\'s slots show in the search only within 8 days', async ({ page, browser }, testInfo) => {
    await ensureSession(page);
    await asVisitor(browser, testInfo, async (visitor) => {
      const search = new AppointmentsSearchPage(visitor);

      await test.step('1. slots up to D+7 are offered', async () => {
        for (const s of slots.filter((x) => x.date <= addDays(D, 7))) {
          await expectInSearch(visitor, s, true);
          const button = search.cardSlotLink(AITKIN.name, s.id);
          await expect(button).toContainText('3:00 pm');
          await expect(button).toContainText(/online\s+phone\s+in person/);
        }
      });

      await test.step('2. slots from D+9 are not', async () => {
        for (const s of slots.filter((x) => x.date >= addDays(D, 9))) {
          await search.search({ start: s.date });
          await expect(search.slotLink(s.id), `slot ${s.id} on ${s.date}`).toHaveCount(0);
        }
      });
    });
  });

  test('AB-1: Book an appointment', async ({ page, browser }, testInfo) => {
    await ensureSession(page);
    const s = slot(1);

    await asJobSeeker(browser, testInfo, async (js) => {
      await test.step('1. the booking page', async () => {
        const search = new AppointmentsSearchPage(js);
        await expectInSearch(js, s, true);
        await search.cardSlotLink(AITKIN.name, s.id).click();
        await expect(js).toHaveURL(new RegExp(`/appointments/${s.id}/booking$`));
        const booking = new BookingPage(js);
        await expect(booking.main.getByRole('heading', { level: 1 })).toHaveText('Book Your Appointment');
        await expect(booking.main).toContainText('Select a format');
        for (const f of ['Online', 'Phone', 'In Person'] as const) {
          await expect(booking.format(f)).toBeVisible();
        }
        await expect(booking.main).toContainText(
          'What topics would you like to focus on? You may choose up to three.',
        );
        await expect(booking.completeButton).toBeVisible();
        await expect(booking.main).toContainText(longDate(s.date));
        await expect(booking.main).toContainText('3:00 PM');
      });

      await test.step('2. Complete Booking', async () => {
        await new BookingPage(js).book({
          format: 'Phone',
          phone: BOOKING_PHONE,
          topics: ['Resumes', 'Job Search'],
        });
        booked = true;
        const main = js.getByRole('main');
        await expect(main.getByRole('heading', { level: 1 })).toHaveText('Your Appointment is Booked!');
        await expect(main).toContainText(`A confirmation email was sent to ${jobSeeker!.email}.`);
        await expect(main.getByRole('button', { name: 'My Dashboard' })).toBeVisible();
        await expect(main).toContainText(longDate(s.date));
        await expect(main).toContainText('3:00 PM');
      });

      await test.step('3. the dashboard', async () => {
        await js.goto(`/user/${jobSeeker!.uid}`);
        const block = js.getByRole('main');
        await expect(block.getByRole('heading', { name: 'Upcoming Events & Appointments' })).toBeVisible();
        await expect(block).not.toContainText('You are not registered for any upcoming appointments.');
        await expect(block).toContainText(dayPattern(s.date));
        await expect(block).toContainText(/3:00 PM/i);
      });

      await test.step('4. My Events & Appointments', async () => {
        await js.goto(`/user/${jobSeeker!.uid}/events_appointments`);
        const row = upcomingRow(js, s);
        await expect(row).toHaveCount(1);
        await expect(row).toContainText('Registered');
        await expect(row).toContainText('Phone');
        await expect(row.getByRole('link', { name: 'View or Cancel' })).toBeVisible();
      });
    });

    await test.step('5. the session page as the admin', async () => {
      await reloadSlots(page);
      expect(slot(1).registrant).toBe(`${jobSeeker!.first} ${jobSeeker!.last}`);
      expect(slot(1).registrationStatus).toBe('Registered');
    });
  });

  test('AB-2: Cancel the appointment booking', async ({ page, browser }, testInfo) => {
    await ensureSession(page);
    const s = slot(1);

    await asJobSeeker(browser, testInfo, async (js) => {
      if (!booked) await bookSlotOne(js);
      const slotPage = new SlotPage(js);

      await test.step('1. View or Cancel', async () => {
        await js.goto(`/user/${jobSeeker!.uid}/events_appointments`);
        await upcomingRow(js, s).getByRole('link', { name: 'View or Cancel' }).click();
        await expect(slotPage.main).toContainText(longDate(s.date));
        await expect(slotPage.main).toContainText('3:00 PM');
        await expect(slotPage.action('Cancel registration')).toBeVisible();
      });

      await test.step('2. the cancel page', async () => {
        await slotPage.action('Cancel registration').click();
        await expect(slotPage.cancelDialog()).toContainText('Cancel Appointment');
        await expect(slotPage.cancelDialog()).toContainText(
          'Are you sure you would like to cancel your appointment?',
        );
        await expect(slotPage.confirmCancelButton()).toBeVisible();
        await expect(slotPage.keepButton()).toBeVisible();
      });

      await test.step('3. Yes, cancel my registration', async () => {
        await slotPage.confirmCancelButton().click();
        await expect(js).toHaveURL(new RegExp(`/user/${jobSeeker!.uid}/events_appointments$`));
        await expect(statusMessage(js)).toContainText('Your appointment registration has been cancelled.');
        booked = false;
        await expect(upcomingRow(js, s).filter({ hasText: 'Registered' })).toHaveCount(0);
      });

      await test.step('4. the dashboard', async () => {
        await js.goto(`/user/${jobSeeker!.uid}`);
        await expect(js.getByRole('main')).toContainText(
          'You are not registered for any upcoming appointments.',
        );
      });
    });

    await test.step('5. offered again in the search', async () => {
      await asVisitor(browser, testInfo, (visitor) => expectInSearch(visitor, s, true));
    });
  });

  test('AS-1: Staff add an attendee to a slot and cancel the registration', async ({ page, browser }, testInfo) => {
    await ensureSession(page);
    const js = await jobSeekerDetails(browser, testInfo);
    const s = slot(2);
    const admin = new LocationAppointments(page);
    const slotPage = new SlotPage(page);

    await test.step('1. Add attendee', async () => {
      await slotPage.goto(admin.slotPath(sessionId!, s.id));
      await slotPage.action('Add attendee').click();
      await expect(slotPage.heading).toHaveText(`Add Attendee to Appointment - ${longDate(s.date)}`);
      await expect(slotPage.main.getByLabel('First name, last name or email')).toBeVisible();
      for (const f of ['Online', 'Phone', 'In Person']) {
        await expect(slotPage.main.getByRole('radio', { name: f, exact: true })).toBeVisible();
      }
      await expect(slotPage.main.getByRole('button', { name: 'Register' })).toBeVisible();
    });

    await test.step('2. Register the job seeker', async () => {
      await slotPage.addAttendee(js.email, 'In Person');
      await expect(page).toHaveURL(new RegExp(`/${s.id}$`));
      await expect(statusMessage(page)).toContainText('User registered for appointment successfully.');
      await expect(slotPage.heading).toHaveText(`Appointment - ${js.first} ${js.last}`);
      await expect(slotPage.main).toContainText(/Registration Status\s*Registered/);
      await expect(slotPage.main).toContainText(/Selected Format\s*In person/i);
      for (const a of ['Cancel registration', 'Resend Confirmation', 'Mark Attended']) {
        await expect(slotPage.action(a)).toBeVisible();
      }
      await expect(slotPage.action('Add attendee')).toHaveCount(0);
    });

    await test.step('3. on the job seeker\'s My Events & Appointments', async () => {
      await asJobSeeker(browser, testInfo, async (jsPage) => {
        await jsPage.goto(`/user/${js.uid}/events_appointments`);
        const row = upcomingRow(jsPage, s);
        await expect(row).toHaveCount(1);
        await expect(row).toContainText('Registered');
        await expect(row).toContainText(/In Person/i);
      });
    });

    await test.step('4. Cancel registration', async () => {
      await slotPage.goto(admin.slotPath(sessionId!, s.id));
      await slotPage.cancelRegistration();
    });

    await test.step('5. the slot is open again', async () => {
      await slotPage.goto(admin.slotPath(sessionId!, s.id));
      await expect(slotPage.main).toContainText('No one has registered for this appointment.');
      await expect(slotPage.action('Add attendee')).toBeVisible();
    });
  });

  test('AS-2: Mark an attendee attended and a service record appears', async ({ page, browser }, testInfo) => {
    await ensureSession(page);
    const js = await jobSeekerDetails(browser, testInfo);
    const s = slot(3);
    const admin = new LocationAppointments(page);
    const slotPage = new SlotPage(page);
    const slotPath = admin.slotPath(sessionId!, s.id);

    await addJobSeeker(page, s, 'Online');
    await expect(statusMessage(page)).toContainText('User registered for appointment successfully.');
    try {
      let dateOfService = '';

      await test.step('1. Mark Attended', async () => {
        await slotPage.action('Mark Attended').click();
        await expect(page).toHaveURL(new RegExp(`/appointments/${s.id}/add-service-record$`));
        await expect(slotPage.heading).toHaveText(`Add Service Record - ${js.first} ${js.last}`);
        const form = new ServiceRecordForm(page);
        await expect(form.serviceLocation).toHaveValue(/CareerForce in Aitkin/);
        await expect(form.serviceLocation).not.toBeEditable();
        await expect(form.format.locator('option:checked')).toHaveText(/^Online$/i);
        dateOfService = await form.dateOfService.inputValue();
      });

      await test.step('2. Save the service record', async () => {
        const form = new ServiceRecordForm(page);
        await form.staffMember.selectOption({ label: staffName });
        await form.service(SERVICE).check();
        await form.saveButton.click();
        await page.waitForURL((url) => !url.pathname.endsWith('/add-service-record'));
        await expect(statusMessage(page)).toContainText(`Service recorded for ${js.first} ${js.last}`);
        await expectNoErrors(page);
        // The slot page writes Attended as "User has been marked attended".
        await expect(slotPage.main).toContainText(/Registration Status\s*User has been marked attended/);
        await expect(slotPage.action('Undo Attendance')).toBeVisible();
        await expect(slotPage.action('Mark Attended')).toHaveCount(0);
      });

      await test.step('3. the job seeker\'s Services tab', async () => {
        await page.goto(`/user/${js.uid}/services`);
        const main = page.getByRole('main');
        await expect(main).toContainText('Recorded Services');
        const record = main
          .locator('tr, .views-row, article')
          .filter({ hasText: SERVICE })
          .filter({ hasText: dayPattern(dateOfService) });
        await expect(record.first()).toBeVisible();
      });
    } finally {
      await slotPage.goto(slotPath);
      if (await slotPage.action('Undo Attendance').isVisible()) await slotPage.undoAttendance();
      if (await slotPage.action('Cancel registration').isVisible()) await slotPage.cancelRegistration();
    }
  });

  test('AS-3: Cancel a slot and it leaves the search', async ({ page, browser }, testInfo) => {
    await ensureSession(page);
    const s = slot(4);
    expect(s.date <= addDays(D, 7), `slot 4 (${s.date}) is within D+7`).toBe(true);
    const admin = new LocationAppointments(page);

    await test.step('1. offered in the search', async () => {
      await asVisitor(browser, testInfo, async (visitor) => {
        await expectInSearch(visitor, s, true);
        const search = new AppointmentsSearchPage(visitor);
        await expect(search.cardSlotLink(AITKIN.name, s.id)).toContainText('3:00 pm');
      });
    });

    await test.step('2. Cancel occurrences', async () => {
      await admin.openSession(sessionId!);
      await admin.cancelOccurrences([s.id]);
      await reloadSlots(page);
      expect(slot(4).status).toBe('Cancelled');
    });

    await test.step('3. gone from the search', async () => {
      await asVisitor(browser, testInfo, (visitor) => expectInSearch(visitor, s, false));
    });
  });

  test('AA-3: Remove the test slots', async ({ page, browser }, testInfo) => {
    await ensureSession(page);
    const admin = new LocationAppointments(page);

    await test.step('1. Cancel occurrences', async () => {
      await reloadSlots(page);
      const open = slots.filter((s) => s.status !== 'Cancelled').map((s) => s.id);
      if (open.length) await admin.cancelOccurrences(open);
      await reloadSlots(page);
      for (const s of slots) expect(s.status, `slot ${s.id} on ${s.date}`).toBe('Cancelled');
    });

    await test.step('2. Cancel Session', async () => {
      await admin.cancelSession(sessionId!);
      await admin.openSessionList();
      expect(await admin.sessionListStatus(sessionId!)).toBe('Cancelled');
      cleanedUp = true;
    });

    await test.step('3. gone from the search', async () => {
      await asVisitor(browser, testInfo, async (visitor) => {
        for (const s of slots.filter((x) => x.date <= addDays(D, 8))) {
          await expectInSearch(visitor, s, false);
        }
      });
    });
  });
});
