import { test, expect } from './fixtures';
import { JobSearchPage } from '../../pages/job-search.page';
import type { Results } from '../../helpers/results';
import {
  KEYWORD,
  SORT,
  expectAllFromCompany,
  expectSearchKept,
  formValues,
  highestPagerNumber,
  pagerCurrent,
  pagerLast,
  pagerNext,
  pagerPageLink,
  submitAndWait,
  type FormValues,
} from './helpers/sort-filters';

// spec: test-suites/job-search/functional-job-search-sort-filters-paging.md ("Paging" PG-1 to PG-5, "The address" UR-1 to UR-3)
// seed: tests/seed.spec.ts
//
// A visitor who isn't logged in; nothing is changed, so every case is safe on
// Production. The jobs come from an outside feed, so no job, company or city
// is named here: they are read from the page at run time, and each case
// compares the site with itself.
//
// The checks "Checked in every case" (no JavaScript error, no failed request,
// no raw error) run after every test, from ./fixtures. On a phone the base
// fixtures also check the page doesn't scroll sideways.
//
// Only PG-2 and UR-1 run on the phone (plan → Mobile); the rest are
// @desktop-only.

// The pager counts from 0 and stops at 500 jobs: at most 50 pages.
const LAST_PAGE_PARAM = 49;

test.describe('Paging', () => {
  test('PG-1: The pager shows only when needed', { tag: '@desktop-only' }, async ({ page }) => {
    const jobs = new JobSearchPage(page);

    // 1. Look at the pager.
    await test.step('1. Look at the pager.', async () => {
      await jobs.search({ title: KEYWORD });
      expect(await jobs.resultCount(), 'The search should list more than 10 jobs').toBeGreaterThan(10);
      await expect(jobs.pager, 'With more than 10 jobs, a pager should show').toBeVisible();
    });

    // 2. Find a company that leaves 10 or fewer jobs, from the fewest up.
    await test.step('2. Find a filter that leaves 10 or fewer jobs.', async () => {
      const fewestFirst = (await jobs.topOptions(jobs.companySelect, Infinity)).reverse();
      for (const company of fewestFirst) {
        if (company.count > 10) break;
        await jobs.companySelect.selectOption(company.value);
        await submitAndWait(page, () => jobs.filterButton.click());
        const total = await jobs.resultCount();
        if (total >= 1 && total <= 10) {
          await expect(
            jobs.cards,
            `With ${total} jobs ("${company.name}"), every job should be on one page`,
          ).toHaveCount(total);
          await expect(jobs.pager, `With ${total} jobs ("${company.name}"), no pager should show`).toBeHidden();
          return;
        }
        // Not 1 to 10 after all: back to the unfiltered search, try the next.
        await page.goBack();
      }
      test.info().annotations.push({
        type: 'skipped step',
        description: 'Step 2 skipped: no company in the Company dropdown left 10 or fewer jobs.',
      });
    });
  });

  test('PG-2: Page 2', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    const search = { title: KEYWORD, location: 'Saint Paul, MN', sort: SORT.title.value };
    let page1: Results;

    await jobs.search({ title: search.title, 'location[text]': search.location, sort: search.sort });

    // 1. Note the first page's jobs.
    await test.step("1. Note the first page's jobs.", async () => {
      page1 = await jobs.results();
      expect(page1.total, 'The search should list more than 10 jobs, so there is a page 2').toBeGreaterThan(10);
    });

    // 2. Click page 2.
    await test.step('2. Click page 2.', async () => {
      await submitAndWait(page, () => pagerPageLink(jobs, 2).click());
    });

    expect(jobs.params().get('page'), 'The address should have page=1 (the pager counts from 0)').toBe('1');
    await expectSearchKept(jobs, search, 'On page 2');
    const page2 = await jobs.results();
    expect(page2.items, '10 jobs should be listed on page 2').toHaveLength(10);
    expect(
      page2.items.filter((id) => page1.items.includes(id)),
      'No job on page 2 should also be on page 1',
    ).toEqual([]);
    expect(page2.total, 'The total should be unchanged on page 2').toBe(page1!.total);
    await expect(pagerCurrent(jobs), 'The pager should mark page 2 as current').toContainText('2');
  });

  test('PG-3: The last page', { tag: '@desktop-only' }, async ({ page }) => {
    const jobs = new JobSearchPage(page);

    await jobs.search({ title: KEYWORD });
    const page1 = await jobs.results();
    expect(page1.total, 'The search should list more than 10 jobs').toBeGreaterThan(10);

    // 1. Click "Last" (or the highest page number until there is no "Next").
    await test.step('1. Click "Last" (or the highest page number).', async () => {
      for (let hop = 0; hop < 60; hop++) {
        if ((await pagerLast(jobs).count()) > 0) {
          await submitAndWait(page, () => pagerLast(jobs).click());
          break;
        }
        if ((await pagerNext(jobs).count()) === 0) break;
        const highest = await highestPagerNumber(jobs);
        expect(highest, 'The pager should link to another page').toBeGreaterThan(0);
        await submitAndWait(page, () => pagerPageLink(jobs, highest).click());
      }
    });

    expect(jobs.params().get('title'), 'The address should keep title=nurse').toBe(KEYWORD);
    const last = await jobs.results();
    expect(last.items.length, 'The last page should list 1 to 10 jobs').toBeGreaterThanOrEqual(1);
    expect(last.items.length, 'The last page should list 1 to 10 jobs').toBeLessThanOrEqual(10);
    expect(
      last.items.filter((id) => page1.items.includes(id)),
      'No job on the last page should also be on page 1',
    ).toEqual([]);
    await expect(pagerNext(jobs), 'The last page should have no "Next"').toHaveCount(0);
    await expect(pagerLast(jobs), 'The last page should have no "Last"').toHaveCount(0);
    expect(
      Number(jobs.params().get('page') ?? '0'),
      `The last page should be no further than page 50 (page=${LAST_PAGE_PARAM})`,
    ).toBeLessThanOrEqual(LAST_PAGE_PARAM);
  });

  test('PG-4: A page number past the end', { tag: '@desktop-only' }, async ({ page }) => {
    const jobs = new JobSearchPage(page);

    // 1. Open the page by the address.
    await test.step('1. Open /job-search?title=nurse&page=999.', async () => {
      await jobs.search({ title: KEYWORD, page: '999' });
      await jobs.resultSummary.or(jobs.noResults).first().waitFor();
    });

    await expect(jobs.keywordInput, 'The keyword should be kept in the form').toHaveValue(KEYWORD);
    expect(jobs.params().get('title'), 'The keyword should be kept in the address').toBe(KEYWORD);
    if ((await jobs.cards.count()) > 0) {
      // The last page of results.
      await expect(pagerNext(jobs), 'Showing the last page: no "Next"').toHaveCount(0);
    } else {
      await expect(jobs.noResults, 'With no jobs, the friendly empty state should show').toBeVisible();
      await expect(
        jobs.pager.or(jobs.noResults.getByRole('link')).first(),
        'Past the end, the empty state should offer a pager or a link back to the results',
      ).toBeVisible();
    }
  });

  test('PG-5: A negative or non-number page', { tag: '@desktop-only' }, async ({ page }) => {
    const jobs = new JobSearchPage(page);

    await jobs.search({ title: KEYWORD });
    const first = await jobs.results();
    expect(first.total, 'The search should list at least 1 job').toBeGreaterThan(0);

    // 1. Open each by the address.
    for (const value of ['-1', 'abc']) {
      await test.step(`1. Open /job-search?title=nurse&page=${value}.`, async () => {
        await jobs.search({ title: KEYWORD, page: value });
        expect
          .soft(await jobs.results(), `page=${value} should show the first page, the same jobs as without page`)
          .toEqual(first);
      });
    }
  });
});

test.describe('The address', () => {
  test('UR-1: Every form keeps the others\' values', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    const chosen: Parameters<typeof expectSearchKept>[1] = {};
    let companyName = '';

    // 1. Search "nurse" with Location "55101" and Distance "50 miles".
    await test.step('1. Search "nurse" with Location "55101" and Distance "50 miles".', async () => {
      await page.goto('/job-search');
      await jobs.keywordInput.fill(KEYWORD);
      await jobs.locationInput.fill('55101');
      await jobs.distanceSelect.selectOption('50');
      await submitAndWait(page, () => jobs.searchButton.click());
      Object.assign(chosen, { title: KEYWORD, location: '55101', radius: '50' });
      await expectSearchKept(jobs, chosen, 'After the search');
    });

    // 2. Change Sort to "Company".
    await test.step('2. Change Sort to "Company".', async () => {
      await submitAndWait(page, () => jobs.sortSelect.selectOption(SORT.company.value));
      chosen.sort = SORT.company.value;
      await expectSearchKept(jobs, chosen, 'After the sort change');
    });

    // 3. Pick the company with the most jobs.
    await test.step('3. Pick the company with the most jobs.', async () => {
      const [company] = await jobs.topOptions(jobs.companySelect, 1);
      expect(company, 'The Company dropdown should list at least 1 company').toBeDefined();
      companyName = company.name;
      await jobs.showFilters();
      await jobs.companySelect.selectOption(company.value);
      await submitAndWait(page, () => jobs.filterButton.click());
      chosen.company = company.value;
      await expectSearchKept(jobs, chosen, 'After the company filter');
      await expectAllFromCompany(jobs, companyName, 'After the company filter');
    });

    // 4. Search again from the Keyword form (change nothing, click "Search").
    await test.step('4. Search again from the Keyword form, changing nothing.', async () => {
      await submitAndWait(page, () => jobs.searchButton.click());
      await expectSearchKept(jobs, chosen, 'After the re-submit of the Keyword form');
      await expectAllFromCompany(jobs, companyName, 'After the re-submit of the Keyword form');
    });

    // 5. Change Sort to "Date posted".
    await test.step('5. Change Sort to "Date posted".', async () => {
      await submitAndWait(page, () => jobs.sortSelect.selectOption(SORT.date.value));
      chosen.sort = SORT.date.value;
      await expectSearchKept(jobs, chosen, 'After the second sort change');
      await expectAllFromCompany(jobs, companyName, 'After the second sort change');
    });
  });

  test('UR-2: Back and Forward', { tag: '@desktop-only' }, async ({ page }) => {
    const jobs = new JobSearchPage(page);
    type Snapshot = { name: string; url: string; form: Omit<FormValues, 'company' | 'city'>; results: Results };
    const snapshots: Snapshot[] = [];

    const snapshot = async (name: string): Promise<Snapshot> => {
      const { keyword, location, distance, sort } = await formValues(jobs);
      const form = { keyword, location, distance, sort };
      return { name, url: page.url(), form, results: await jobs.results() };
    };
    const expectSameAs = async (expected: Snapshot, when: string) => {
      const now = await snapshot(expected.name);
      expect.soft(now.url, `${when}: the address should be the "${expected.name}" search's`).toBe(expected.url);
      expect.soft(now.form, `${when}: the form should show the "${expected.name}" search's values`).toEqual(
        expected.form,
      );
      expect.soft(now.results, `${when}: the jobs should be the "${expected.name}" search's first page`).toEqual(
        expected.results,
      );
    };

    // 1. Run three searches in a row.
    await test.step('1. Run three searches: "nurse"; "welder" in Duluth, MN; "teacher" sorted by Job title.', async () => {
      await page.goto('/job-search');
      await jobs.keywordInput.fill(KEYWORD);
      await submitAndWait(page, () => jobs.searchButton.click());
      snapshots.push(await snapshot('nurse'));

      await jobs.keywordInput.fill('welder');
      await jobs.locationInput.fill('Duluth, MN');
      await submitAndWait(page, () => jobs.searchButton.click());
      snapshots.push(await snapshot('welder in Duluth, MN'));

      // Changing Sort runs the search with what the form holds, so typing
      // "teacher" (with no location) and then picking the sort is one search.
      await jobs.keywordInput.fill('teacher');
      await jobs.locationInput.fill('');
      await submitAndWait(page, () => jobs.sortSelect.selectOption(SORT.title.value));
      snapshots.push(await snapshot('teacher by Job title'));
      expect(jobs.params().get('title'), 'The third search should be for "teacher"').toBe('teacher');
      expect(jobs.params().get('sort'), 'The third search should be sorted by Job title').toBe(SORT.title.value);
    });

    // 2. Click Back twice, then Forward twice.
    await test.step('2. Click Back twice, then Forward twice.', async () => {
      await page.goBack();
      await expectSameAs(snapshots[1], 'After Back once');
      await page.goBack();
      await expectSameAs(snapshots[0], 'After Back twice');
      await page.goForward();
      await expectSameAs(snapshots[1], 'After Forward once');
      await page.goForward();
      await expectSameAs(snapshots[2], 'After Forward twice');
    });
  });

  test('UR-3: A search opened somewhere else', { tag: '@desktop-only' }, async ({ page, browser, siteHealth }, testInfo) => {
    const jobs = new JobSearchPage(page);
    let address = '';
    let first: { form: FormValues; results: Results };

    // 1. Open UR-1's search (with page=1) in one browser. 2. Copy the address.
    await test.step("1. Open UR-1's search with page=1. 2. Copy the address.", async () => {
      const search = { title: KEYWORD, 'location[text]': '55101', radius: '50', sort: SORT.company.value };
      await jobs.search(search);
      const [company] = await jobs.topOptions(jobs.companySelect, 1);
      expect(company, 'The Company dropdown should list at least 1 company').toBeDefined();
      await jobs.search({ ...search, company: company.value, page: '1' });
      await expect(jobs.cards.first(), 'The search should list jobs on page 2').toBeVisible();
      first = { form: await formValues(jobs), results: await jobs.results() };
      address = page.url();
    });

    // 3. Open it in a fresh browser that has never visited the site.
    await test.step('3. Open it in a fresh browser.', async () => {
      const { baseURL, httpCredentials, ignoreHTTPSErrors, viewport, userAgent } = testInfo.project.use;
      const fresh = await browser.newContext({ baseURL, httpCredentials, ignoreHTTPSErrors, viewport, userAgent });
      try {
        const freshPage = await fresh.newPage();
        siteHealth.watch(freshPage);
        await freshPage.goto(address);
        const freshJobs = new JobSearchPage(freshPage);
        await expect(freshJobs.cards.first(), 'The fresh browser should list jobs').toBeVisible();
        expect
          .soft(await formValues(freshJobs), 'The fresh browser should show the same form values')
          .toEqual(first.form);
        expect
          .soft(await freshJobs.results(), 'The fresh browser should show the same total and jobs')
          .toEqual(first.results);
      } finally {
        await fresh.close();
      }
    });
  });
});
