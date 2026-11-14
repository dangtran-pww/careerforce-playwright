import type { Page } from '@playwright/test';

import { test, expect } from './fixtures';
import { JobSearchPage } from '../../pages/job-search.page';
import {
  KEYWORD,
  NURSE_SEARCH,
  expectFitsWidth,
  expectNoSideScroll,
  loginDialogControls,
  openFirstNurseJob,
} from './helpers/posting-accessibility';

// spec: test-suites/job-search/functional-job-search-posting-accessibility.md (RS-1 to RS-3)
// seed: tests/seed.spec.ts
//
// Each case sets the browser to 390 × 844 itself, so the cases run on
// desktop only. A visitor who isn't logged in; nothing is changed. The
// layout checks are soft, so one overflowing state doesn't hide the next.

const PHONE = { width: 390, height: 844 };
const PLACE = 'Saint Paul, MN';

test.describe('At phone width', { tag: '@desktop-only' }, () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(PHONE);
  });

  test('RS-1: Search at phone width', async ({ page }) => {
    const jobs = new JobSearchPage(page);

    // 1. Type "nurse" in Keyword and "Saint Paul, MN" in Location.
    await test.step('1. Type "nurse" in Keyword and "Saint Paul, MN" in Location.', async () => {
      await page.goto('/job-search');
      await expectNoSideScroll(page, '/job-search');
      await jobs.keywordInput.fill(KEYWORD);
      await jobs.locationInput.click();
      await jobs.locationInput.pressSequentially(PLACE);
      // The suggestion list may open over the Search button; picking the
      // same place closes it and leaves the typed value.
      const suggestion = jobs.locationSuggestions.filter({
        hasText: /^\s*Saint Paul, MN\s*$/,
      });
      if (await suggestion.first().isVisible())
        await suggestion.first().click();
      await expect(jobs.locationInput).toHaveValue(PLACE);
      await expectFitsWidth(
        page.locator('main form').first(),
        'the search form',
      );
    });

    // 2. Search.
    await test.step('2. Search.', async () => {
      await jobs.searchButton.click();
      await jobs.waitForParams({ title: KEYWORD });
      expect(
        jobs.params().get('location[text]'),
        'the address has the location',
      ).toBe(PLACE);
      await expect(
        jobs.cards.first(),
        'at least 1 job is listed',
      ).toBeVisible();
      await expectNoSideScroll(page, 'the results');
      await expectFitsWidth(
        page.locator('main form').first(),
        'the search form',
      );
      await expectFitsWidth(jobs.cards, 'the job cards');
    });
  });

  test('RS-2: Company filter at phone width', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    let total = 0;
    let company = { value: '', name: '', count: 0 };

    // 1. Open "Filters".
    await test.step('1. Open "Filters".', async () => {
      await page.goto(NURSE_SEARCH);
      await expect(jobs.cards.first()).toBeVisible();
      total = await jobs.resultCount();
      await expectNoSideScroll(page, 'the search, drawer closed');
      await expect(
        jobs.openFiltersButton,
        'the "Filters" button',
      ).toBeVisible();
      await jobs.openFiltersButton.click();
      for (const [name, control] of [
        ['Company', jobs.companySelect],
        ['City', jobs.citySelect],
        ['Save search', jobs.saveSearchLink],
      ] as const) {
        await expect(control, `${name} should be in the drawer`).toBeVisible();
        await expect
          .poll(() => jobs.isOnTop(control), {
            message: `${name} should be usable, not covered`,
          })
          .toBe(true);
      }
      await expectNoSideScroll(page, 'the drawer open');
      await expectFitsWidth(
        page.locator('main form').filter({ has: jobs.companySelect }),
        'the drawer',
      );
    });

    // 2. Pick the company with the most jobs.
    await test.step('2. Pick the company with the most jobs.', async () => {
      [company] = await jobs.topOptions(jobs.companySelect, 1);
      expect(
        company,
        'the Company dropdown should list at least 1 company',
      ).toBeDefined();
      await jobs.companySelect.selectOption(company.value);
      await jobs.filterButton.click();
      await jobs.waitForParams({ company: company.value });
      await expect(jobs.cards.first()).toBeVisible();
      for (const card of await jobs.cards.all()) {
        await expect(
          jobs.cardCompany(card),
          `every job should be from ${company.name}`,
        ).toHaveText(company.name);
      }
      await expectNoSideScroll(page, 'the filtered results, drawer closed');
      await expectFitsWidth(jobs.cards, 'the job cards');
    });

    // 3. Open "Filters" again and clear the company.
    await test.step('3. Open "Filters" again and clear the company.', async () => {
      await jobs.openFiltersButton.click();
      await expect(jobs.companySelect).toBeVisible();
      await expectNoSideScroll(page, 'the drawer open again');
      await jobs.companySelect.selectOption('');
      await jobs.filterButton.click();
      await page.waitForURL((url) => !url.searchParams.get('company'));
      expect(
        await jobs.resultCount(),
        'the original total should be back',
      ).toBe(total);
      await expectNoSideScroll(page, 'the cleared search');
    });
  });

  test('RS-3: The login dialog at phone width', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    const { dialog, heading, login, continueBrowsing, staffLogin, close } =
      loginDialogControls(jobs);

    const expectDialogFits = async (from: string) => {
      await expect(
        dialog,
        `${from} should open the login dialog`,
      ).toBeVisible();
      for (const [name, part] of [
        ['its text', heading],
        ['"Log In or Register"', login],
        ['"Continue Browsing"', continueBrowsing],
        ['"DEED staff and partners log in here."', staffLogin],
        ['its close button', close],
      ] as const) {
        await expect(part, `${name} should be visible`).toBeVisible();
        await expect
          .poll(() => jobs.isOnTop(part), {
            message: `${name} (dialog from ${from}) should be on top, not behind another layer`,
          })
          .toBe(true);
      }
      await expectFitsWidth(dialog, `the login dialog from ${from}`);
      const box = await dialog.boundingBox();
      expect
        .soft(
          box && box.x >= 0 && box.x + box.width <= PHONE.width,
          `the dialog from ${from} should fit the screen width`,
        )
        .toBe(true);
      await expectNoSideScroll(page, `the login dialog from ${from}`);
    };
    const expectUsable = async (what: string, page: Page) => {
      await expect(dialog, 'the dialog should close').toBeHidden();
      await expect
        .poll(() => jobs.isOnTop(jobs.readMoreLink(jobs.cards.first())), {
          message: `after closing the dialog from ${what}, the page should be usable`,
        })
        .toBe(true);
      await expectNoSideScroll(page, `after closing the dialog from ${what}`);
    };

    // 1. Open the login dialog from the first job's bookmark icon. 2. Close it.
    await test.step("1–2. Open the login dialog from the first job's bookmark icon, then close it.", async () => {
      const job = await openFirstNurseJob(page);
      await jobs.bookmarkLink(job.card).click();
      await expectDialogFits('the bookmark icon');
      await close.click();
      await expectUsable('the bookmark icon', page);
    });

    // 3. Open "Filters", click "Save search", and close the dialog.
    await test.step('3. Open "Filters", click "Save search", and close the dialog.', async () => {
      await jobs.openFiltersButton.click();
      await jobs.saveSearchLink.click();
      await expectDialogFits('"Save search" in the drawer');
      await close.click();
      await expect(dialog, 'the dialog should close').toBeHidden();
      await expectNoSideScroll(
        page,
        'after closing the dialog from "Save search"',
      );
    });

    // 4. Then open the first job's "Read more".
    await test.step('4. Open the first job\'s "Read more".', async () => {
      await jobs.readMoreLink(jobs.cards.first()).click();
      await page.waitForURL((url) => url.searchParams.has('jvid'));
      await expect(jobs.cards).toHaveCount(1);
      await expectNoSideScroll(page, 'the job on its own');
      await expectFitsWidth(jobs.cards, 'the job on its own');
    });
  });
});
