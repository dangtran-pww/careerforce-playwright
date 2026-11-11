import { expect, type Locator, type Page } from '@playwright/test';
import type { Results } from '../helpers/results';

export type JobFilterOption = {
  value: string;
  // The option text without its "(n)" job count, e.g. "Albert Lea, MN".
  name: string;
  count: number;
};

// Job search (/job-search). A GET form like the other listings: the keyword
// is `title`, and the sidebar filters are `company` and `loc` (City), whose
// option values encode punctuation as "~D~" (comma) and "~A~" (period), e.g.
// "Albert Lea~D~ MN". The jobs come from an outside feed, so which companies
// and cities exist is read from the dropdowns at run time, never hard-coded.
export class JobSearchPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly keywordInput: Locator;
  // A combobox: typing shows suggestions in `locationSuggestions`.
  readonly locationInput: Locator;
  readonly locationSuggestions: Locator;
  readonly distanceSelect: Locator;
  readonly sortSelect: Locator;
  readonly searchButton: Locator;
  readonly resetLink: Locator;
  // The inline message under Keyword when the server rejects it.
  readonly keywordError: Locator;
  readonly noResults: Locator;
  readonly pager: Locator;
  readonly resultSummary: Locator;
  readonly cards: Locator;
  readonly companySelect: Locator;
  readonly citySelect: Locator;
  // Submits the Company/City filter form (on a phone, inside the drawer).
  readonly filterButton: Locator;
  readonly saveSearchLink: Locator;
  readonly openFiltersButton: Locator;
  // "Jobs for me", logged in only: a category select ("Bookmarked jobs",
  // "Saved searches", ...) and a second select with that category's items.
  // Picking an item opens its search. A category with no items isn't listed.
  readonly jobsForMeCategory: Locator;
  readonly jobsForMeItem: Locator;
  // Logged in, Save search opens this instead of the login dialog.
  readonly saveSearchDialog: Locator;
  // Save search and Bookmark both open this for an anonymous visitor: a
  // modal asking them to log in or register. Both use the same heading
  // ("Log in or register to save your search"), so tests don't rely on it.
  readonly loginDialog: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { level: 1, name: 'Job Search' });
    this.keywordInput = page.locator('main input[name="title"]');
    this.locationInput = page.locator('main input[name="location[text]"]');
    this.locationSuggestions = page
      .locator('#edit-location-text-listbox')
      .getByRole('option');
    this.distanceSelect = page.locator('main select[name="radius"]');
    this.sortSelect = page.locator('main select[name="sort"]');
    this.searchButton = page
      .getByRole('main')
      .getByRole('button', { name: 'Search', exact: true });
    this.resetLink = page
      .getByRole('main')
      .getByRole('link', { name: 'Reset' });
    this.keywordError = page.locator(
      'main .form-item-title .form-item--error-message',
    );
    this.noResults = page.locator('main .no-results');
    this.pager = page
      .getByRole('main')
      .getByRole('navigation', { name: /pag/i });
    // "Showing 500 jobs". Same class as the other listings' summary, but the
    // wording differs, so SearchPage.resultCount() doesn't parse it.
    this.resultSummary = page.locator(
      'main .view-header__result-summary-header',
    );
    this.cards = page.locator('main .job-search-result');
    this.companySelect = page.locator('main select[name="company"]');
    this.citySelect = page.locator('main select[name="loc"]');
    this.filterButton = page
      .getByRole('main')
      .getByRole('button', { name: 'Filter', exact: true });
    this.saveSearchLink = page
      .getByRole('main')
      .getByRole('link', { name: 'Save search' });
    const jobsForMe = page.locator('form.careerforce-jobs-for-me-form');
    this.jobsForMeCategory = jobsForMe.getByLabel('My job categories');
    this.jobsForMeItem = jobsForMe.locator('select[name="action"]');
    this.saveSearchDialog = page.getByRole('dialog').filter({
      has: page.getByRole('heading', {
        name: 'Save this search to your dashboard',
      }),
    });
    this.openFiltersButton = page.getByRole('button', { name: 'Open filters' });
    this.loginDialog = page.getByRole('dialog');
  }

  // On a phone, the Company/City filters and Save search are in a drawer
  // behind a "Filters" button (accessible name "Open filters"). On desktop
  // they're always shown and the button is hidden.
  async showFilters() {
    if (await this.openFiltersButton.isVisible()) {
      await this.openFiltersButton.click();
    }
  }

  // True when nothing covers the middle of the element, i.e. a tap there
  // would reach it. toBeVisible() alone passes for a dialog hidden behind
  // another layer.
  async isOnTop(element: Locator): Promise<boolean> {
    return element.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const hit = document.elementFromPoint(
        box.left + box.width / 2,
        box.top + box.height / 2,
      );
      return hit !== null && (hit === el || el.contains(hit));
    });
  }

  cardTitle(card: Locator): Locator {
    return card.getByRole('heading', { level: 3 });
  }

  // Each card has the apply link twice (one for wide screens, one for
  // phones), both to the employer's posting on an outside site.
  applyLinks(card: Locator): Locator {
    return card.getByRole('link', { name: /^Learn more and apply/ });
  }

  // Opens the job on its own, at /job-search?jvid=<job ID>.
  readMoreLink(card: Locator): Locator {
    return card.getByRole('link', { name: /^Read more/ });
  }

  // Its class shows the state: `bookmark--add` (not bookmarked) or
  // `bookmark--remove` (bookmarked, logged in).
  bookmarkLink(card: Locator): Locator {
    return card.locator('a.bookmark');
  }

  card(jobId: string): Locator {
    return this.cards.and(this.page.locator(`[data-jvid="${jobId}"]`));
  }

  // The line under the title: the company, then the city.
  cardCompany(card: Locator): Locator {
    return card.locator('div.tw-font-semibold > span').first();
  }

  // "Posted 3 days ago".
  cardPosted(card: Locator): Locator {
    return card.locator('span').filter({ hasText: /^\s*Posted\b/ });
  }

  // Only the single-job view shows the full description; list cards show
  // a short .job-description__summary instead.
  fullDescription(card: Locator): Locator {
    return card.locator('.job-description__full');
  }

  async search(params: Record<string, string>) {
    await this.page.goto(`/job-search?${new URLSearchParams(params)}`);
  }

  // The current address's search values, e.g. { title: 'nurse', loc: ... }.
  params(): URLSearchParams {
    return new URL(this.page.url()).searchParams;
  }

  // Waits until the address has every given value (after a click on Search,
  // Filter or a sort change, the page reloads with the new address).
  async waitForParams(expected: Record<string, string>) {
    await this.page.waitForURL((url) =>
      Object.entries(expected).every(
        ([key, value]) => url.searchParams.get(key) === value,
      ),
    );
  }

  // The item names "Jobs for me" lists under a category, or [] when the
  // category isn't offered (it has no items).
  async jobsForMeItems(category: string): Promise<string[]> {
    const categories = await this.jobsForMeCategory
      .locator('option')
      .allTextContents();
    if (!categories.map((c) => c.trim()).includes(category)) return [];
    await this.jobsForMeCategory.selectOption({ label: category });
    const items = await this.jobsForMeItem
      .locator('option')
      .evaluateAll((els) =>
        els
          .filter((el) => (el as HTMLOptionElement).value !== '')
          .map((el) => el.textContent?.trim() ?? ''),
      );
    // Back to the placeholder, so the item select doesn't stay open.
    await this.jobsForMeCategory.selectOption({ index: 0 });
    return items;
  }

  // Picks a "Jobs for me" item, which opens its search.
  async openJobsForMe(category: string, item: string) {
    await this.jobsForMeCategory.selectOption({ label: category });
    await this.jobsForMeItem.selectOption({ label: item });
  }

  // Opens the "Save this search" dialog (logged in; on a phone, from the
  // filters drawer) and checks it is on top: a dialog left behind the drawer
  // is visible to toBeVisible() but its buttons can't be tapped.
  async openSaveSearchDialog() {
    await this.showFilters();
    await this.saveSearchLink.click();
    await expect(this.saveSearchDialog).toBeVisible();
    await expect
      .poll(
        () =>
          this.isOnTop(
            this.saveSearchDialog.getByRole('button', {
              name: 'Save',
              exact: true,
            }),
          ),
        {
          message:
            'The "Save this search" dialog should be on top, not covered by another layer (on a phone, the filters drawer)',
        },
      )
      .toBe(true);
  }

  // Saves the current search under `name` (logged in). The saved search keeps
  // the address of the page it was saved from.
  async saveSearch(name: string) {
    await this.openSaveSearchDialog();
    await this.saveSearchDialog.getByLabel('Name job search').fill(name);
    await this.saveSearchDialog
      .getByRole('button', { name: 'Save', exact: true })
      .click();
  }

  // Waits for the results (or "No results found.") first: after a click on
  // Search, the URL changes before the new results are on the page.
  async resultCount(): Promise<number> {
    await this.resultSummary.or(this.noResults).first().waitFor();
    if ((await this.resultSummary.count()) === 0) return 0;
    const text = (await this.resultSummary.first().textContent()) ?? '';
    const match = text.match(/Showing\s+([\d,]+)\s+jobs?/i);
    return match ? Number(match[1].replace(/,/g, '')) : 0;
  }

  // Items are the job IDs (data-jvid), which are unique per posting even
  // when several postings share a title.
  async results(): Promise<Results> {
    return {
      total: await this.resultCount(),
      items: await this.cards.evaluateAll((els) =>
        els.map((el) => el.getAttribute('data-jvid') ?? ''),
      ),
    };
  }

  // Every city in the City filter, e.g. "Albert Lea, MN". The filter lists
  // the whole result set, not just the first page, so it shows how far a
  // search reaches even when "Showing N jobs" is capped at 500.
  async cities(): Promise<JobFilterOption[]> {
    return this.topOptions(this.citySelect, Infinity);
  }

  // The options of a filter dropdown with the most jobs first, skipping the
  // "List of companies" / "List of cities" placeholder.
  async topOptions(
    select: Locator,
    howMany: number,
  ): Promise<JobFilterOption[]> {
    const options = await select.locator('option').evaluateAll((els) =>
      els.map((el) => ({
        value: (el as HTMLOptionElement).value,
        text: el.textContent?.trim() ?? '',
      })),
    );
    return options
      .filter((option) => option.value !== '')
      .map((option) => {
        const match = option.text.match(/^(.*)\s+\((\d+)\)$/);
        return {
          value: option.value,
          name: match ? match[1] : option.text,
          count: match ? Number(match[2]) : 0,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, howMany);
  }
}
