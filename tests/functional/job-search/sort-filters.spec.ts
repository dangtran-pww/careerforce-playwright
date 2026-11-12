import { test, expect } from './fixtures';
import {
  JobSearchPage,
  type JobFilterOption,
} from '../../pages/job-search.page';
import type { Results } from '../../helpers/results';
import {
  KEYWORD,
  SORT,
  cardTexts,
  expectAllFromCompany,
  expectAllInCity,
  expectAtoZ,
  expectAtoZAcross,
  expectNewestFirst,
  pagerPageLink,
  submitAndWait,
} from './helpers/sort-filters';

// spec: test-plans/functional-job-search-sort-filters-paging.md ("Sort" SO-1 to SO-6, "Filters" FI-1 to FI-6)
// seed: tests/seed.spec.ts
//
// A visitor who isn't logged in; nothing is changed, so every case is safe on
// Production. The jobs come from an outside feed, so no job, company or city
// is named here: the tests pick the companies and cities with the most jobs
// from the dropdowns at run time, and compare the site with itself.
//
// The checks "Checked in every case" (no JavaScript error, no failed request,
// no raw error) run after every test, from ./fixtures. On a phone the base
// fixtures also check the page doesn't scroll sideways.
//
// Only SO-5, FI-1 and FI-5 run on the phone, through the Filters drawer
// (plan → Mobile); the rest are @desktop-only.

test.describe('Sort', () => {
  test('SO-1: Relevance is the default', { tag: '@desktop-only' }, async ({ page }) => {
    const jobs = new JobSearchPage(page);

    // 1. Open the page.
    await test.step('1. Open /job-search?title=nurse.', async () => {
      await jobs.search({ title: KEYWORD });
      await expect(jobs.cards.first(), 'At least 1 job should be listed').toBeVisible();
    });

    await expect(jobs.sortSelect, 'The Sort dropdown should show Relevance').toHaveValue(
      SORT.relevance.value,
    );
    await expect(jobs.sortSelect.locator('option:checked')).toHaveText(SORT.relevance.label);
    expect(
      [null, '', SORT.relevance.value],
      `The address should have no sort, or sort=best-match (it has sort=${jobs.params().get('sort')})`,
    ).toContain(jobs.params().get('sort'));
  });

  // SO-2 and SO-3 share their steps: sort A–Z, then compare page 1, page 2
  // and the page break.
  const A_TO_Z = [
    { id: 'SO-2', name: 'Job title A–Z, across the page break', sort: SORT.title, field: 'title', what: 'Job titles' },
    { id: 'SO-3', name: 'Company A–Z, across the page break', sort: SORT.company, field: 'company', what: 'Companies' },
  ] as const;

  for (const { id, name, sort, field, what } of A_TO_Z) {
    test(`${id}: ${name}`, { tag: '@desktop-only' }, async ({ page }) => {
      const jobs = new JobSearchPage(page);
      let relevanceTotal = 0;
      let page1: string[] = [];

      await test.step('Open /job-search?title=nurse.', async () => {
        await jobs.search({ title: KEYWORD });
        relevanceTotal = await jobs.resultCount();
        expect(relevanceTotal, 'The search should list at least 1 job').toBeGreaterThan(0);
      });

      // 1. Change Sort.
      await test.step(`1. Change Sort to "${sort.value}".`, async () => {
        await submitAndWait(page, () => jobs.sortSelect.selectOption(sort.value));
        expect(jobs.params().get('sort'), `The address should have sort=${sort.value}`).toBe(
          sort.value,
        );
        expect(jobs.params().get('title'), 'The address should keep title=nurse').toBe(KEYWORD);
        await expect(jobs.sortSelect.locator('option:checked')).toHaveText(sort.label);
        expect(
          await jobs.resultCount(),
          'The total should be the same as with Relevance',
        ).toBe(relevanceTotal);
      });

      // 2. Note the first page.
      await test.step(`2. Note the first page's ${field === 'title' ? 'titles' : 'companies'}.`, async () => {
        page1 = await cardTexts(jobs, field);
        expectAtoZ(page1, what, 'page 1');
      });

      // 3. Go to page 2.
      await test.step('3. Go to page 2.', async () => {
        await submitAndWait(page, () => pagerPageLink(jobs, 2).click());
        expect(jobs.params().get('sort'), `Page 2's address should keep sort=${sort.value}`).toBe(
          sort.value,
        );
        await expect(
          jobs.sortSelect.locator('option:checked'),
          'The Sort dropdown should still show the sort on page 2',
        ).toHaveText(sort.label);
        const page2 = await cardTexts(jobs, field);
        expectAtoZ(page2, what, 'page 2');
        expectAtoZAcross(page1, page2, what);
      });
    });
  }

  test(
    'SO-4: Date posted, newest first, across the page break',
    { tag: '@desktop-only' },
    async ({ page }) => {
      const jobs = new JobSearchPage(page);
      let page1: string[] = [];

      await jobs.search({ title: KEYWORD });
      await expect(jobs.cards.first(), 'The search should list at least 1 job').toBeVisible();

      // 1. Change Sort to "Date posted".
      await test.step('1. Change Sort to "Date posted".', async () => {
        await submitAndWait(page, () => jobs.sortSelect.selectOption(SORT.date.value));
        expect(jobs.params().get('sort'), 'The address should have sort=date-posted-desc').toBe(
          SORT.date.value,
        );
        await expect(jobs.sortSelect.locator('option:checked')).toHaveText(SORT.date.label);
      });

      // 2. Note the "Posted … ago" labels.
      await test.step('2. Note the "Posted … ago" labels.', async () => {
        page1 = await cardTexts(jobs, 'posted');
        expectNewestFirst(page1, 'page 1');
      });

      // 3. Go to page 2.
      await test.step('3. Go to page 2.', async () => {
        await submitAndWait(page, () => pagerPageLink(jobs, 2).click());
        expect(jobs.params().get('sort'), "Page 2's address should keep sort=date-posted-desc").toBe(
          SORT.date.value,
        );
        const page2 = await cardTexts(jobs, 'posted');
        expectNewestFirst(page2, 'page 2');
        expectNewestFirst([page1[page1.length - 1], page2[0]], 'the page break (last of page 1, first of page 2)');
      });
    },
  );

  test('SO-5: Sort stays after a new search', async ({ page }) => {
    const jobs = new JobSearchPage(page);

    const expectSortKept = async (when: string) => {
      await expect(
        jobs.sortSelect.locator('option:checked'),
        `${when}: the Sort dropdown should still show "Date posted"`,
      ).toHaveText(SORT.date.label);
      expect(
        jobs.params().get('sort'),
        `${when}: the address should still have sort=date-posted-desc`,
      ).toBe(SORT.date.value);
      expectNewestFirst(await cardTexts(jobs, 'posted'), `the first page ${when}`);
    };

    await jobs.search({ title: KEYWORD });
    await expect(jobs.cards.first(), 'The search should list at least 1 job').toBeVisible();

    // 1. Change Sort to "Date posted".
    await test.step('1. Change Sort to "Date posted".', async () => {
      await submitAndWait(page, () => jobs.sortSelect.selectOption(SORT.date.value));
      await expectSortKept('after the sort change');
    });

    // 2. Type "nursing assistant" in Keyword and search.
    await test.step('2. Type "nursing assistant" in Keyword and search.', async () => {
      await jobs.keywordInput.fill('nursing assistant');
      await submitAndWait(page, () => jobs.searchButton.click());
      expect(jobs.params().get('title'), 'The address should have the new keyword').toBe(
        'nursing assistant',
      );
      await expectSortKept('after searching "nursing assistant"');
    });

    // 3. Type "Duluth, MN" in Location and search.
    await test.step('3. Type "Duluth, MN" in Location and search.', async () => {
      await jobs.locationInput.fill('Duluth, MN');
      await submitAndWait(page, () => jobs.searchButton.click());
      expect(jobs.params().get('location[text]'), 'The address should have the location').toBe(
        'Duluth, MN',
      );
      expect(jobs.params().get('title'), 'The address should keep the keyword').toBe(
        'nursing assistant',
      );
      await expectSortKept('after searching in "Duluth, MN"');
    });
  });

  test('SO-6: Unknown sort value', { tag: '@desktop-only' }, async ({ page }) => {
    const jobs = new JobSearchPage(page);

    await jobs.search({ title: KEYWORD });
    const relevance = await jobs.results();
    expect(relevance.total, 'The search with Relevance should list at least 1 job').toBeGreaterThan(0);

    // 1. Open the page by the address.
    await test.step('1. Open /job-search?title=nurse&sort=bogus.', async () => {
      await jobs.search({ title: KEYWORD, sort: 'bogus' });
    });

    await expect(jobs.cards.first(), 'The page should list jobs').toBeVisible();
    expect(await jobs.results(), 'The jobs should be the same as with Relevance').toEqual(
      relevance,
    );
    const value = await jobs.sortSelect.inputValue();
    expect(
      ['', SORT.relevance.value],
      `The Sort dropdown should show Relevance (or no choice), not "${value}"`,
    ).toContain(value);
    if (value !== '') {
      await expect(jobs.sortSelect.locator('option:checked')).toHaveText(SORT.relevance.label);
    }
  });
});

test.describe('Filters', () => {
  // FI-1 and FI-2 share their steps: filter by the option with the most
  // jobs, check, then clear it with the dropdown's placeholder.
  const ONE_FILTER = [
    { id: 'FI-1', name: 'Company filter, and clearing it', label: 'company', param: 'company', select: 'companySelect', tag: [] },
    { id: 'FI-2', name: 'City filter, and clearing it', label: 'city', param: 'loc', select: 'citySelect', tag: ['@desktop-only'] },
  ] as const;

  for (const { id, name, label, param, select, tag } of ONE_FILTER) {
    test(`${id}: ${name}`, { tag: [...tag] }, async ({ page }) => {
      const jobs = new JobSearchPage(page);
      const dropdown = jobs[select];
      let before: Results;
      let option: JobFilterOption;

      const expectAllMatch = (where: string) =>
        param === 'company'
          ? expectAllFromCompany(jobs, option.name, where)
          : expectAllInCity(jobs, option.name, where);

      // 1. Note the total and the first page's jobs.
      await test.step("1. Note the total and the first page's jobs.", async () => {
        await jobs.search({ title: KEYWORD });
        before = await jobs.results();
        expect(before.total, 'The search should list at least 1 job').toBeGreaterThan(0);
        [option] = await jobs.topOptions(dropdown, 1);
        expect(option, `The ${label} dropdown should list at least 1 choice`).toBeDefined();
      });

      // 2. Pick the option with the most jobs.
      await test.step(`2. Pick the ${label} with the most jobs.`, async () => {
        await jobs.showFilters();
        await dropdown.selectOption(option.value);
        await submitAndWait(page, () => jobs.filterButton.click());
        expect(jobs.params().get(param), `The address should have ${param}=${option.value}`).toBe(
          option.value,
        );
        expect(jobs.params().get('title'), 'The address should keep title=nurse').toBe(KEYWORD);
        await expect(dropdown, `The ${label} dropdown should show "${option.name}"`).toHaveValue(
          option.value,
        );
        await expect(dropdown.locator('option:checked')).toHaveText(option.name);
        expect(
          await jobs.resultCount(),
          `"${option.name}" should not show more jobs than the unfiltered search`,
        ).toBeLessThanOrEqual(before.total);
        await expectAllMatch('Page 1');

        // And on page 2, if there is one.
        if ((await pagerPageLink(jobs, 2).count()) > 0) {
          await submitAndWait(page, () => pagerPageLink(jobs, 2).click());
          await expectAllMatch('Page 2');
          await page.goBack();
          await expect(dropdown).toHaveValue(option.value);
        }
      });

      // 3. Clear the filter: choose the placeholder (not Reset).
      await test.step(`3. Clear the ${label} filter (choose its placeholder).`, async () => {
        test.info().annotations.push({
          type: 'note',
          description: `The ${label} filter was cleared by choosing its placeholder, not with Reset.`,
        });
        await jobs.showFilters();
        await dropdown.selectOption('');
        await submitAndWait(page, () => jobs.filterButton.click());
        expect(
          jobs.params().get(param) ?? '',
          `After clearing, the address should have no ${param} value`,
        ).toBe('');
        expect(jobs.params().get('title'), 'The address should keep title=nurse').toBe(KEYWORD);
        expect(
          await jobs.results(),
          'After clearing, the total and the first page should be the same as before filtering',
        ).toEqual(before);
      });
    });
  }

  // FI-3 and FI-4: company A, then company B. The site keeps a search's
  // results for 5 minutes and may not tell one company from another, so B
  // must show B's jobs, not A's.
  test('FI-3: One company, then another, with the dropdown', { tag: '@desktop-only' }, async ({ page }) => {
    const jobs = new JobSearchPage(page);
    let resultsA: Results;

    await jobs.search({ title: KEYWORD });
    const [a, b] = await jobs.topOptions(jobs.companySelect, 2);
    expect(b, 'The Company dropdown should list at least 2 companies').toBeDefined();

    // 1. Pick the company with the most jobs (A). 2. Note the first page.
    await test.step('1. Pick the company with the most jobs (A). 2. Note the first page.', async () => {
      await jobs.companySelect.selectOption(a.value);
      await submitAndWait(page, () => jobs.filterButton.click());
      await expectAllFromCompany(jobs, a.name, `Company A ("${a.name}")`);
      resultsA = await jobs.results();
    });

    // 3. Pick the company with the second most jobs (B) from the same dropdown.
    await test.step('3. Pick the company with the second most jobs (B) from the same dropdown.', async () => {
      const offered = (await jobs.topOptions(jobs.companySelect, Infinity)).map((o) => o.value);
      expect(
        offered,
        `With "${a.name}" chosen, the Company dropdown should still offer "${b.name}", so you can switch to it`,
      ).toContain(b.value);
      await jobs.companySelect.selectOption(b.value);
      await submitAndWait(page, () => jobs.filterButton.click());
      expect(jobs.params().get('company'), `The address should have company=${b.value}`).toBe(b.value);
      await expect(jobs.companySelect, `The Company dropdown should show "${b.name}"`).toHaveValue(b.value);
      await expectAllFromCompany(jobs, b.name, `Company B ("${b.name}"), right after A`);
      expect(
        (await jobs.results()).items,
        `B's first page should not be the same as A's (cached results for "${a.name}" shown for "${b.name}")`,
      ).not.toEqual(resultsA.items);
    });
  });

  test('FI-4: One company, then another, by the address', { tag: '@desktop-only' }, async ({ page }) => {
    const jobs = new JobSearchPage(page);
    let resultsA: Results;

    await jobs.search({ title: KEYWORD });
    const [a, b] = await jobs.topOptions(jobs.companySelect, 2);
    expect(b, 'The Company dropdown should list at least 2 companies').toBeDefined();

    // 1. Open the page for company A by the address.
    await test.step('1. Open the page for company A by the address.', async () => {
      await jobs.search({ title: KEYWORD, company: a.value });
      await expectAllFromCompany(jobs, a.name, `Company A ("${a.name}")`);
      resultsA = await jobs.results();
    });

    // 2. Change only `company` in the address to B and open it.
    await test.step('2. Change only company in the address to B and open it.', async () => {
      await jobs.search({ title: KEYWORD, company: b.value });
      await expect(jobs.companySelect, `The Company dropdown should show "${b.name}"`).toHaveValue(b.value);
      await expectAllFromCompany(jobs, b.name, `Company B ("${b.name}"), right after A`);
      expect(
        (await jobs.results()).items,
        `B's first page should not be the same as A's (cached results for "${a.name}" shown for "${b.name}")`,
      ).not.toEqual(resultsA.items);
    });
  });

  test('FI-5: Company and city together', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    let company: JobFilterOption;
    let cityTotal = 0;

    await jobs.search({ title: KEYWORD });
    const [city] = await jobs.topOptions(jobs.citySelect, 1);
    expect(city, 'The City dropdown should list at least 1 city').toBeDefined();

    // 1. Pick the city with the most jobs.
    await test.step('1. Pick the city with the most jobs.', async () => {
      await jobs.showFilters();
      await jobs.citySelect.selectOption(city.value);
      await submitAndWait(page, () => jobs.filterButton.click());
      await expectAllInCity(jobs, city.name, 'The city filter alone');
      cityTotal = await jobs.resultCount();
    });

    // 2. Pick, from the Company dropdown as it now is, the company with the most jobs.
    await test.step('2. Pick the company with the most jobs from the Company dropdown as it now is.', async () => {
      [company] = await jobs.topOptions(jobs.companySelect, 1);
      expect(company, 'The Company dropdown should list at least 1 company').toBeDefined();
      await jobs.showFilters();
      await jobs.companySelect.selectOption(company.value);
      await submitAndWait(page, () => jobs.filterButton.click());
    });

    expect(jobs.params().get('loc'), `The address should keep loc=${city.value}`).toBe(city.value);
    expect(jobs.params().get('company'), `The address should have company=${company!.value}`).toBe(
      company!.value,
    );
    await expect(jobs.citySelect, `The City dropdown should show "${city.name}"`).toHaveValue(city.value);
    await expect(jobs.companySelect, `The Company dropdown should show "${company!.name}"`).toHaveValue(
      company!.value,
    );
    await expectAllFromCompany(jobs, company!.name, 'Company and city');
    await expectAllInCity(jobs, city.name, 'Company and city');
    expect(
      await jobs.resultCount(),
      'Company and city together should not show more jobs than the city alone',
    ).toBeLessThanOrEqual(cityTotal);
  });

  test('FI-6: A company with no jobs, by the address', { tag: '@desktop-only' }, async ({ page }) => {
    const jobs = new JobSearchPage(page);

    // 1. Open the page by the address.
    await test.step('1. Open /job-search?title=nurse&company=No Such Company Playwright.', async () => {
      await jobs.search({ title: KEYWORD, company: 'No Such Company Playwright' });
    });

    await expect(jobs.noResults, 'The friendly empty state should show').toBeVisible();
    await expect(jobs.noResults).toContainText(/no (results|jobs)/i);
    await expect(jobs.cards, 'No jobs should be listed').toHaveCount(0);
    await expect(jobs.pager, 'No pager should show').toBeHidden();
  });
});
