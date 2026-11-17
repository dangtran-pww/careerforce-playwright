import { test, expect } from '../../helpers/fixtures';
import { EventsSearchPage, type EventsQuery } from '../../pages/events-search.page';
import {
  EXTERNAL_EVENT_FORM_PATH,
  ExternalEventForm,
} from '../../pages/external-event-form.page';

// [Smoke] - External Events - Test Plan, XV-1 to XV-3: what a visitor sees.
// See test-suites/smoke/smoke-external-events.md. Read only; desktop and phone.

const EXTERNAL_HREF = /^\/events\/(external\/[^/?#]+|event-external\/\d+)$/;

test('XV-1: "Submit an Event" form loads', async ({ page }) => {
  const form = new ExternalEventForm(page);
  await form.goto();
  const main = page.getByRole('main');

  await test.step('1. heading, back link and intro', async () => {
    await expect(main.getByRole('link', { name: 'Back to Events list' })).toHaveAttribute(
      'href',
      '/education-and-training/events',
    );
    await expect(main).toContainText(
      'All submitted events will be reviewed by a staff member before appearing on the calendar.',
    );
  });

  await test.step('2. Event Information', async () => {
    await expect(main.getByRole('group', { name: 'Event Information', exact: true })).toBeVisible();
    for (const field of [
      form.eventName,
      form.hostedBy,
      form.date,
      form.startTime,
      form.endTime,
      form.eventType,
      form.descriptionEditor,
      form.link,
      form.phone,
      form.inPerson,
      form.online,
    ]) {
      await expect(field).toBeVisible();
    }
    const today = await page.evaluate(() =>
      new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date()),
    );
    await expect(form.date).toHaveValue(today);
    const types = await form.eventType.locator('option').allTextContents();
    expect(types.map((t) => t.trim())).toEqual(
      expect.arrayContaining(['Job Club', 'Job Fair or Networking Event']),
    );
    await expect(page.locator('label[for="edit-event-format-in-person"]')).toHaveText('In Person');
    await expect(page.locator('label[for="edit-event-format-virtual"]')).toHaveText('Online');
  });

  await test.step('3. Submitter Details', async () => {
    await expect(main.getByRole('group', { name: 'Submitter Details', exact: true })).toBeVisible();
    await expect(form.submitterName).toBeVisible();
    await expect(form.submitterEmail).toBeVisible();
  });

  await test.step('4. CAPTCHA and Submit, no error', async () => {
    await expect(form.captcha).toBeVisible();
    await expect(form.captcha.locator('iframe[title="reCAPTCHA"]')).toBeVisible();
    await expect(form.submitButton).toBeVisible();
    await expect(page.locator('.messages--error, [data-drupal-messages] [role="alert"]')).toHaveCount(0);
  });
});

test('XV-2: "Submit event" link leads to the form', async ({ page }) => {
  await page.goto('/education-and-training/events');

  // The block is in the page twice (desktop and mobile); one is visible.
  const heading = page.getByRole('heading', { name: 'For Employers' }).filter({ visible: true });
  const link = page.getByRole('link', { name: 'Submit event' }).filter({ visible: true });
  await test.step('1. For Employers block', async () => {
    await expect(heading).toHaveCount(1);
    await expect(
      page
        .getByText(
          'Do you have an upcoming job fair or networking event? Submit your event to be posted directly on our events page.',
        )
        .filter({ visible: true }),
    ).toHaveCount(1);
    await expect(link).toHaveCount(1);
  });

  await test.step('2. the link opens the form', async () => {
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${EXTERNAL_EVENT_FORM_PATH}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Submit an Event');
  });
});

test('XV-3: an external event\'s page loads', async ({ page }) => {
  // The first external card on the Events search (also among job fairs),
  // else the event QA is known to have.
  const search = new EventsSearchPage(page);
  let target: string | undefined;
  const queries: EventsQuery[] = [{}, { 'fy[784]': '784' }];
  for (const query of queries) {
    await search.search(query);
    const hrefs = (await search.results()).items;
    target = hrefs.find((h) => EXTERNAL_HREF.test(h));
    if (target) break;
  }
  if (!target) {
    const response = await page.goto('/events/event-external/1');
    // The plan skips XV-3 with a reason where the site has no external event.
    // eslint-disable-next-line playwright/no-skipped-test
    test.skip(
      response?.status() !== 200,
      'No external event in the Events search, and /events/event-external/1 does not exist here.',
    );
    target = '/events/event-external/1';
  } else {
    await page.goto(target);
  }

  const main = page.getByRole('main');
  await test.step(`1. address (${target})`, async () => {
    await expect(page).toHaveURL(/\/events\/external\/[^/?#]+$/);
  });
  await test.step('2. h1 is the name and the date', async () => {
    await expect(main.getByRole('heading', { level: 1 })).toHaveText(
      /\S.*\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), [A-Z][a-z]+ \d{1,2}, \d{4}$/,
    );
  });
  await test.step('3. details and Learn more', async () => {
    // The labels are plain text, each followed by its value.
    const details = main.locator('article').first();
    await expect(details).toContainText(/Date\s*\w+day, [A-Z][a-z]+ \d{1,2}, \d{4}/);
    await expect(details).toContainText(/Time\s*\d{1,2}:\d{2} [AP]M\s*-\s*\d{1,2}:\d{2} [AP]M/);
    await expect(details).toContainText(/Location\s*\S/);
    await expect(details).toContainText(/Offered By\s*\S/);
    const learnMore = main.getByRole('link', { name: /Learn more/ }).first();
    await expect(learnMore).toHaveAttribute('target', '_blank');
    const href = (await learnMore.getAttribute('href')) ?? '';
    expect(new URL(href, page.url()).origin).not.toBe(new URL(page.url()).origin);
  });
  await test.step('4. no login or registration', async () => {
    await expect(main.getByRole('button', { name: 'Log In or Create Account' })).toHaveCount(0);
    await expect(main.locator('article').first()).not.toContainText(/register/i);
  });
});
