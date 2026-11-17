import { type Locator, type Page } from '@playwright/test';

// The Employment Readiness Assessment, /employment-readiness/take: 12
// questions (one radio group each) on one page. Each answer shows a
// "Recommendation based on your selection" below it straight away. There is
// no Submit: "Printable Version" posts the form to a new tab, which shows
// "Employment Readiness Assessment Results". Nothing is saved on the account,
// for a visitor or a job seeker.
const FORM_SELECTOR = 'form.quiz';

export class EmploymentReadinessPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly recommendations: Locator;
  readonly printableButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', {
      level: 1,
      name: 'Employment Readiness Assessment',
    });
    this.recommendations = page
      .locator(FORM_SELECTOR)
      .getByText('Recommendation based on your selection');
    this.printableButton = page.getByRole('button', {
      name: 'Printable Version',
    });
  }

  async goto() {
    await this.page.goto('/employment-readiness/take');
  }

  // Picks the first answer of every question. Returns how many it answered.
  async answerAll(): Promise<number> {
    const groupNames = await this.page
      .locator(`${FORM_SELECTOR} input[type="radio"]`)
      .evaluateAll((inputs) => [
        ...new Set(inputs.map((input) => (input as HTMLInputElement).name)),
      ]);
    for (const name of groupNames) {
      await this.page.locator(`input[name="${name}"]`).first().check();
    }
    return groupNames.length;
  }

  // Clicks "Printable Version" and returns the results tab it opens.
  async openPrintableResults(): Promise<Page> {
    const [results] = await Promise.all([
      this.page.context().waitForEvent('page'),
      this.printableButton.click(),
    ]);
    await results.waitForLoadState('load');
    return results;
  }

  static resultsHeading(results: Page): Locator {
    return results.getByRole('heading', {
      name: 'Employment Readiness Assessment Results',
    });
  }
}
