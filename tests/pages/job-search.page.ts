import { type Locator, type Page } from '@playwright/test';
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
  readonly resultSummary: Locator;
  readonly cards: Locator;
  readonly companySelect: Locator;
  readonly citySelect: Locator;

  constructor(page: Page) {
    this.page = page;
    // "Showing 500 jobs". Same class as the other listings' summary, but the
    // wording differs, so SearchPage.resultCount() doesn't parse it.
    this.resultSummary = page.locator('main .view-header__result-summary-header');
    this.cards = page.locator('main .job-search-result');
    this.companySelect = page.locator('main select[name="company"]');
    this.citySelect = page.locator('main select[name="loc"]');
  }

  async search(params: Record<string, string>) {
    await this.page.goto(`/job-search?${new URLSearchParams(params)}`);
  }

  async resultCount(): Promise<number> {
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

  // The options of a filter dropdown with the most jobs first, skipping the
  // "List of companies" / "List of cities" placeholder.
  async topOptions(select: Locator, howMany: number): Promise<JobFilterOption[]> {
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
