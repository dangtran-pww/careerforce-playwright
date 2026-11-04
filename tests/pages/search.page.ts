import { type Locator, type Page } from '@playwright/test';
import type { Results } from '../helpers/results';

// Shared base for the keyword-search pages: the General site search
// (/search?k=...), the Explore Careers occupation search
// (/explore/careers?otitle=...), and the filterable listings that use the
// same "Search results X-Y of Z" summary heading (/programs-services,
// /training-programs). Site and career search put each result in a
// .views-row. The listings don't use .views-row, so they pass their own
// result title selector, inside <main> (e.g. 'article h3 a').
export class SearchPage {
  readonly page: Page;
  readonly resultSummary: Locator;
  readonly resultRows: Locator;
  readonly resultTitles: Locator;
  private readonly path: string;
  private readonly queryParam: string;

  constructor(
    page: Page,
    path: string,
    queryParam: string,
    resultTitleSelector = '.views-row a',
  ) {
    this.page = page;
    this.path = path;
    this.queryParam = queryParam;
    this.resultSummary = page.locator('.view-header__result-summary-header');
    this.resultRows = page.locator('.views-row');
    this.resultTitles = page.locator('main').locator(resultTitleSelector);
  }

  // Any GET params, for the sort and filter controls (all GET forms).
  async searchWith(params: Record<string, string>) {
    const query = new URLSearchParams(params).toString();
    await this.page.goto(query ? `${this.path}?${query}` : this.path);
  }

  async results(): Promise<Results> {
    const total = (await this.resultSummary.count()) === 0 ? 0 : await this.resultCount();
    const items = (await this.resultTitles.allTextContents()).map((t) =>
      t.replace(/\s+/g, ' ').trim(),
    );
    return { total, items };
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
