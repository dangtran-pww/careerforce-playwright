import { test, expect } from '../../helpers/fixtures';
import { expectFilterPairDiffers, type Results } from '../../helpers/results';
import {
  JobSearchPage,
  type JobFilterOption,
} from '../../pages/job-search.page';

const KEYWORD = 'nurse';

// [Smoke] - Job Search - Test Plan, JF-1 to JF-5 (filters and sort).
// See test-plans/smoke-job-search.md. JF-1 and JF-2 were FL-5 and FL-6 in
// test-plans/smoke-public-site.md.
//
// JF-1 and JF-2:
// Given: an anonymous visitor on Job Search, searching "nurse"
// When: they filter by one company (or city), then by another
// Then: each filter shows no more jobs than the unfiltered search, every job
//       listed belongs to the chosen company (or city), and the two filters
//       show different jobs.
//
// Every filter is in the page address (a GET form), so the tests open the
// filtered URL instead of clicking through the form. The filtering happens
// on the server and is the same on any device, so these run on desktop only.

test.describe('job search filters', { tag: '@desktop-only' }, () => {
  // JF-1/JF-2: the jobs come from an outside feed, so the two companies or
  // cities to compare are the two with the most jobs in the dropdown right
  // now, read from the unfiltered page.
  const JOB_FILTERS = [
    { id: 'JF-1', label: 'company', param: 'company', select: 'companySelect' },
    { id: 'JF-2', label: 'city', param: 'loc', select: 'citySelect' },
  ] as const;

  for (const { id, label, param, select } of JOB_FILTERS) {
    test(`${id}: two ${label} filters give different jobs`, async ({
      page,
    }) => {
      const jobs = new JobSearchPage(page);
      const keyword = { title: KEYWORD };
      await jobs.search(keyword);
      const all = await jobs.results();
      const options = await jobs.topOptions(jobs[select], 2);
      expect(
        options,
        `the ${label} dropdown should list at least 2 choices`,
      ).toHaveLength(2);

      const results: Results[] = [];
      for (const option of options) {
        await test.step(`${label}: ${option.name}`, async () => {
          await jobs.search({ ...keyword, [param]: option.value });
          await expect(jobs[select]).toHaveValue(option.value);
          // Each job on the page belongs to the chosen company or city.
          for (const card of await jobs.cards.all()) {
            await expect(card).toContainText(option.name);
          }
          results.push(await jobs.results());
        });
      }

      expectFilterPairDiffers(all, results[0], results[1], [
        options[0].name,
        options[1].name,
      ]);
    });
  }
});

// JF-3: the sort happens on the server, like the filters, so desktop only.
// Each order is checked on the first page, ignoring letter case. Plain
// string comparison matches the site's order, which puts "*" and digits
// before letters.
const SORTS = [
  { value: 'job-title-asc', label: 'Job title', read: 'title' },
  { value: 'company-asc', label: 'Company', read: 'company' },
  { value: 'date-posted-desc', label: 'Date posted', read: 'posted' },
] as const;

const DAYS_PER_UNIT: Record<string, number> = {
  minute: 1 / 1440,
  hour: 1 / 24,
  day: 1,
  week: 7,
  month: 30,
  year: 365,
};

// "Posted 3 days ago" → 3. "Posted today" → 0. Anything else fails, so a
// new wording shows up instead of being skipped.
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

test.describe('job search sort', { tag: '@desktop-only' }, () => {
  test('JF-3: each sort order sorts the jobs', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    await jobs.search({ title: KEYWORD });
    const unsorted = await jobs.resultCount();
    expect(
      unsorted,
      'the unsorted search should list at least 1 job',
    ).toBeGreaterThan(0);

    for (const { value, label, read } of SORTS) {
      await test.step(label, async () => {
        await jobs.search({ title: KEYWORD, sort: value });
        await expect(jobs.sortSelect).toHaveValue(value);
        expect(
          await jobs.resultCount(),
          'same number of jobs as the unsorted search',
        ).toBe(unsorted);

        const cards = await jobs.cards.all();
        const values: string[] = [];
        for (const card of cards) {
          const field =
            read === 'title'
              ? jobs.cardTitle(card)
              : read === 'company'
                ? jobs.cardCompany(card)
                : jobs.cardPosted(card);
          values.push(
            ((await field.textContent()) ?? '').replace(/\s+/g, ' ').trim(),
          );
        }

        if (read === 'posted') {
          const ages = values.map(ageInDays);
          for (let i = 1; i < ages.length; i++) {
            expect(
              ages[i],
              `"${values[i]}" (job ${i + 1}) should not be newer than "${values[i - 1]}"`,
            ).toBeGreaterThanOrEqual(ages[i - 1]);
          }
        } else {
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
});

// JF-4 and JF-5 use the page's own controls, because the page's script is
// what joins the three forms (search, filters, sort) into one address. On
// a phone the City filter is in the drawer behind "Filters".

// The city with the most jobs for "nurse" right now.
async function topCity(jobs: JobSearchPage): Promise<JobFilterOption> {
  await jobs.search({ title: KEYWORD });
  const [city] = await jobs.topOptions(jobs.citySelect, 1);
  expect(city, 'the City dropdown should list at least 1 city').toBeDefined();
  return city;
}

async function expectAllInCity(jobs: JobSearchPage, city: JobFilterOption) {
  await expect(jobs.cards.first()).toBeVisible();
  for (const card of await jobs.cards.all()) {
    await expect(card).toContainText(city.name);
  }
}

test('JF-4: filters, sort and keyword keep each other', async ({ page }) => {
  const jobs = new JobSearchPage(page);
  const city = await topCity(jobs);

  await test.step(`City: ${city.name}`, async () => {
    await jobs.showFilters();
    await jobs.citySelect.selectOption(city.value);
    await jobs.filterButton.click();
    await jobs.waitForParams({ loc: city.value });
    expect(jobs.params().get('title')).toBe(KEYWORD);
    await expect(jobs.keywordInput).toHaveValue(KEYWORD);
    await expect(jobs.citySelect).toHaveValue(city.value);
    await expectAllInCity(jobs, city);
  });

  await test.step('Sort: Date posted', async () => {
    await jobs.sortSelect.selectOption('date-posted-desc');
    await jobs.waitForParams({ sort: 'date-posted-desc' });
    expect(jobs.params().get('title')).toBe(KEYWORD);
    expect(jobs.params().get('loc')).toBe(city.value);
    await expect(jobs.keywordInput).toHaveValue(KEYWORD);
    await expect(jobs.citySelect).toHaveValue(city.value);
    await expect(jobs.sortSelect).toHaveValue('date-posted-desc');
    await expectAllInCity(jobs, city);
  });

  await test.step('Keyword: nursing assistant', async () => {
    await jobs.keywordInput.fill('nursing assistant');
    await jobs.searchButton.click();
    await jobs.waitForParams({ title: 'nursing assistant' });
    expect(jobs.params().get('loc')).toBe(city.value);
    expect(jobs.params().get('sort')).toBe('date-posted-desc');
    await expect(jobs.keywordInput).toHaveValue('nursing assistant');
    await expect(jobs.citySelect).toHaveValue(city.value);
    await expect(jobs.sortSelect).toHaveValue('date-posted-desc');
    await expectAllInCity(jobs, city);
  });
});

test('JF-5: Reset clears the search', async ({ page }) => {
  const jobs = new JobSearchPage(page);
  const city = await topCity(jobs);
  await jobs.search({
    title: KEYWORD,
    loc: city.value,
    sort: 'date-posted-desc',
  });
  await expect(jobs.citySelect).toHaveValue(city.value);

  await jobs.resetLink.click();
  await page.waitForURL((url) => !url.searchParams.get('title'));

  await expect(jobs.keywordInput).toHaveValue('');
  await expect(jobs.citySelect).toHaveValue('');
  await expect(jobs.citySelect.locator('option:checked')).toHaveText(
    'List of cities',
  );
  await expect(jobs.sortSelect).toHaveValue('best-match');
  await expect(jobs.sortSelect.locator('option:checked')).toHaveText(
    'Relevance',
  );
  await expect(jobs.cards.first()).toBeVisible();
  for (const param of ['title', 'loc', 'sort']) {
    expect(
      jobs.params().get(param) ?? '',
      `the address should have no ${param}`,
    ).toBe('');
  }
});
