import { type Locator, type Page } from '@playwright/test';

// Shared base for both keyword-search pages Phase 1 covers: the General
// site search (/search?k=...) and the Explore Careers occupation search
// (/explore/careers?otitle=...). Both are the same Drupal view pattern —
// a "Search results X-Y of Z" summary heading and one .views-row per result.
export class SearchPage {
  readonly page: Page;
  readonly resultSummary: Locator;
  readonly resultRows: Locator;
  private readonly path: string;
  private readonly queryParam: string;

  constructor(page: Page, path: string, queryParam: string) {
    this.page = page;
    this.path = path;
    this.queryParam = queryParam;
    this.resultSummary = page.locator('.view-header__result-summary-header');
    this.resultRows = page.locator('.views-row');
  }

  // Empty/omitted keyword hits the view with no filter, which here renders
  // the full index rather than an empty state — that's the baseline check.
  async search(keyword = '') {
    const query = keyword ? `?${this.queryParam}=${encodeURIComponent(keyword)}` : '';
    await this.page.goto(`${this.path}${query}`);
  }

  async resultCount(): Promise<number> {
    const text = await this.resultSummary.textContent();
    const match = text?.match(/of (\d+)/);
    return match ? Number(match[1]) : 0;
  }
}
