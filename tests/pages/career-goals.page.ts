import { expect, type Locator, type Page } from '@playwright/test';

export type CareerTool = 'skills-matcher' | 'interest-profiler';

// The job seeker's "My Goals & Experience" tab, /user/<their user ID>/
// skills-experience. Career goals are not on the Dashboard tab (/user) but
// here, in the "My Career Goals" section (#career-goals-ajax-wrapper). Each
// goal is a card that the page fills in after it loads ("Loading..." until
// then), with an "x" link (a.occupation-remove) whose address holds the
// career's SOC code: /careerforce/ajax/career_goals/remove/<SOC>?token=…
// Clicking it removes the goal in the background and reloads the page.
//
// Above the goals, a card per career tool. A tool whose answers are saved on
// the account says "See my … results" instead of "Take our …".
//
// A job seeker can have at most 6 career goals.
export const MAX_GOALS = 6;

export class CareerGoalsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly goalsSection: Locator;
  readonly statusMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', {
      level: 1,
      name: 'My Goals & Experiences',
    });
    this.goalsSection = page.locator('#career-goals-ajax-wrapper');
    this.statusMessage = page.getByRole('contentinfo', {
      name: 'Status message',
    });
  }

  // /user opens /user/<ID>; the tab is that address plus /skills-experience.
  async goto() {
    await this.page.goto('/user');
    const userPath = new URL(this.page.url()).pathname.replace(/\/$/, '');
    await this.page.goto(`${userPath}/skills-experience`);
    await this.waitForGoals();
  }

  // The goal cards are drawn after the page loads.
  async waitForGoals() {
    await expect(this.heading).toBeVisible();
    await expect(
      this.goalsSection.locator('.occupation-display--loading'),
    ).toHaveCount(0);
  }

  removeLink(soc: string): Locator {
    return this.goalsSection.locator(
      `a.occupation-remove[href*="/career_goals/remove/${soc}?"]`,
    );
  }

  // The site's script adds the "x" as the first child of the goal's card.
  goal(soc: string): Locator {
    return this.removeLink(soc).locator('xpath=..');
  }

  // The page can show the same message in more than one place.
  message(text: string): Locator {
    return this.statusMessage.filter({ hasText: text }).first();
  }

  async goalCount(): Promise<number> {
    return this.goalsSection.locator('a.occupation-remove').count();
  }

  // Clicks the goal's "x", waits for the site to answer and the page to
  // reload.
  async remove(soc: string) {
    const link = this.removeLink(soc);
    const href = (await link.getAttribute('href')) ?? '';
    const path = new URL(href, this.page.url()).pathname;
    const [response] = await Promise.all([
      this.page.waitForResponse((r) => new URL(r.url()).pathname === path),
      link.click(),
    ]);
    expect(response.ok(), `removing career goal ${soc}`).toBe(true);
    await this.page.waitForLoadState('load');
    await this.waitForGoals();
  }

  // Cleanup: removes these goals if they are there. Never touches others.
  async cleanUp(socs: string[]) {
    if (socs.length === 0) return;
    await this.goto();
    for (const soc of socs) {
      if ((await this.removeLink(soc).count()) > 0) await this.remove(soc);
    }
  }

  // Fails with a clear message when the account has no room for `needed`
  // more goals, rather than removing goals the test didn't add.
  async expectRoom(needed = 1) {
    await this.goto();
    const count = await this.goalCount();
    expect(
      count,
      `The job seeker account has ${count} of ${MAX_GOALS} career goals; ` +
        `this test needs ${needed} free. Remove some by hand ` +
        `(My Goals & Experience, "x").`,
    ).toBeLessThanOrEqual(MAX_GOALS - needed);
  }

  toolCard(tool: CareerTool): Locator {
    return this.page.locator(`.career-tool-card-${tool}`);
  }
}
