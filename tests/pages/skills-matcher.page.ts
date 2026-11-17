import { type Locator, type Page } from '@playwright/test';

import { OccupationSuggestions } from './occupation-suggestions';

// The Skills Matcher form has 40 skill groups (5 radios each), paginated in
// batches of 10, and validates "Please answer at least 10 questions" before
// it will submit — it does not require all 40. All 10 groups on the first
// page are visible/answerable at once with no navigation needed. The Submit
// button only exists on the form's last page, though — it's hidden
// (`cf-hidden`) until you click through "Continue" regardless of how many
// questions you've answered — so answering page 1 and then continuing to
// the end is enough. Submission is AJAX (no full page reload) and works for
// an anonymous visitor. The results step, with "Update Career Goals", is
// `suggestions` (./occupation-suggestions.ts). A job seeker's answers are
// saved, so goto() clicks "Start Over" when the page opens on saved results.
const FORM_SELECTOR = '#careerforce-skills-assessment-form';
const MIN_ANSWERED = 10;
const MAX_CONTINUE_CLICKS = 5;

export class SkillsMatcherPage {
  readonly page: Page;
  readonly resultsHeading: Locator;
  readonly suggestions: OccupationSuggestions;

  constructor(page: Page) {
    this.page = page;
    this.resultsHeading = page.getByText('Matching Careers By My Skills');
    this.suggestions = new OccupationSuggestions(page);
  }

  async goto() {
    await this.page.goto('/occupations/skills_matcher');
    await this.suggestions.startOverIfShowingResults(
      this.page.locator(`${FORM_SELECTOR} input[type="radio"]`).first(),
    );
  }

  async answerSkills(count = MIN_ANSWERED) {
    const groupNames = await this.page
      .locator(`${FORM_SELECTOR} input[type="radio"]`)
      .evaluateAll((inputs) => [
        ...new Set(inputs.map((input) => (input as HTMLInputElement).name)),
      ]);

    for (const name of groupNames.slice(0, count)) {
      await this.page.locator(`input[name="${name}"]`).first().check();
    }
  }

  async submit() {
    const sendButton = this.page.locator('#edit-send');
    for (let i = 0; i < MAX_CONTINUE_CLICKS; i++) {
      if (await sendButton.isVisible()) break;
      await this.page.locator('a.skills-continue').click();
    }
    await sendButton.click();
  }
}
