import type { Page } from '@playwright/test';

import { JobSearchPage } from '../../pages/job-search.page';
import { test, expect } from './fixtures';
import {
  cardAgeLabel,
  cardLocation,
  cardSummary,
  expectEmptyState,
  expectJobsIn,
  expectJobsOrEmptyState,
  expectMostTitlesMatch,
  fillAndSearch,
  jobTitles,
  searchWithForm,
  shareButton,
  submitSearch,
} from './helpers/search';

// spec: test-suites/job-search/functional-job-search-search.md (SE-1 to SE-12)
// seed: tests/seed.spec.ts
//
// A visitor who isn't logged in; nothing is saved or changed, so every case
// is prod-safe. The jobs come from an outside feed (CareerOneStop), so no
// test names a job, company or city from it, and none checks an exact count.
//
// The plan's "Checked in every case" (no JavaScript error, no 4xx/5xx from
// the site, no raw Drupal/PHP error) is checked by ./fixtures after every
// test. On a phone, tests/helpers/fixtures.ts also checks the page doesn't
// scroll sideways.

const KEYWORD = 'nurse';

test.describe('Search', () => {
  test('SE-1: Everything is on the page when it first loads', async ({
    page,
  }) => {
    const jobs = new JobSearchPage(page);
    const main = page.getByRole('main');

    // Open Job Search with nothing after /job-search.
    await test.step('open Job Search with nothing after /job-search', async () => {
      await page.goto('/job-search');
      await expect(jobs.heading).toBeVisible();
    });

    // Look at the whole page.
    await test.step('the search form', async () => {
      const keyword = main.getByRole('textbox', { name: 'Keyword', exact: true });
      await expect(keyword, 'Keyword should be empty').toHaveValue('');
      await expect(keyword).toHaveAttribute(
        'placeholder',
        'Title, Company or Description',
      );
      const location = main.getByRole('combobox', {
        name: 'Location',
        exact: true,
      });
      await expect(location, 'Location should be empty').toHaveValue('');
      await expect(location).toHaveAttribute(
        'placeholder',
        'City, State or ZIP code',
      );
      const distance = main.getByRole('combobox', {
        name: 'Distance',
        exact: true,
      });
      await expect(
        distance.locator('option:checked'),
        'Distance should be set to "20 miles"',
      ).toHaveText('20 miles');
      await expect(jobs.searchButton).toBeVisible();
    });

    await test.step('the results', async () => {
      await expect(
        jobs.resultSummary,
        'the results should have a "Showing … jobs" count',
      ).toHaveText(/^\s*Showing\s+[\d,]+\s+jobs\s*$/);
      expect(
        await jobs.resultCount(),
        'there should be more than 10 jobs, so a pager',
      ).toBeGreaterThan(10);
      await expect(jobs.cards, 'the first page should list 10 jobs').toHaveCount(
        10,
      );
      await expect(jobs.pager, 'there should be a pager').toBeVisible();
      await expect(
        jobs.sortSelect.locator('option:checked'),
        'Sort should show "Relevance"',
      ).toHaveText('Relevance');
      await expect(jobs.sortSelect).toBeVisible();
    });

    for (const [index, card] of (await jobs.cards.all()).entries()) {
      await test.step(`job ${index + 1} has everything`, async () => {
        const n = `Job ${index + 1}`;
        await expect(jobs.cardTitle(card), `${n}: a title`).not.toBeEmpty();
        await expect(jobs.cardCompany(card), `${n}: a company`).not.toBeEmpty();
        await expect(cardLocation(card), `${n}: a location`).not.toBeEmpty();
        await expect(
          cardSummary(card),
          `${n}: a short description`,
        ).not.toBeEmpty();
        await expect(
          cardAgeLabel(card),
          `${n}: a "Posted … ago" or "Available … ago" label`,
        ).toBeVisible();
        // Each card has the apply link twice (wide screens, phones); one shows.
        await expect(
          jobs.applyLinks(card).filter({ visible: true }),
          `${n}: a "Learn more and apply" link`,
        ).toHaveCount(1);
        await expect(shareButton(card), `${n}: a "Share" button`).toBeVisible();
        await expect(
          jobs.readMoreLink(card),
          `${n}: a "Read more" link`,
        ).toBeVisible();
        await expect(
          jobs.bookmarkLink(card),
          `${n}: a bookmark icon`,
        ).toBeVisible();
      });
    }

    await test.step('the Skills Matcher banner', async () => {
      const banner = main.locator('section.cta').filter({
        has: page.getByRole('heading', {
          name: 'Get matched with the right jobs',
        }),
      });
      await expect(
        banner,
        'the "Get matched with the right jobs" banner should show',
      ).toBeVisible();
      await expect(
        banner.getByRole('link').filter({ visible: true }),
        'the banner should have a button to the Skills Matcher',
      ).toHaveAttribute('href', /skills_matcher/);
    });

    await test.step('Jobs for me', async () => {
      const block = main.locator('.block-careerforce-jobs-for-me');
      await expect(
        block.getByRole('heading', { name: 'Jobs For Me' }),
      ).toBeVisible();
      await expect(
        block.locator('p').first(),
        'Jobs for me should have its intro text',
      ).not.toBeEmpty();
      await expect(
        block.getByRole('link', { name: 'Customize my search' }),
      ).toBeVisible();
    });

    await test.step('Services and Resources', async () => {
      await expect(
        main.getByRole('heading', { name: 'Services', exact: true }),
      ).toBeVisible();
      const resources = main
        .locator('.link-group')
        .filter({
          has: page.getByRole('heading', { name: 'Resources', exact: true }),
        });
      await expect(
        resources.getByRole('heading', { name: 'Resources', exact: true }),
      ).toBeVisible();
      await expect(
        resources.getByRole('link').first(),
        'Resources should list links',
      ).toBeVisible();
    });

    // On a phone the filters are in a drawer behind "Filters": open it last,
    // since it covers the jobs.
    await test.step('the filters', async () => {
      await jobs.showFilters();
      await expect(jobs.companySelect, 'a Company dropdown').toBeVisible();
      await expect(jobs.citySelect, 'a City dropdown').toBeVisible();
      await expect(
        jobs.citySelect.locator('option').first(),
        'the City dropdown should start with "List of cities"',
      ).toHaveText('List of cities');
      await expect(jobs.saveSearchLink).toBeVisible();
      // On a phone Reset sits next to the Filters button, outside the drawer.
      await expect(jobs.resetLink.filter({ visible: true })).toHaveCount(1);
    });
  });

  test('SE-2: Search by keyword and city', async ({ page }) => {
    const jobs = new JobSearchPage(page);

    // Type "nurse" in Keyword and "Saint Paul, MN" in Location (typed, no
    // suggestion picked). Search.
    await test.step('search "nurse" in "Saint Paul, MN"', async () => {
      await searchWithForm(jobs, { keyword: KEYWORD, location: 'Saint Paul, MN' });
    });

    await test.step('the search is kept', async () => {
      expect(jobs.params().get('title'), 'the address should have title=nurse').toBe(
        KEYWORD,
      );
      expect(
        jobs.params().get('location[text]'),
        'the address should have location[text]=Saint Paul, MN',
      ).toBe('Saint Paul, MN');
      await expect(jobs.keywordInput).toHaveValue(KEYWORD);
      await expect(
        jobs.locationInput,
        'Location should show "Saint Paul, MN" or "St. Paul, MN"',
      ).toHaveValue(/^(Saint Paul, MN|St\. Paul, MN)$/);
    });

    await test.step('the jobs are nursing jobs in Minnesota', async () => {
      await expectJobsIn(jobs, ['MN'], '"nurse" in "Saint Paul, MN"');
      await expectMostTitlesMatch(jobs, /nurs/i, '"nurse" in "Saint Paul, MN"');
    });
  });

  // SE-3: one test per location.
  const SE3_LOCATIONS: Array<{
    location: string;
    // What the Location box may show after the search.
    shown: RegExp;
    // The states every first-page job must be in; [] = any state.
    states: string[];
  }> = [
    { location: '55101', shown: /^55101$/, states: ['MN'] },
    {
      location: 'Minneapolis, Minnesota',
      shown: /^Minneapolis, (Minnesota|MN)$/,
      states: ['MN'],
    },
    { location: 'Fargo, ND', shown: /^Fargo, ND$/, states: ['ND', 'MN'] },
    { location: 'USA', shown: /^(USA|United States)$/, states: [] },
    { location: 'MN', shown: /^(MN|Minnesota)$/, states: ['MN'] },
    { location: 'Chicago, IL', shown: /^Chicago, IL$/, states: ['IL'] },
  ];
  for (const { location, shown, states } of SE3_LOCATIONS) {
    test(`SE-3: Every location format: "${location}"`, async ({ page }) => {
      const jobs = new JobSearchPage(page);
      const what = `"nurse" in "${location}"`;

      // Type "nurse" in Keyword and the location in Location, and search.
      await test.step(`search ${what}`, async () => {
        await searchWithForm(jobs, { keyword: KEYWORD, location });
      });

      await test.step('the search is kept', async () => {
        expect(
          jobs.params().get('location[text]'),
          `the address should have location[text]=${location}`,
        ).toBe(location);
        await expect(jobs.keywordInput).toHaveValue(KEYWORD);
        await expect(
          jobs.locationInput,
          `Location should keep "${location}" as typed or in its normal form`,
        ).toHaveValue(shown);
      });

      await test.step('the jobs fit the location', async () => {
        if (states.length > 0) {
          await expectJobsIn(jobs, states, what);
        } else {
          await expect(
            jobs.cards.first(),
            `${what}: at least 1 job should be listed`,
          ).toBeVisible();
        }
      });
    });
  }

  test(
    'SE-4: Distance widens a ZIP search',
    { tag: '@desktop-only' },
    async ({ page }) => {
      const jobs = new JobSearchPage(page);
      let smallest = 0;

      // 1. Search "nurse" in "55101" at the smallest distance ("5 miles").
      await test.step('search "nurse" in "55101", 5 miles', async () => {
        await searchWithForm(jobs, {
          keyword: KEYWORD,
          location: '55101',
          radius: '5',
        });
        expect(jobs.params().get('radius'), 'the address should have radius=5').toBe(
          '5',
        );
        await expect(jobs.distanceSelect.locator('option:checked')).toHaveText(
          '5 miles',
        );
        await expect(
          jobs.cards.first(),
          'the 5-mile search should list at least 1 job',
        ).toBeVisible();
        smallest = await jobs.resultCount();
      });

      // 2. Search again at the largest distance ("100 miles").
      await test.step('search again at 100 miles', async () => {
        await fillAndSearch(jobs, {
          keyword: KEYWORD,
          location: '55101',
          radius: '100',
        });
        expect(
          jobs.params().get('radius'),
          'the address should have radius=100',
        ).toBe('100');
        await expect(jobs.distanceSelect.locator('option:checked')).toHaveText(
          '100 miles',
        );
        await expect(
          jobs.cards.first(),
          'the 100-mile search should list at least 1 job',
        ).toBeVisible();
        expect(
          await jobs.resultCount(),
          `the 100-mile total should be the same as or larger than the 5-mile total (${smallest})`,
        ).toBeGreaterThanOrEqual(smallest);
      });
    },
  );

  test(
    'SE-5: Distance makes no difference to a city search',
    { tag: '@desktop-only' },
    async ({ page }) => {
      const jobs = new JobSearchPage(page);
      let total = 0;
      let titles: string[] = [];
      let ids: string[] = [];

      // 1. Search "nurse" in "Duluth, MN" at 5 miles; note the total and titles.
      await test.step('search "nurse" in "Duluth, MN", 5 miles', async () => {
        await searchWithForm(jobs, {
          keyword: KEYWORD,
          location: 'Duluth, MN',
          radius: '5',
        });
        expect(jobs.params().get('radius'), 'the address should have radius=5').toBe(
          '5',
        );
        await expect(jobs.distanceSelect.locator('option:checked')).toHaveText(
          '5 miles',
        );
        await expect(
          jobs.cards.first(),
          'the 5-mile search should list at least 1 job',
        ).toBeVisible();
        ({ total, items: ids } = await jobs.results());
        titles = await jobTitles(jobs);
      });

      // 2. Search again at 100 miles.
      await test.step('search again at 100 miles', async () => {
        await fillAndSearch(jobs, {
          keyword: KEYWORD,
          location: 'Duluth, MN',
          radius: '100',
        });
        expect(
          jobs.params().get('radius'),
          'the address should have radius=100',
        ).toBe('100');
        await expect(jobs.distanceSelect.locator('option:checked')).toHaveText(
          '100 miles',
        );
        await expect(
          jobs.cards.first(),
          'the 100-mile search should list at least 1 job',
        ).toBeVisible();
        const after = await jobs.results();
        expect(
          after.total,
          'a city search should give the same total at 100 miles as at 5 miles',
        ).toBe(total);
        expect(
          await jobTitles(jobs),
          'a city search should list the same jobs, in the same order, at 100 miles as at 5 miles',
        ).toEqual(titles);
        expect(after.items, 'the same jobs (by job ID)').toEqual(ids);
      });
    },
  );

  test('SE-6: Empty search shows all Minnesota jobs', async ({ page }) => {
    const jobs = new JobSearchPage(page);

    // (Reference) the total of /job-search with nothing after it.
    await page.goto('/job-search');
    const defaultTotal = await jobs.resultCount();

    // Leave Keyword and Location empty. Click "Search".
    await test.step('click Search with Keyword and Location empty', async () => {
      await fillAndSearch(jobs, {});
    });

    await test.step('all Minnesota jobs are listed', async () => {
      expect(
        jobs.params().get('title') ?? '',
        'title should be empty or not in the address',
      ).toBe('');
      expect(
        jobs.params().get('location[text]') ?? '',
        'location[text] should be empty or not in the address',
      ).toBe('');
      await expect(jobs.keywordInput, 'Keyword should still be empty').toHaveValue(
        '',
      );
      await expect(
        jobs.locationInput,
        'Location should still be empty',
      ).toHaveValue('');
      await expectJobsIn(jobs, ['MN'], 'An empty search');
      expect(
        await jobs.resultCount(),
        'an empty search should have the same total as /job-search with nothing after it',
      ).toBe(defaultTotal);
    });
  });

  test('SE-7: Occupation (SOC) keyword', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    const soc = 'Registered Nurses (29-1141.00)';

    // Open /job-search?title=Registered Nurses (29-1141.00).
    await test.step('open the occupation search', async () => {
      await jobs.search({ title: soc });
    });

    await test.step('nursing jobs are listed', async () => {
      await expect(
        jobs.keywordInput,
        `Keyword should show "${soc}" exactly`,
      ).toHaveValue(soc);
      await expectMostTitlesMatch(jobs, /nurs|\bRN\b/i, `The keyword "${soc}"`);
    });
  });

  test('SE-8: A nonsense keyword shows a friendly empty state', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    const nonsense = 'zzqxqzz';

    // Type "zzqxqzz" in Keyword. Search.
    await test.step(`search "${nonsense}"`, async () => {
      await searchWithForm(jobs, { keyword: nonsense });
    });

    await test.step('a friendly empty state', async () => {
      await expectEmptyState(jobs, `"${nonsense}"`);
      await expect(jobs.keywordInput).toHaveValue(nonsense);
      // Company and City are empty (only their placeholder) or hidden.
      await jobs.showFilters();
      for (const [name, select] of [
        ['Company', jobs.companySelect],
        ['City', jobs.citySelect],
      ] as const) {
        if (await select.isVisible()) {
          await expect(
            select.locator('option[value]:not([value=""])'),
            `the ${name} dropdown should list no choices when there are no jobs`,
          ).toHaveCount(0);
        }
      }
    });
  });

  test(
    'SE-9: Special characters in the keyword',
    { tag: '@desktop-only' },
    async ({ page }) => {
      const jobs = new JobSearchPage(page);
      const keyword = 'C++ & "R&D"';

      // Type C++ & "R&D" in Keyword. Search.
      await test.step(`search ${keyword}`, async () => {
        await searchWithForm(jobs, { keyword });
      });

      await test.step('the keyword is kept exactly', async () => {
        const raw = new URL(page.url()).search;
        expect(
          raw,
          'the address should carry the keyword encoded',
        ).toMatch(/[?&]title=C%2B%2B(\+|%20)%26(\+|%20)%22R%26D%22(&|$)/);
        expect(jobs.params().get('title')).toBe(keyword);
        await expect(
          jobs.keywordInput,
          'Keyword should show the characters exactly, with no escape codes',
        ).toHaveValue(keyword);
        await expectJobsOrEmptyState(jobs, `The keyword ${keyword}`);
      });
    },
  );

  test(
    'SE-10: A 300-character keyword',
    { tag: '@desktop-only' },
    async ({ page }) => {
      const jobs = new JobSearchPage(page);
      const keyword = 'registered'.repeat(30);

      // Type "registered" 30 times, no spaces, in Keyword. Search.
      await test.step('search a 300-character keyword', async () => {
        await searchWithForm(jobs, { keyword });
      });

      await test.step('the page loads normally', async () => {
        await expect(jobs.heading).toBeVisible();
        await expect(
          page.getByText(/Request-URI Too Long/i),
          'no "Request-URI Too Long" error',
        ).toHaveCount(0);
        const limit = Number(
          (await jobs.keywordInput.getAttribute('maxlength')) ?? keyword.length,
        );
        await expect(
          jobs.keywordInput,
          `Keyword should hold the first ${Math.min(limit, keyword.length)} characters`,
        ).toHaveValue(keyword.slice(0, limit));
        await expectJobsOrEmptyState(jobs, 'A 300-character keyword');
      });
    },
  );

  test(
    'SE-11: Script and HTML in the search are shown as text',
    { tag: '@desktop-only' },
    async ({ page }) => {
      const jobs = new JobSearchPage(page);
      const dialogs: string[] = [];
      page.on('dialog', (dialog) => {
        dialogs.push(`${dialog.type()}: ${dialog.message()}`);
        void dialog.dismiss();
      });
      const script = '<script>alert(1)</script>';
      const img = '"><img src=x onerror=alert(1)>';

      // The search must load Job Search, so the page can show the text. Soft,
      // so every variant is tried and reported.
      const loads = (status: number, what: string) => {
        expect
          .soft(
            status,
            `${what}: Job Search should load and show the text, not an error page (the site answered ${status})`,
          )
          .toBeLessThan(400);
        return status < 400;
      };

      // 1. Type <script>alert(1)</script> in Keyword and search.
      await test.step('1. the script in Keyword', async () => {
        await page.goto('/job-search');
        const status = await submitSearch(jobs, { keyword: script });
        if (loads(status, 'The script in Keyword')) {
          await expect(
            jobs.keywordInput,
            'Keyword should show the typed text as plain text',
          ).toHaveValue(script);
        }
        await expectNoInjection(page, 'the script in Keyword');
      });

      // 2. Type it in Location and search.
      await test.step('2. the script in Location', async () => {
        await page.goto('/job-search');
        const status = await submitSearch(jobs, { location: script });
        if (loads(status, 'The script in Location')) {
          await expect(
            jobs.locationInput,
            'Location should show the typed text as plain text',
          ).toHaveValue(script);
        }
        await expectNoInjection(page, 'the script in Location');
      });

      // 3. Open the address with the <img onerror> value in each parameter.
      for (const param of ['title', 'location[text]', 'company', 'loc']) {
        await test.step(`3. /job-search?${param}=${img}`, async () => {
          const response = await page.goto(
            `/job-search?${param}=${encodeURIComponent(img)}`,
          );
          const status = response?.status() ?? 0;
          if (loads(status, `/job-search?${param}=${img}`)) {
            if (param === 'title') {
              await expect(jobs.keywordInput).toHaveValue(img);
            }
            if (param === 'location[text]') {
              await expect(jobs.locationInput).toHaveValue(img);
            }
          }
          await expectNoInjection(page, `${param}=${img}`);
        });
      }

      expect(dialogs, 'no alert or other dialog should open').toEqual([]);
    },
  );

  test('SE-12: Location suggestions', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    const place = 'Rochester, MN';

    // 1. Type "Roch" in Location.
    await test.step('1. type "Roch" in Location', async () => {
      await page.goto('/job-search');
      await jobs.locationInput.click();
      await jobs.locationInput.pressSequentially('Roch');
      await expect(
        jobs.locationSuggestions.first(),
        'a list of suggestions should open under Location',
      ).toBeVisible();
      const suggestions = (await jobs.locationSuggestions.allTextContents()).map(
        (s) => s.trim(),
      );
      expect(
        suggestions.filter((s) => !s.includes('Roch')),
        'every suggestion should contain "Roch"',
      ).toEqual([]);
      expect(
        suggestions.filter(
          (s) =>
            !/, (MN|WI|SD|ND|IA|Minnesota|Wisconsin|South Dakota|North Dakota|Iowa)$/.test(
              s,
            ),
        ),
        'every suggestion should be in Minnesota, Wisconsin, South Dakota, North Dakota or Iowa',
      ).toEqual([]);
      expect(suggestions, `"${place}" should be among the suggestions`).toContain(
        place,
      );
    });

    // 2. Pick "Rochester, MN" from the suggestions.
    await test.step(`2. pick "${place}"`, async () => {
      await jobs.locationSuggestions
        .filter({ hasText: new RegExp(`^\\s*${place}\\s*$`) })
        .click();
      await expect(jobs.locationInput).toHaveValue(place);
      await expect(
        jobs.locationSuggestions.first(),
        'the suggestions should close',
      ).toBeHidden();
    });

    // 3. Type "nurse" in Keyword. 4. Search.
    await test.step('3. type "nurse" in Keyword and 4. search', async () => {
      await jobs.keywordInput.fill(KEYWORD);
      await jobs.searchButton.click();
      await jobs.waitForParams({ title: KEYWORD });
      expect(
        jobs.params().get('location[text]'),
        `the address should have location[text]=${place}`,
      ).toBe(place);
      await expect(
        jobs.cards.first(),
        'at least 1 job should be listed',
      ).toBeVisible();
    });
  });
});

// SE-11: the page gained no <script> and no <img onerror> from the search,
// and wherever it repeats the search (the boxes, the empty-state message,
// the Company and City dropdowns, the page title) it shows characters, not an
// element.
async function expectNoInjection(page: Page, what: string) {
  const found = await page.evaluate(() => ({
    scripts: Array.from(document.querySelectorAll('script'))
      .filter((s) => /alert\(1\)/.test(s.textContent ?? ''))
      .map((s) => s.outerHTML.slice(0, 200)),
    images: Array.from(document.querySelectorAll('img[onerror]')).map((i) =>
      i.outerHTML.slice(0, 200),
    ),
  }));
  expect(
    found.scripts,
    `${what}: the page should gain no <script> from the search`,
  ).toEqual([]);
  expect(
    found.images,
    `${what}: the page should gain no <img> with an onerror from the search`,
  ).toEqual([]);
  // Wherever the page repeats the search as text, it shows the characters:
  // no escape codes such as &lt; or &quot; (double-escaped text).
  const repeated = await page.evaluate(() => {
    const value = (selector: string) =>
      (document.querySelector(selector) as HTMLInputElement | null)?.value ?? '';
    return [
      ['Keyword box', value('main input[name="title"]')],
      ['Location box', value('main input[name="location[text]"]')],
      ['empty-state message', document.querySelector('main .no-results')?.textContent ?? ''],
      ...Array.from(
        document.querySelectorAll(
          'main select[name="company"] option, main select[name="loc"] option',
        ),
      ).map((o) => ['Company/City dropdown', o.textContent ?? '']),
      ['page title', document.title],
    ];
  });
  expect(
    repeated
      .filter(([, text]) => /&(lt|gt|quot|amp|#\d+|#x[0-9a-f]+);/i.test(text))
      .map(([where, text]) => `${where}: ${text}`),
    `${what}: where the page repeats the search, it should show the characters, not escape codes`,
  ).toEqual([]);
}
