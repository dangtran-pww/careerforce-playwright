import { expect, type Locator, type Page } from '@playwright/test';

// A Search API index page (/admin/config/search/search-api/index/<id>):
// read the "N/M indexed" progress, rebuild tracking, and run "Index now".
// Progress/status selectors are the ones AR-3 already uses
// (tests/smoke/admin-reports/admin-reports.spec.ts).
//
// The button labels and the confirm step are Search API defaults and have
// NOT been checked against a live admin session yet — see the plan's status.
export class SearchApiIndexPage {
  readonly page: Page;
  readonly machineName: string;
  readonly progressDescription: Locator;
  readonly statusRow: Locator;
  readonly statusMessages: Locator;
  readonly errorMessages: Locator;

  constructor(page: Page, machineName: string) {
    this.page = page;
    this.machineName = machineName;
    this.progressDescription = page.locator(
      '.search-api-index-status .progress__description',
    );
    this.statusRow = page.locator('.search-api-index-summary--status');
    this.statusMessages = page.locator('.messages--status');
    this.errorMessages = page.locator('.messages--error');
  }

  async goto() {
    await this.page.goto(
      `/admin/config/search/search-api/index/${this.machineName}`,
    );
  }

  async progress(): Promise<{ indexed: number; total: number; text: string }> {
    const text = (await this.progressDescription.textContent())?.trim() ?? '';
    const match = text.match(/^(\d+)\/(\d+)\s+indexed/i);
    return {
      indexed: match ? Number(match[1]) : NaN,
      total: match ? Number(match[2]) : NaN,
      text,
    };
  }

  async statusRowHasError(): Promise<boolean> {
    const cls = (await this.statusRow.getAttribute('class')) ?? '';
    return /\berror\b/.test(cls);
  }

  // "Rebuild tracking information" goes to a confirm form; confirming may
  // run a tracking batch before landing back on the index page.
  async rebuildTracking(batchTimeout: number) {
    await this.page
      .getByRole('button', { name: 'Rebuild tracking information' })
      .click();
    await this.page.waitForURL(/\/rebuild-tracking/);
    await this.page.getByRole('button', { name: /confirm|rebuild/i }).click();
    await waitForBatch(this.page, batchTimeout);
    await this.goto();
  }

  async indexNow(batchTimeout: number) {
    await this.page.getByRole('button', { name: 'Index now' }).click();
    await waitForBatch(this.page, batchTimeout);
  }
}

// Drupal batch API: the action redirects to /batch?id=…, which polls until
// done and then redirects away. Small jobs can skip the batch page, so the
// first wait is allowed to miss.
export async function waitForBatch(page: Page, timeout: number) {
  await page.waitForURL(/\/batch\b/, { timeout: 15_000 }).catch(() => {});
  await page.waitForURL((url) => !url.pathname.startsWith('/batch'), {
    timeout,
  });
  await expect(page.locator('.messages--error')).toHaveCount(0);
}
