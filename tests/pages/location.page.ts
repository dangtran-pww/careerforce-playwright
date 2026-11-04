import { type Locator, type Page } from '@playwright/test';

// Same page template at 4 different paths — pass the path in rather than
// writing 4 near-identical page objects.
//
// "Programs and Services" is the only section structurally guaranteed to be
// there. "Events" only renders when a location currently has upcoming
// events scheduled — e.g. Brooklyn Center had none at the time this was
// written, while Aitkin did — so it's content-dependent, not structural,
// and locations.spec.ts does not hard-assert on it. eventsSection() is kept
// here for tests that already know a location has events scheduled.
//
// The offices have a "Location Details" block (Address, Phone, Email, Hours
// and a map). "CareerForce from Anywhere" is virtual and has no such block,
// only a phone and an email link in its text.
export class LocationPage {
  readonly page: Page;
  readonly main: Locator;
  readonly details: Locator;
  readonly map: Locator;
  private readonly path: string;

  constructor(page: Page, path: string) {
    this.page = page;
    this.path = path;
    this.main = page.getByRole('main');
    this.details = page.locator('main .location-default__right-col');
    this.map = this.details.locator('.js-mapkit-map');
  }

  async goto() {
    await this.page.goto(this.path);
  }

  heading(name: string): Locator {
    return this.main.getByRole('heading', { level: 1, name, exact: true });
  }

  eventsSection(): Locator {
    return this.page.getByRole('heading', { name: 'Events', exact: true });
  }

  programsAndServicesSection(): Locator {
    return this.page.getByRole('heading', { name: 'Programs and Services' });
  }

  detailsHeading(): Locator {
    return this.details.getByRole('heading', { name: 'Location Details' });
  }

  // "Address", "Phone", "Email" or "Hours".
  detailsLabel(label: string): Locator {
    return this.details.locator('.field__label').getByText(label, { exact: true });
  }

  // One row per open day in the Hours list: "Monday:" and its time slots
  // ("8:00 AM - 4:30 PM"), in .office-hours__item-slots.
  openingDays(): Locator {
    return this.details.locator('.office-hours__item');
  }

  openingTimes(): Locator {
    return this.details.locator('.office-hours__item-slots');
  }

  phoneLinks(scope: Locator = this.main): Locator {
    return scope.locator('a[href^="tel:"]');
  }

  emailLinks(scope: Locator = this.main): Locator {
    return scope.locator('a[href^="mailto:"]');
  }
}
