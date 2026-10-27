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
export class LocationPage {
  readonly page: Page;
  private readonly path: string;

  constructor(page: Page, path: string) {
    this.page = page;
    this.path = path;
  }

  async goto() {
    await this.page.goto(this.path);
  }

  eventsSection(): Locator {
    return this.page.getByRole('heading', { name: 'Events', exact: true });
  }

  programsAndServicesSection(): Locator {
    return this.page.getByRole('heading', { name: 'Programs and Services' });
  }
}
