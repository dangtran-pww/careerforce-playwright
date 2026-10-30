import { test, expect } from '../../helpers/fixtures';
import { ListingPage } from '../../pages/listing.page';

// [Smoke] - Anonymous - Test Plan, LV-2/LV-3.
// See test-plans/smoke-anonymous.md.

test('LV-2: /events view page loads', async ({ page }) => {
  const events = new ListingPage(page, '/events', 'Events');
  await events.goto();
  await expect(events.mainHeading()).toBeVisible();
});

test('LV-3: /programs-services view page loads', async ({ page }) => {
  const programsAndServices = new ListingPage(
    page,
    '/programs-services',
    'Programs and Services',
  );
  await programsAndServices.goto();
  await expect(programsAndServices.mainHeading()).toBeVisible();
});
