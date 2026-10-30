import { type Locator, type Page } from '@playwright/test';

export class HomePage {
  readonly page: Page;
  readonly main: Locator;
  readonly jobSearchHeading: Locator;
  readonly jobSearchBlock: Locator;
  readonly jobSearchIntro: Locator;
  readonly jobSearchKeywordInput: Locator;
  readonly jobSearchLocationInput: Locator;
  readonly jobSearchDistanceSelect: Locator;
  readonly jobSearchButton: Locator;
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
    // The page has several other "Search" buttons (header, site search), so
    // everything in the Job Search block is scoped to its component root.
    // The field labels are visually hidden but still give accessible names.
    this.jobSearchBlock = page.locator(
      '[data-component-id="careerforce_skin:sdc_job_search"]',
    );
    this.jobSearchIntro = this.jobSearchBlock.getByText('CareerForce is');
    this.jobSearchKeywordInput = this.jobSearchBlock.getByRole('textbox', {
      name: 'Keyword',
    });
    this.jobSearchLocationInput = this.jobSearchBlock.getByRole('combobox', {
      name: 'Location',
    });
    this.jobSearchDistanceSelect = this.jobSearchBlock.getByRole('combobox', {
      name: 'Distance',
    });
    this.jobSearchButton = this.jobSearchBlock.getByRole('button', {
      name: 'Search',
      exact: true,
    });
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

  // The Job Search block's blue isn't on any element's own background — it's
  // a primary-300 → primary-400 gradient painted by the full-width wrapper's
  // ::before (its solid background-color sits underneath, never visible).
  async jobSearchBackgroundImage(): Promise<string> {
    return this.jobSearchBlock
      .locator('.tw-full-width-bg')
      .evaluate((el) => getComputedStyle(el, '::before').backgroundImage);
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

  // Each card is an image plus an <h3> title, both inside one link. The
  // images are role="presentation", so they aren't reachable by role.
  decisionTreeCards(): Locator {
    return this.page.locator('.decision-tree .decision-tree-card');
  }

  // The card images are loading="lazy", and toBeVisible() passes on an
  // image's reserved width/height alone — naturalWidth is only > 0 once
  // the file has actually downloaded and decoded.
  async imageNaturalWidth(image: Locator): Promise<number> {
    return image.evaluate((img: HTMLImageElement) => img.naturalWidth);
  }

  resetDecisionTreeButton(): Locator {
    return this.page.getByRole('button', { name: 'Reset selections' });
  }
}
