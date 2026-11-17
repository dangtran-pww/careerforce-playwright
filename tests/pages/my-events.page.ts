import { type Locator, type Page } from '@playwright/test';

// A job seeker's events: the dashboard's events block (/user/<uid>,
// Registered and Waitlisted only) and My Events & Appointments
// (/user/<uid>/events_appointments, every status, "Upcoming" first).
// "Event Name" is plain text, so rows are found by the event's name and the
// occurrence's date.
export class MyEventsPage {
  readonly page: Page;
  readonly dashboardEvents: Locator;
  readonly upcoming: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dashboardEvents = page.locator('.view-display-id-job_seeker_dashboard_events').first();
    this.upcoming = page.locator('.view-display-id-block_user_registered_occurrences').first();
  }

  async openDashboard(uid: string) {
    await this.page.goto(`/user/${uid}`);
  }

  async openEventsAndAppointments(uid: string) {
    await this.page.goto(`/user/${uid}/events_appointments`);
  }

  /** Rows for an event, optionally narrowed to one date ("11/23/2026" or similar). */
  rows(scope: Locator, name: string, date?: RegExp): Locator {
    const rows = scope.locator('tbody tr').filter({ hasText: name });
    return date ? rows.filter({ hasText: date }) : rows;
  }
}

/**
 * A job seeker's own email, from the Email field of their "My Profile" tab
 * (/user/<uid>/edit). Staff don't see that field there.
 */
export async function currentEmail(page: Page, uid: string): Promise<string> {
  await page.goto(`/user/${uid}/edit`);
  const email = await page.locator('main input[name="email"]').inputValue();
  if (!email.includes('@')) throw new Error(`No email in My Profile (${page.url()})`);
  return email;
}

/** The uid of the logged-in user: /user redirects to /user/<uid>. */
export async function currentUid(page: Page): Promise<string> {
  await page.goto('/user');
  const uid = new URL(page.url()).pathname.match(/^\/user\/(\d+)/)?.[1];
  if (!uid) throw new Error(`/user went to ${page.url()}, not /user/<uid>`);
  return uid;
}
