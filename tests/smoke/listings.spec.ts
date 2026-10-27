import { test, expect } from '@playwright/test';
import { ListingPage } from '../pages/listing.page';

// Phase 1 — Read-Only Smoke Test Plan, LV-2/LV-3.
// See docs/phase1-read-only-smoke-test-plan.md.

test('/events view page loads', async ({ page }) => {
  const events = new ListingPage(page, '/events', 'Events');
  await events.goto();
  await expect(events.mainHeading()).toBeVisible();
});

test('/programs-services view page loads', async ({ page }) => {
  const programsAndServices = new ListingPage(
    page,
    '/programs-services',
    'Programs and Services',
  );
  await programsAndServices.goto();
  await expect(programsAndServices.mainHeading()).toBeVisible();
});
