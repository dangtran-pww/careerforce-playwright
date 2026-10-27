import { type Locator, type Page } from '@playwright/test';

// Phase 1 only covers the entry page loading without requiring login; the
// 12-question assessment flow itself is out of scope here.
export class EmploymentReadinessPage {
  readonly page: Page;
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', {
      level: 1,
      name: 'Employment Readiness Assessment',
    });
  }

  async goto() {
    await this.page.goto('/employment-readiness/take');
  }
}
