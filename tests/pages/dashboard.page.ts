import { type Locator, type Page, type Response } from '@playwright/test';

export type DashboardGroup = 'Saved searches' | 'Bookmarked jobs';

// The job seeker's dashboard (/user, which opens /user/<their user ID>).
// Its "Jobs For Me" block (the dashboard_jobs view) has two collapsible
// groups, "Saved searches" and "Bookmarked jobs". Each item is a list item
// with a link (the saved search's name, or the job's title) and a remove
// ("x") link, which removes the item in the background and then drops the
// list item from the page.
export class DashboardPage {
  readonly page: Page;
  readonly jobsHeading: Locator;
  readonly savedSearches: Locator;
  readonly bookmarks: Locator;

  constructor(page: Page) {
    this.page = page;
    this.jobsHeading = page.getByRole('heading', {
      level: 2,
      name: /jobs for me/i,
    });
    this.savedSearches = this.group('Saved searches');
    this.bookmarks = this.group('Bookmarked jobs');
  }

  async goto() {
    await this.page.goto('/user');
  }

  group(name: DashboardGroup): Locator {
    return this.page
      .locator('main .dashboard-jobs-item details')
      .filter({ has: this.page.locator('summary', { hasText: name }) });
  }

  // The groups are closed <details> until clicked.
  async open(name: DashboardGroup): Promise<Locator> {
    const group = this.group(name);
    if ((await group.getAttribute('open')) === null) {
      await group.locator('summary').click();
    }
    return group;
  }

  items(group: Locator): Locator {
    return group.locator('li');
  }

  // The message a group shows when it has no items.
  emptyMessage(name: DashboardGroup): Locator {
    const text =
      name === 'Saved searches'
        ? 'You have no saved searches.'
        : 'You have no saved jobs.';
    return this.group(name).getByText(text);
  }

  savedSearch(name: string): Locator {
    return this.items(this.savedSearches).filter({
      has: this.page.getByRole('link', { name, exact: true }),
    });
  }

  // By job ID: several postings can share a title. Both the title link
  // (/job-search?jvid=<ID>) and the remove link contain the ID.
  bookmark(jobId: string): Locator {
    return this.items(this.bookmarks).filter({
      has: this.page.locator(`a[href*="jvid=${jobId}"]`),
    });
  }

  // The link's accessible name starts with an icon-font glyph
  // (" Remove saved job search"), so the pattern is not anchored at the start.
  removeLink(item: Locator): Locator {
    return item.getByRole('link', {
      name: /Remove (saved job search|bookmarked job)$/,
    });
  }

  // Clicks an item's "x" and waits for the site to answer.
  async remove(item: Locator): Promise<Response> {
    const link = this.removeLink(item);
    const href = (await link.getAttribute('href')) ?? '';
    const path = new URL(href, this.page.url()).pathname;
    const [response] = await Promise.all([
      this.page.waitForResponse((r) => new URL(r.url()).pathname === path),
      link.click(),
    ]);
    return response;
  }

  async savedSearchNames(): Promise<string[]> {
    await this.open('Saved searches');
    const names = this.items(this.savedSearches).locator(
      'a:not(.remove-field-link)',
    );
    return (await names.allTextContents()).map((text) => text.trim());
  }

  async bookmarkCount(): Promise<number> {
    await this.open('Bookmarked jobs');
    return this.items(this.bookmarks).count();
  }

  // Frees room for `needed` more saved searches when the account is near its
  // limit: removes leftover "Playwright test …" searches first, then the
  // newest others. Returns the names it removed.
  async makeRoomForSearches(needed: number, limit: number): Promise<string[]> {
    await this.goto();
    const names = await this.savedSearchNames();
    const excess = names.length - (limit - needed);
    if (excess <= 0) return [];
    const isTest = (name: string) => name.startsWith('Playwright test');
    const toRemove = [
      ...names.filter(isTest).reverse(),
      ...names.filter((name) => !isTest(name)).reverse(),
    ].slice(0, excess);
    for (const name of toRemove) {
      // The remove link's address holds the item's position, so reload
      // before each removal.
      await this.goto();
      await this.open('Saved searches');
      await this.remove(this.savedSearch(name).first());
    }
    await this.goto();
    return toRemove;
  }

  // Cleanup: removes the saved searches with these names and the bookmarks
  // with these job IDs, if they are there. Never touches anything else.
  async cleanUp({
    searches = [],
    jobIds = [],
  }: {
    searches?: string[];
    jobIds?: string[];
  }) {
    if (searches.length === 0 && jobIds.length === 0) return;
    await this.goto();
    if (searches.length > 0) await this.open('Saved searches');
    for (const name of searches) {
      // A name saved twice is listed twice; stop after a few tries rather
      // than loop if removing fails.
      for (
        let tries = 0;
        tries < 3 && (await this.savedSearch(name).count()) > 0;
        tries++
      ) {
        await this.remove(this.savedSearch(name).first());
        await this.goto();
        await this.open('Saved searches');
      }
    }
    if (jobIds.length > 0) await this.open('Bookmarked jobs');
    for (const jobId of jobIds) {
      if ((await this.bookmark(jobId).count()) > 0) {
        await this.remove(this.bookmark(jobId));
      }
    }
  }
}
