import { type Locator, type Page } from '@playwright/test';

export class HomePage {
  readonly page: Page;
  readonly main: Locator;
  readonly jobSearchHeading: Locator;
  readonly whatBringsYouHereHeading: Locator;
  readonly upcomingEventsHeading: Locator;
  readonly exploreCareersHeading: Locator;
  readonly upcomingTrainingProgramsHeading: Locator;
  readonly createAccountCta: Locator;
  readonly connectToServicesHeading: Locator;
  readonly blogHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.main = page.locator('main');
    this.jobSearchHeading = page.getByRole('heading', { name: 'Job Search' });
    this.whatBringsYouHereHeading = page.getByRole('heading', {
      name: 'What brings you here today?',
    });
    this.upcomingEventsHeading = page.getByRole('heading', {
      name: 'Upcoming Events',
    });
    this.exploreCareersHeading = page.getByRole('heading', {
      name: 'Explore Careers',
    });
    this.upcomingTrainingProgramsHeading = page.getByRole('heading', {
      name: 'Upcoming Training Programs',
    });
    this.createAccountCta = page.getByRole('heading', {
      name: 'Get the most out of CareerForce, create an account',
    });
    this.connectToServicesHeading = page.getByRole('heading', {
      name: 'Connect to our Services',
    });
    this.blogHeading = page.getByRole('heading', { name: 'CareerForce Blog' });
  }

  async goto() {
    await this.page.goto('/');
  }

  // The GTM module here self-hosts gtm.js rather than loading it from
  // googletagmanager.com, so reading the container ID out of the rendered
  // HTML is more reliable than watching for a specific network request.
  async gtmContainerId(): Promise<string | undefined> {
    const html = await this.page.content();
    return html.match(/GTM-[A-Z0-9]+/)?.[0];
  }

  // The Decision Tree's options sit inside a native <details>/<summary>
  // disclosure ("Choose a path") that starts collapsed below ~900px tall
  // viewports — the options are in the DOM but not actually visible until
  // the <summary> is clicked open.
  decisionTreeToggle(): Locator {
    return this.page.locator('summary.decision-tree-question-toggle');
  }

  // The options themselves are plain links to
  // /homepage?decision-tree-id=...&decision-tree-to=N; Drupal renders the
  // next step server-side from that query string alone, so following one is
  // just navigation — nothing is written.
  firstDecisionTreeOption(): Locator {
    return this.page.locator('a[href*="decision-tree-to="]').first();
  }

  resetDecisionTreeButton(): Locator {
    return this.page.getByRole('button', { name: 'Reset selections' });
  }
}
