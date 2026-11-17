import { type Locator, type Page } from '@playwright/test';

// The results step that the Skills Matcher and the Interest Profiler share
// (#civiserv-occupation-suggestions-form): a table of suggested careers, each
// with a checkbox named suggestions[<SOC code>], and the buttons "Update Career
// Goals" (visitors: "Update Anonymous Occupations"), "Cancel" and "Start Over".
// A career that is already one of the job seeker's goals has its checkbox
// disabled. Submitting adds the ticked careers to the goals and opens My Goals
// & Experience with "Successfully updated your Career Goals.".
//
// A job seeker's answers are saved on the account, so the next visit opens
// on this results step instead of the questions. "Start Over" deletes the
// saved answers and shows the questions again.
export const RESULTS_FORM = '#civiserv-occupation-suggestions-form';

export class OccupationSuggestions {
  readonly page: Page;
  readonly form: Locator;
  readonly startOverButton: Locator;
  readonly updateGoalsButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.form = page.locator(RESULTS_FORM);
    this.startOverButton = this.form.getByRole('button', {
      name: 'Start Over',
    });
    this.updateGoalsButton = this.form.getByRole('button', {
      name: 'Update Career Goals',
    });
  }

  // If the page opened on saved results, clicks "Start Over" and waits for
  // the questions (`firstQuestion`) to show.
  async startOverIfShowingResults(firstQuestion: Locator) {
    if ((await this.form.count()) === 0) return;
    await this.startOverButton.click();
    await firstQuestion.waitFor();
  }

  // The first suggested career that isn't already a goal.
  firstSelectable(): Locator {
    return this.form
      .locator('input[type="checkbox"][name^="suggestions["]:not([disabled])')
      .first();
  }

  // Ticks the first suggested career that isn't already a goal and returns
  // its SOC code and title.
  async selectFirst(): Promise<{ soc: string; title: string }> {
    const checkbox = this.firstSelectable();
    const name = (await checkbox.getAttribute('name')) ?? '';
    const soc = /^suggestions\[(.+)\]$/.exec(name)?.[1] ?? '';
    // The title is in a hidden span the checkbox is described by.
    const describedBy = (await checkbox.getAttribute('aria-describedby')) ?? '';
    const title = (
      (await this.page.locator(`[id="${describedBy}"]`).textContent()) ?? ''
    ).trim();
    await checkbox.check();
    return { soc, title };
  }
}
