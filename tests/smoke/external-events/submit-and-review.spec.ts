import type { Browser, Page, TestInfo } from '@playwright/test';

import { test, expect } from '../../helpers/fixtures';
import { addDays, longDate, siteDate } from '../../helpers/dates';
import { inboxAddress, waitForEmail } from '../../helpers/mailinator.mjs';
import { useRole } from '../../helpers/roles';
import { uniqueToken } from '../../helpers/test-data';
import { rolePage, visitorPage } from '../../helpers/visitor';
import { EventsSearchPage } from '../../pages/events-search.page';
import {
  ExternalEventForm,
  type ExternalEventSubmission,
} from '../../pages/external-event-form.page';
import {
  ExternalEventsAdmin,
  SUBMISSIONS_PATH,
  expectStatusMessage,
} from '../../pages/external-events-admin.page';
import { expectNoErrors } from '../../pages/node-form.page';

// [Smoke] - External Events - Test Plan, XS-1 and XA-1 to XA-4: a visitor
// submits an event, an admin drafts and publishes it, and the test deletes
// both. See test-suites/smoke/smoke-external-events.md.
//
// The cases share one submission and one event, so they run in order. XA-4
// deletes them; afterAll deletes whatever is left when an earlier case
// failed. QA and Stage only: it publishes an event visitors can see.

useRole('admin');

const token = uniqueToken();
const inbox = `playwright-ext-${token}`;
const D = siteDate();
const eventDate = addDays(D, 7);
const [yyyy, mm, dd] = eventDate.split('-');

const data: ExternalEventSubmission = {
  eventName: `Playwright test ${token}`,
  hostedBy: 'Playwright Test Host',
  date: eventDate,
  startTime: '10:00 AM',
  endTime: '11:00 AM',
  eventType: 'Job Fair or Networking Event',
  description: 'Synthetic event created by an automated smoke test.',
  link: 'https://example.com',
  phone: '555-555-0100',
  street: '100 Test Street',
  city: 'Saint Paul',
  zip: '55101',
  submitterName: 'Playwright Test',
  submitterEmail: inboxAddress(inbox),
};

const CONFIRMATION_SUBJECT = 'CareerForce event submission confirmation';
const APPROVAL_SUBJECT = 'Your event has been approved on CareerForce.MN.gov';

// Set by the cases as they go.
let eventPath: string | undefined;

async function asVisitor<T>(
  browser: Browser,
  testInfo: TestInfo,
  fn: (page: Page) => Promise<T>,
): Promise<T> {
  const page = await visitorPage(browser, testInfo);
  try {
    return await fn(page);
  } finally {
    await page.context().close();
  }
}

/** Event cards on the Events search for the test event's name. */
async function searchCards(page: Page) {
  const search = new EventsSearchPage(page);
  await search.search({ fq: data.eventName });
  return search.cards.filter({ hasText: data.eventName });
}

test.describe(
  'external events: submit and review',
  { tag: ['@no-prod', '@desktop-only'] },
  () => {
    test.describe.configure({ mode: 'serial' });

    test.afterAll(async ({ browser }, testInfo) => {
      const page = await rolePage(browser, testInfo, 'admin');
      try {
        await new ExternalEventsAdmin(page).deleteAllNamed(data.eventName);
      } finally {
        await page.context().close();
      }
    });

    test('XS-1: visitor submits an event', async ({ browser }, testInfo) => {
      await asVisitor(browser, testInfo, async (page) => {
        const form = new ExternalEventForm(page);
        await form.goto();

        await test.step('1. Event Information and In Person', async () => {
          await form.fillEventInformation(data);
          await expect(form.street).toBeVisible();
          await expect(form.city).toBeVisible();
          await expect(form.zip).toBeVisible();
          await expect(form.state.locator('option:checked')).toHaveText('Minnesota');
        });

        await test.step('2. address, submitter, CAPTCHA, Submit', async () => {
          await form.fillAddressAndSubmitter(data);
          await form.tickCaptcha();
          await form.submitButton.click();
          await expect(page).toHaveURL(/\/form\/external-event\/confirmation/);
          await expect(page.getByRole('main')).toContainText(
            'New submission added to Submit an Event.',
          );
          await expectNoErrors(page);
        });
      });

      await test.step('3. confirmation email', async () => {
        const email = await waitForEmail(inbox, CONFIRMATION_SUBJECT);
        expect(email.text).toContain(
          `Thank you for requesting to have your event, ${data.eventName}, posted on CareerForce.MN.gov.`,
        );
        expect(email.text).toContain('within 1-2 business days');
        expect(email.text).toContain('651-259-7500');
        expect(email.text).toContain('careerforce@state.mn.us');
      });
    });

    test('XA-1: the submission waits for review', async ({ page, browser }, testInfo) => {
      const admin = new ExternalEventsAdmin(page);
      const row = admin.rows(data.eventName);

      await test.step('1. the row', async () => {
        await admin.openSubmissions(data.eventName);
        await expect(row).toHaveCount(1);
        await expect(row).toContainText(`${mm}/${dd}/${yyyy} - 10:00 AM - 11:00 AM`);
        await expect(row).toContainText(data.hostedBy);
        await expect(row).toContainText(data.submitterEmail);
        expect(await admin.status(row)).toBe('Pending Review');
      });

      await test.step('2. operations', async () => {
        await expect(admin.operation(row, 'View Submission')).toHaveCount(1);
        await expect(admin.operation(row, 'Draft an external event')).toHaveCount(1);
      });

      await test.step('3. not on the Events search', async () => {
        await asVisitor(browser, testInfo, async (visitor) => {
          await expect(await searchCards(visitor)).toHaveCount(0);
        });
      });
    });

    test('XA-2: draft an external event from the submission', async ({
      page,
      browser,
    }, testInfo) => {
      const admin = new ExternalEventsAdmin(page);
      await admin.openSubmissions(data.eventName);
      const href = await admin.operationHref(admin.rows(data.eventName), 'Draft an external event');
      expect(href, '"Draft an external event" operation').toBeTruthy();

      await test.step('1. the prefilled form', async () => {
        await page.goto(href!);
        await expect(page.locator('input[name="field_webform_submission[0][target_id]"]')).toHaveValue(
          new RegExp(data.eventName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
        );
        await expect(page.locator('input[name="label[0][value]"]')).toHaveValue(data.eventName);
        await expect(page.locator('input[name="field_host[0][value]"]')).toHaveValue(data.hostedBy);
        await expect(
          page.locator('select[name="field_event_type"] option:checked'),
        ).toHaveText(data.eventType);
        await expect(page.locator('main')).toContainText(data.description);
        await expect(page.locator('input[name="field_links[0][uri]"]')).toHaveValue(data.link);
        await expect(page.locator('input[name^="field_phones[0]"]').first()).toHaveValue(
          /555.?555.?0100/,
        );
        await expect(page.locator('input[name="field_event_format[in_person]"]')).toBeChecked();
        await expect(page.locator('input[name^="field_address[0]"][value="100 Test Street"]')).toHaveCount(1);
        await expect(page.locator('input[name^="field_address[0]"][value="Saint Paul"]')).toHaveCount(1);
        await expect(page.locator('input[name^="field_address[0]"][value="55101"]')).toHaveCount(1);
        await expect(page.locator('input[name="field_contact_name[0][value]"]')).toHaveValue(data.submitterName);
        await expect(page.locator('input[name="field_contact_email[0][value]"]')).toHaveValue(data.submitterEmail);
        await expect(
          page.locator('select[name="moderation_state[0][state]"] option:checked'),
        ).toHaveText('Draft');
      });

      await test.step('2. save as Draft', async () => {
        await page
          .locator('#edit-actions, .form-actions')
          .getByRole('button', { name: 'Save', exact: true })
          .first()
          .click();
        await page.waitForURL((url) => !url.pathname.endsWith('/add'));
        await expectStatusMessage(page);
        await expectNoErrors(page);
      });

      await test.step('3. listed as Draft in External Events', async () => {
        await admin.openExternalEvents(data.eventName);
        const row = admin.rows(data.eventName);
        await expect(row).toHaveCount(1);
        expect(await admin.status(row)).toBe('Draft');
        await expect(row).toContainText(data.hostedBy);
        await expect(row).toContainText(data.submitterEmail);
        await expect(admin.operation(row, 'View Event')).toHaveCount(1);
        await expect(admin.operation(row, 'View Submission')).toHaveCount(1);
        eventPath = await admin.operationHref(row, 'View Event');
      });

      await test.step('4. the submission is Draft', async () => {
        await admin.openSubmissions(data.eventName);
        expect(await admin.status(admin.rows(data.eventName))).toBe('Draft');
      });

      await test.step('5. not on the Events search', async () => {
        await asVisitor(browser, testInfo, async (visitor) => {
          await expect(await searchCards(visitor)).toHaveCount(0);
        });
      });
    });

    test('XA-3: publish the external event', async ({ page, browser }, testInfo) => {
      const admin = new ExternalEventsAdmin(page);

      await test.step('1. set it to Active', async () => {
        await admin.openExternalEvents(data.eventName);
        const edit = await admin.operationHref(admin.rows(data.eventName), 'Edit');
        expect(edit, 'Edit operation').toBeTruthy();
        await page.goto(edit!);
        await page.locator('select[name="moderation_state[0][state]"]').selectOption('published'); // shown as "Active"
        await page
          .locator('#edit-actions, .form-actions')
          .getByRole('button', { name: 'Save', exact: true })
          .first()
          .click();
        await page.waitForURL((url) => !url.pathname.endsWith('/edit'));
        await expectStatusMessage(page);
        await expectNoErrors(page);
        await admin.openExternalEvents(data.eventName);
        const row = admin.rows(data.eventName);
        expect(await admin.status(row)).toBe('Active');
        eventPath = (await admin.operationHref(row, 'View Event')) ?? eventPath;
      });

      await test.step('2. the submission is Accepted', async () => {
        await admin.openSubmissions(data.eventName);
        expect(await admin.status(admin.rows(data.eventName))).toBe('Accepted');
      });

      await asVisitor(browser, testInfo, async (visitor) => {
        await test.step('3. the card on the Events search', async () => {
          // Indexed on save; the poll allows for the search server's commit.
          await expect
            .poll(async () => (await searchCards(visitor)).count(), {
              message: `Events search for "${data.eventName}" shows its card`,
              timeout: 60_000,
              intervals: [2_000, 5_000],
            })
            .toBe(1);
          const card = (await searchCards(visitor)).first();
          const link = card.locator('a.cf-events-search-card-link');
          await expect(link).toHaveAttribute('href', /^\/events\/external\/[^/]+$/);
          await expect(card.locator('time').first()).toHaveAttribute(
            'datetime',
            new RegExp(`^${eventDate}T`),
          );
          await expect(card).toContainText(/10:00 AM\s*to\s*11:00 AM/);
          await expect(card).toContainText('Saint Paul, MN');
          await expect(card).toContainText('In Person');
          await expect(card).toContainText('Job Fair or Networking Event');
          eventPath = (await link.getAttribute('href')) ?? eventPath;
        });

        await test.step('4. the event page', async () => {
          await visitor.goto(eventPath!);
          const main = visitor.getByRole('main');
          await expect(main.getByRole('heading', { level: 1 })).toHaveText(
            `${data.eventName} ${longDate(eventDate)}`,
          );
          const details = main.locator('article').first();
          await expect(details).toContainText(/Time\s*10:00 AM\s*-\s*11:00 AM/);
          await expect(details).toContainText('100 Test Street');
          await expect(details).toContainText('Saint Paul, MN 55101');
          await expect(details).toContainText(new RegExp(`Offered By\\s*${data.hostedBy}`));
          await expect(details).toContainText(/Accommodation Phone Number\s*555-555-0100/);
          const learnMore = main.getByRole('link', { name: /Learn more/ }).first();
          await expect(learnMore).toHaveAttribute('href', /^https:\/\/example\.com\/?$/);
          await expect(learnMore).toHaveAttribute('target', '_blank');
          await expect(main.getByRole('button', { name: 'Log In or Create Account' })).toHaveCount(0);
        });
      });

      await test.step('5. approval email', async () => {
        const email = await waitForEmail(inbox, APPROVAL_SUBJECT);
        expect(email.text).toContain('has been approved');
        expect(email.text).toContain(`Your event, ${data.eventName}, is currently displayed.`);
        const base = new URL(testInfo.project.use.baseURL!);
        const eventLink = email.links.find((l) => /\/events\/external\//.test(l));
        expect(eventLink, 'a link to the event in the email').toBeTruthy();
        const url = new URL(eventLink!);
        expect(url.origin).toBe(base.origin);
        expect(url.pathname).toBe(eventPath);
      });
    });

    test('XA-4: delete the test event and submission', async ({ page, browser }, testInfo) => {
      const admin = new ExternalEventsAdmin(page);

      await test.step('1. delete the event', async () => {
        await admin.openExternalEvents(data.eventName);
        const href = await admin.operationHref(admin.rows(data.eventName), 'Delete');
        if (href) {
          await admin.confirmDelete(href);
          await expectStatusMessage(page);
        }
        await admin.openExternalEvents(data.eventName);
        await expect(admin.rows(data.eventName)).toHaveCount(0);
      });

      await test.step('2. delete the submission', async () => {
        await admin.openSubmissions(data.eventName);
        const href = await admin.operationHref(admin.rows(data.eventName), 'Delete');
        if (href) {
          await admin.confirmDelete(href);
          await expectStatusMessage(page);
        }
        await page.goto(`${SUBMISSIONS_PATH}?combine=${encodeURIComponent(data.eventName)}`);
        await expect(admin.rows(data.eventName)).toHaveCount(0);
      });

      await test.step('3. gone for visitors', async () => {
        await asVisitor(browser, testInfo, async (visitor) => {
          if (eventPath) {
            const response = await visitor.goto(eventPath);
            expect(response?.status()).toBe(404);
            await expect(visitor.getByRole('heading', { level: 1 })).toContainText('Page Not Found');
          }
          await expect(await searchCards(visitor)).toHaveCount(0);
        });
      });
    });
  },
);
