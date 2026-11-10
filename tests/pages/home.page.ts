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
    // The heading's name starts with a search icon drawn as an icon-font
    // character (U+F002), so allow that before an otherwise exact match.
    this.jobSearchHeading = page.getByRole('heading', { name: /^\W*Job Search$/ });
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
      exact: true,
    });
    this.upcomingEventsHeading = page.getByRole('heading', {
      name: 'Upcoming Events',
      exact: true,
    });
    this.exploreCareersHeading = page.getByRole('heading', {
      name: 'Explore Careers',
      exact: true,
    });
    this.upcomingTrainingProgramsHeading = page.getByRole('heading', {
      name: 'Upcoming Training Programs',
      exact: true,
    });
    this.createAccountCta = page.getByRole('heading', {
      name: 'Get the most out of CareerForce, create an account',
      exact: true,
    });
    this.connectToServicesHeading = page.getByRole('heading', {
      name: 'Connect to our Services',
      exact: true,
    });
    this.blogHeading = page.getByRole('heading', { name: 'CareerForce Blog', exact: true });
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
  // The first question's toggle. Once a path is picked, the follow-up
  // question ("Tell us more.") adds a second toggle of its own.
  decisionTreeToggle(): Locator {
    return this.page.locator('summary.decision-tree-question-toggle').first();
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

  // The card titles (h3), in order. They change with each step.
  async decisionTreeCardTitles(): Promise<string[]> {
    return (await this.decisionTreeCards().getByRole('heading', { level: 3 }).allTextContents()).map(
      (t) => t.trim(),
    );
  }

  // Picking a path updates the widget in place (the URL doesn't change) and
  // adds this follow-up question.
  decisionTreeFollowUp(): Locator {
    return this.page.locator('.decision-tree').getByRole('heading', { name: 'Tell us more.' });
  }

  // Each homepage listing section is a Drupal view, found by its view class:
  // '.view-display-id-upcoming_events', '.view-display-id-upcoming_training_programs',
  // '.view-id-featured_services', '.view-id-article_content'. Events and
  // Training load after the page does, so wait for their items.
  sectionItems(viewClass: string): Locator {
    return this.page.locator(`main ${viewClass} article`);
  }

  // A listing section's link to its full list, inside that section's view.
  // Some of these links end with an arrow icon added by CSS (::after, an
  // icon-font character), which counts as part of the link's name, so allow
  // that after an otherwise exact match.
  sectionMoreLink(viewClass: string, name: string): Locator {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this.page
      .locator(`main ${viewClass}`)
      .getByRole('link', { name: new RegExp(`^${escaped}\\W*$`) });
  }

  // The Explore Careers box: a GET form to /explore/careers?otitle=...
  // Scoped to its form, as the page has several other "Search" buttons.
  get exploreCareersForm(): Locator {
    return this.page.locator('main form[action="/explore/careers"]');
  }

  get exploreCareersInput(): Locator {
    return this.exploreCareersForm.getByRole('textbox', {
      name: 'Search by career title or keyword',
    });
  }

  get exploreCareersButton(): Locator {
    return this.exploreCareersForm.getByRole('button', { name: 'Search' });
  }
}
