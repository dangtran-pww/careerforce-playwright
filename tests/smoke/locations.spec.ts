import { test, expect } from '@playwright/test';
import { LocationPage } from '../pages/location.page';

// Phase 1 — Read-Only Smoke Test Plan, LV-1.
// See docs/phase1-read-only-smoke-test-plan.md.

const PHYSICAL_LOCATIONS = [
  { name: 'Aitkin', path: '/careerforce-location/careerforce-aitkin' },
  { name: 'Bloomington', path: '/careerforce-location/careerforce-bloomington' },
  {
    name: 'Brooklyn Center',
    path: '/careerforce-location/careerforce-brooklyn-center',
  },
];

// All 4 locations — the 3 physical offices and the virtual "CareerForce
// from Anywhere" — structurally guarantee a "Programs and Services"
// section. "Events" is content-dependent (only renders when a location has
// events currently scheduled), so it isn't asserted here — see
// location.page.ts.
for (const location of [...PHYSICAL_LOCATIONS, { name: 'CareerForce from Anywhere', path: '/anywhere' }]) {
  test(`${location.name} location page shows Programs and Services`, async ({
    page,
  }) => {
    const locationPage = new LocationPage(page, location.path);
    await locationPage.goto();
    await expect(locationPage.programsAndServicesSection()).toBeVisible();
  });
}
