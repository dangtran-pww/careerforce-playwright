import { type Locator, type Page } from '@playwright/test';

// The Interest Profiler form has 60 activities (5 radios each), paginated
// in batches, and, unlike the Skills Matcher, marks all 60 required — it
// will not submit with any left blank. Unlike Skills Matcher, Submit only
// appears once every question across every page is answered, so this
// answers whatever is visible on each page, clicks Continue, and repeats
// until Submit shows up. Submission is AJAX and works for an anonymous
// visitor.
const FORM_SELECTOR = '#careerforce-interest-profiler-form';
const MAX_PAGES = 10;

export class InterestProfilerPage {
  readonly page: Page;
  readonly resultsHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.resultsHeading = page.getByText('Interest Assessment Results');
  }

  async goto() {
    await this.page.goto('/occupations/interest_profiler');
  }

  async answerAll() {
    const sendButton = this.page.locator('#edit-send');

    for (let i = 0; i < MAX_PAGES; i++) {
      const unansweredGroupNames = await this.page
        .locator(`${FORM_SELECTOR} input[type="radio"]:visible`)
        .evaluateAll((inputs) => [
          ...new Set(
            (inputs as HTMLInputElement[])
              .filter((input) => !input.checked)
              .map((input) => input.name),
          ),
        ]);

      for (const name of unansweredGroupNames) {
        await this.page.locator(`input[name="${name}"]`).first().check();
      }

      if (await sendButton.isVisible()) break;
      await this.page.locator('a.interest-profiler-continue').click();
    }
  }

  async submit() {
    await this.page.locator('#edit-send').click();
  }
}
