import { test, expect } from '../../helpers/fixtures';
import { expectFilterPairDiffers, type Results } from '../../helpers/results';
import {
  JobSearchPage,
  type JobFilterOption,
} from '../../pages/job-search.page';
import type { Locator } from '@playwright/test';

// spec: test-suites/smoke/smoke-job-search.md ("Filters", JF-1 to JF-5)
// seed: tests/seed.spec.ts
//
// Not logged in, and nothing is saved. The jobs come from an outside feed, so
// the tests never name a job, company or city: they pick the companies and
// cities with the most jobs in the dropdowns at run time, and never check
// exact counts.
//
// JF-1 to JF-3 open the search address directly (every Job Search form uses
// GET). The filtering and sorting happen on the server, so they run on
// desktop only. JF-4 and JF-5 click the page's own controls, because the
// page's script is what joins the search, filter and sort forms into one
// address; they also run on a phone, where the Company and City filters are
// in the drawer behind "Filters".

const KEYWORD = 'nurse';

// The line under a job's title: the company, then the city.
function cardCity(card: Locator): Locator {
  return card.locator('div.tw-font-semibold > span').nth(1);
}

// "Posted 3 days ago" → 3. "Posted today" → 0. Anything else fails, so a new
// wording shows up instead of being skipped.
const DAYS_PER_UNIT: Record<string, number> = {
  minute: 1 / 1440,
  hour: 1 / 24,
  day: 1,
  week: 7,
  month: 30,
  year: 365,
};

function ageInDays(label: string): number {
  const text = label.replace(/\s+/g, ' ').trim();
  if (/^Posted (today|just now)$/i.test(text)) return 0;
  const match = text.match(
    /^Posted (\d+|an?) (minute|hour|day|week|month|year)s? ago$/i,
  );
  expect(match, `Can't read the date of "${text}"`).not.toBeNull();
  const count = /^\d+$/.test(match![1]) ? Number(match![1]) : 1;
  return count * DAYS_PER_UNIT[match![2].toLowerCase()];
}

async function texts(fields: Locator[]): Promise<string[]> {
  const values: string[] = [];
  for (const field of fields) {
    values.push(((await field.textContent()) ?? '').replace(/\s+/g, ' ').trim());
  }
  return values;
}

// JF-1 and JF-2 share their steps: search "nurse", then filter by the option
// with the most jobs, then by the one with the second most.
const TWO_FILTERS = [
  {
    id: 'JF-1',
    name: 'Two companies',
    label: 'company',
    param: 'company',
    select: 'companySelect',
    field: (jobs: JobSearchPage, card: Locator) => jobs.cardCompany(card),
  },
  {
    id: 'JF-2',
    name: 'Two cities',
    label: 'city',
    param: 'loc',
    select: 'citySelect',
    field: (_jobs: JobSearchPage, card: Locator) => cardCity(card),
  },
] as const;

const SORTS = [
  { value: 'job-title-asc', label: 'Job title', read: 'title' },
  { value: 'company-asc', label: 'Company', read: 'company' },
  { value: 'date-posted-desc', label: 'Date posted', read: 'posted' },
] as const;

test.describe('Filters', () => {
  for (const { id, name, label, param, select, field } of TWO_FILTERS) {
    test(`${id}: ${name}`, { tag: '@desktop-only' }, async ({ page }) => {
      const jobs = new JobSearchPage(page);
      const dropdown = jobs[select];
      let all: Results;
      let options: JobFilterOption[] = [];
      const filtered: Results[] = [];

      // 1. Search "nurse".
      await test.step('1. Search "nurse".', async () => {
        await jobs.search({ title: KEYWORD });
        await expect(jobs.cards.first()).toBeVisible();
        all = await jobs.results();
        expect(all.total, 'the search should list at least 1 job').toBeGreaterThan(0);
        options = await jobs.topOptions(dropdown, 2);
        expect(
          options,
          `the ${label} dropdown should list at least 2 choices`,
        ).toHaveLength(2);
      });

      const steps = [
        `2. Filter by the ${label} with the most jobs.`,
        `3. Filter by the ${label} with the second most jobs instead.`,
      ];
      for (const [index, option] of options.entries()) {
        await test.step(`${steps[index]} (${option.name})`, async () => {
          await jobs.search({ title: KEYWORD, [param]: option.value });
          // The dropdown shows the chosen company or city.
          await expect(dropdown).toHaveValue(option.value);
          await expect(dropdown.locator('option:checked')).toHaveText(option.name);
          // Every job listed is from that company, or in that city.
          await expect(jobs.cards.first()).toBeVisible();
          for (const card of await jobs.cards.all()) {
            await expect(field(jobs, card)).toHaveText(option.name);
          }
          const results = await jobs.results();
          expect(
            results.total,
            `"${option.name}" should not show more jobs than the unfiltered search`,
          ).toBeLessThanOrEqual(all.total);
          filtered.push(results);
        });
      }

      // Step 3 also: the two filters show different results.
      expectFilterPairDiffers(all!, filtered[0], filtered[1], [
        options[0].name,
        options[1].name,
      ]);
    });
  }

  test('JF-3: Sort orders', { tag: '@desktop-only' }, async ({ page }) => {
    const jobs = new JobSearchPage(page);
    let unsorted = 0;

    // 1. Search "nurse".
    await test.step('1. Search "nurse".', async () => {
      await jobs.search({ title: KEYWORD });
      unsorted = await jobs.resultCount();
      expect(unsorted, 'the search should list at least 1 job').toBeGreaterThan(0);
    });

    // 2. Sort by "Job title". 3. Sort by "Company". 4. Sort by "Date posted".
    for (const [index, { value, label, read }] of SORTS.entries()) {
      await test.step(`${index + 2}. Sort by "${label}".`, async () => {
        await jobs.search({ title: KEYWORD, sort: value });
        await expect(jobs.sortSelect).toHaveValue(value);
        await expect(jobs.sortSelect.locator('option:checked')).toHaveText(
          new RegExp(`^${label}`, 'i'),
        );
        expect(
          await jobs.resultCount(),
          'the same number of jobs as the unsorted search',
        ).toBe(unsorted);

        await expect(jobs.cards.first()).toBeVisible();
        const cards = await jobs.cards.all();
        const values = await texts(
          cards.map((card) =>
            read === 'title'
              ? jobs.cardTitle(card)
              : read === 'company'
                ? jobs.cardCompany(card)
                : jobs.cardPosted(card),
          ),
        );

        if (read === 'posted') {
          // Newest to oldest.
          const ages = values.map(ageInDays);
          for (let i = 1; i < ages.length; i++) {
            expect(
              ages[i],
              `"${values[i]}" (job ${i + 1}) should not be newer than "${values[i - 1]}"`,
            ).toBeGreaterThanOrEqual(ages[i - 1]);
          }
        } else {
          // A–Z, ignoring letter case. Plain string comparison matches the
          // site's order, which puts "*" and digits before letters.
          for (let i = 1; i < values.length; i++) {
            expect(
              values[i - 1].toLowerCase() <= values[i].toLowerCase(),
              `${label} A–Z: "${values[i - 1]}" (job ${i}) should come before "${values[i]}"`,
            ).toBe(true);
          }
        }
      });
    }
  });

  test('JF-4: Filters, sort and keyword keep each other', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    let city: JobFilterOption;

    const expectAllInCity = async () => {
      await expect(jobs.cards.first()).toBeVisible();
      for (const card of await jobs.cards.all()) {
        await expect(cardCity(card)).toHaveText(city.name);
      }
    };

    // Use the page's own controls, not the address.
    // 1. Search "nurse".
    await test.step('1. Search "nurse".', async () => {
      await page.goto('/job-search');
      await jobs.keywordInput.fill(KEYWORD);
      await jobs.searchButton.click();
      await jobs.waitForParams({ title: KEYWORD });
      await expect(jobs.keywordInput).toHaveValue(KEYWORD);
      await expect(jobs.cards.first()).toBeVisible();
      [city] = await jobs.topOptions(jobs.citySelect, 1);
      expect(city, 'the City dropdown should list at least 1 city').toBeDefined();
    });

    // 2. Pick the city with the most jobs in the City dropdown (on a phone, open "Filters" first).
    await test.step('2. Pick the city with the most jobs.', async () => {
      await jobs.showFilters();
      await jobs.citySelect.selectOption(city.value);
      await jobs.filterButton.click();
      await jobs.waitForParams({ loc: city.value });
      expect(jobs.params().get('title')).toBe(KEYWORD);
      await expect(jobs.keywordInput).toHaveValue(KEYWORD);
      await expect(jobs.citySelect).toHaveValue(city.value);
      await expectAllInCity();
    });

    // 3. Change Sort to "Date posted".
    await test.step('3. Change Sort to "Date posted".', async () => {
      await jobs.sortSelect.selectOption('date-posted-desc');
      await jobs.waitForParams({ sort: 'date-posted-desc' });
      expect(jobs.params().get('title')).toBe(KEYWORD);
      expect(jobs.params().get('loc')).toBe(city.value);
      await expect(jobs.keywordInput).toHaveValue(KEYWORD);
      await expect(jobs.citySelect).toHaveValue(city.value);
      await expect(jobs.sortSelect).toHaveValue('date-posted-desc');
      await expectAllInCity();
    });

    // 4. Type "nursing assistant" in Keyword and click "Search".
    await test.step('4. Type "nursing assistant" in Keyword and click "Search".', async () => {
      await jobs.keywordInput.fill('nursing assistant');
      await jobs.searchButton.click();
      await jobs.waitForParams({ title: 'nursing assistant' });
      expect(jobs.params().get('loc')).toBe(city.value);
      expect(jobs.params().get('sort')).toBe('date-posted-desc');
      await expect(jobs.keywordInput).toHaveValue('nursing assistant');
      await expect(jobs.citySelect).toHaveValue(city.value);
      await expect(jobs.sortSelect).toHaveValue('date-posted-desc');
      await expectAllInCity();
    });
  });

  test('JF-5: Reset clears the search', async ({ page }) => {
    const jobs = new JobSearchPage(page);

    // Open JF-4's last search and click "Reset".
    await jobs.search({ title: KEYWORD });
    const [city] = await jobs.topOptions(jobs.citySelect, 1);
    expect(city, 'the City dropdown should list at least 1 city').toBeDefined();
    await jobs.search({
      title: KEYWORD,
      loc: city.value,
      sort: 'date-posted-desc',
    });
    await expect(jobs.keywordInput).toHaveValue(KEYWORD);
    await expect(jobs.citySelect).toHaveValue(city.value);
    await expect(jobs.sortSelect).toHaveValue('date-posted-desc');
    await jobs.resetLink.click();
    await page.waitForURL((url) => !url.searchParams.get('title'));

    // 1. The Keyword box is empty.
    await expect(jobs.keywordInput).toHaveValue('');
    // 2. The City dropdown shows its placeholder ("List of cities").
    await expect(jobs.citySelect).toHaveValue('');
    await expect(jobs.citySelect.locator('option:checked')).toHaveText(
      'List of cities',
    );
    // 3. Sort shows "Relevance".
    await expect(jobs.sortSelect).toHaveValue('best-match');
    await expect(jobs.sortSelect.locator('option:checked')).toHaveText(
      'Relevance',
    );
    // 4. At least 1 job is listed.
    await expect(jobs.cards.first()).toBeVisible();
    // 5. The address has no title, loc or sort value.
    for (const param of ['title', 'loc', 'sort']) {
      expect(
        jobs.params().get(param) ?? '',
        `the address should have no ${param}`,
      ).toBe('');
    }
  });
});
