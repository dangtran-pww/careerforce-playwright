import { test, expect } from '../../helpers/fixtures';
import { LocationPage } from '../../pages/location.page';

// [Smoke] - Public Site - General - Test Plan, LV-1.
// See test-plans/smoke-public-site.md.

const PHYSICAL_LOCATIONS = [
  {
    name: 'Aitkin',
    path: '/careerforce-location/careerforce-aitkin',
    title: 'CareerForce in Aitkin',
  },
  {
    name: 'Bloomington',
    path: '/careerforce-location/careerforce-bloomington',
    title: 'CareerForce in Bloomington',
  },
  {
    name: 'Brooklyn Center',
    path: '/careerforce-location/careerforce-brooklyn-center',
    title: 'CareerForce in Brooklyn Center',
  },
];

// All 4 locations — the 3 physical offices and the virtual "CareerForce
// from Anywhere" — structurally guarantee a "Programs and Services"
// section. "Events" is content-dependent (only renders when a location has
// events currently scheduled), so it isn't asserted here — see
// location.page.ts.
//
// The offices also have a "Location Details" block: address, phone, email,
// opening hours and a map. The virtual location has no such block, only a
// phone number and an email address in its text.
for (const location of PHYSICAL_LOCATIONS) {
  test(`LV-1: ${location.name} location page shows Programs and Services`, async ({
    page,
  }) => {
    const locationPage = new LocationPage(page, location.path);
    await locationPage.goto();
    await expect(locationPage.heading(location.title)).toBeVisible();
    await expect(locationPage.programsAndServicesSection()).toBeVisible();

    await test.step('Location Details', async () => {
      await expect(locationPage.detailsHeading()).toBeVisible();
      for (const label of ['Address', 'Phone', 'Email', 'Hours']) {
        await expect(locationPage.detailsLabel(label)).toBeVisible();
      }
      await expect(locationPage.phoneLinks(locationPage.details).first()).toHaveAttribute(
        'href',
        /^tel:\d/,
      );
      await expect(locationPage.emailLinks(locationPage.details).first()).toHaveAttribute(
        'href',
        /^mailto:\S+@\S+$/,
      );
      expect(await locationPage.openingDays().count()).toBeGreaterThan(0);
      await expect(locationPage.openingTimes().first()).toHaveText(/\d{1,2}:\d{2} [AP]M/);
      await expect(locationPage.map).toBeVisible();
    });
  });
}

test('LV-1: CareerForce from Anywhere location page shows Programs and Services', async ({
  page,
}) => {
  const locationPage = new LocationPage(page, '/anywhere');
  await locationPage.goto();
  await expect(locationPage.heading('CareerForce from Anywhere')).toBeVisible();
  await expect(locationPage.programsAndServicesSection()).toBeVisible();
  // Virtual: no office details, but a way to call or email.
  await expect(locationPage.detailsHeading()).toBeHidden();
  await expect(locationPage.phoneLinks().first()).toHaveAttribute('href', /^tel:\d/);
  await expect(locationPage.emailLinks().first()).toHaveAttribute('href', /^mailto:\S+@\S+$/);
});
