import { test, expect } from '../../helpers/fixtures';
import { isKnownPageError } from '../../helpers/known-issues';
import {
  JobSearchPage,
  type JobFilterOption,
} from '../../pages/job-search.page';

// [Functional] - Job Search, part 1: Search, JSS-1 to JSS-15.
// See test-plans/job-search.md.
//
// Anonymous and read-only. The jobs come live from CareerOneStop, so no test
// names a job or checks an exact count. Where a test needs to know how far a
// search reached, it reads the City filter, which lists every city in the
// whole result set ("Showing N jobs" stops at 500).

const KEYWORD = 'nurse';

// The state part of "City, ST".
function state(city: JobFilterOption): string {
  return city.name.split(',').pop()?.trim() ?? '';
}

function states(cities: JobFilterOption[]): Set<string> {
  return new Set(cities.map(state));
}

function totalJobs(cities: JobFilterOption[]): number {
  return cities.reduce((sum, city) => sum + city.count, 0);
}

function searchParams(location: string, radius = '20') {
  return {
    title: KEYWORD,
    'location[text]': location,
    radius,
    sort: 'best-match',
  };
}

// Every functional suite carries a feature tag; the `job-search` Playwright
// project runs only tests tagged @job-search.
test.describe('Job Search: search', { tag: '@job-search' }, () => {
  test('JSS-1: page loads with the search form and results', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const jobs = new JobSearchPage(page);
    await page.goto('/job-search');

    await expect(jobs.heading).toBeVisible();
    await expect(jobs.keywordInput).toBeVisible();
    await expect(jobs.locationInput).toBeVisible();
    await expect(jobs.locationInput).toHaveValue('');
    await expect(jobs.distanceSelect).toHaveValue('20');
    await expect(jobs.searchButton).toBeVisible();
    await expect(jobs.resetLink).toHaveAttribute('href', '/job-search');
    await expect(jobs.sortSelect).toHaveValue('best-match');
    await expect(jobs.sortSelect.locator('option:checked')).toHaveText(
      'Relevance',
    );
    await expect(jobs.companySelect).toBeVisible();
    await expect(jobs.citySelect).toBeVisible();

    expect(await jobs.resultCount()).toBeGreaterThan(0);
    await expect(jobs.cards).toHaveCount(10);
    await expect(jobs.pager).toBeVisible();

    const main = page.getByRole('main');
    for (const name of [
      'Get matched with the right jobs',
      'Jobs For Me',
      'Services',
      'Resources',
    ]) {
      await expect(
        main.getByRole('heading', { name, exact: true }),
      ).toBeVisible();
    }

    const unknown = errors.filter(
      (message) => !isKnownPageError('/job-search', message),
    );
    expect(unknown, 'New JavaScript errors on /job-search').toEqual([]);
  });

  test('JSS-2: keyword and location from the form', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    await page.goto('/job-search');
    await jobs.keywordInput.fill(KEYWORD);
    await jobs.locationInput.fill('Saint Paul, MN');
    await jobs.searchButton.click();

    await expect(page).toHaveURL(/[?&]title=nurse/);
    const params = new URL(page.url()).searchParams;
    expect(params.get('title')).toBe(KEYWORD);
    expect(params.get('location[text]')).toBe('Saint Paul, MN');
    expect(params.get('radius')).toBe('20');
    expect(params.get('sort')).toBe('best-match');

    // The box keeps what the visitor typed; it isn't rewritten to "St. Paul".
    await expect(jobs.keywordInput).toHaveValue(KEYWORD);
    await expect(jobs.locationInput).toHaveValue('Saint Paul, MN');
    expect(await jobs.resultCount()).toBeGreaterThan(0);

    // 20 miles from Saint Paul reaches into Wisconsin, but no further.
    const cities = await jobs.cities();
    expect(cities.length).toBeGreaterThan(0);
    expect([...states(cities)].filter((s) => s !== 'MN' && s !== 'WI')).toEqual(
      [],
    );
  });

  test.describe('JSS-3: location formats', () => {
    // `includes`: a state that must be among the result cities. `within`: the
    // only states allowed (20 miles from the Twin Cities reaches Wisconsin).
    const FORMATS: { location: string; includes: string; within?: string[] }[] =
      [
        { location: '55101', includes: 'MN', within: ['MN', 'WI'] },
        {
          location: 'Minneapolis, Minnesota',
          includes: 'MN',
          within: ['MN', 'WI'],
        },
        { location: 'Fargo, ND', includes: 'ND' },
        { location: 'MN', includes: 'MN', within: ['MN'] },
        // Not one of the states the site normalizes, but passed through as is.
        { location: 'Chicago, IL', includes: 'IL' },
      ];

    for (const { location, includes, within } of FORMATS) {
      test(`JSS-3: "${location}" finds jobs in the right area`, async ({
        page,
      }) => {
        const jobs = new JobSearchPage(page);
        await jobs.search(searchParams(location));

        expect(
          await jobs.resultCount(),
          `"${location}" should find jobs`,
        ).toBeGreaterThan(0);
        const found = [...states(await jobs.cities())];
        expect(
          found,
          `"${location}" should include a city in ${includes}`,
        ).toContain(includes);
        if (within) {
          const outside = found.filter((s) => !within.includes(s));
          expect(
            outside,
            `Every city for "${location}" should be in ${within.join(' or ')}`,
          ).toEqual([]);
        }
      });
    }
  });

  test.describe('JSS-4: nationwide location', () => {
    for (const location of ['USA', 'US', 'United States']) {
      test(`JSS-4: "${location}" finds jobs`, async ({ page }) => {
        // Known bug (manual session BUG-1, QA, 2026-11-04): all three show
        // "No results found.". Remove this line once fixed.
        test.fail(true, 'A nationwide location returns no results');

        const jobs = new JobSearchPage(page);
        await jobs.search(searchParams(location));
        expect(
          await jobs.resultCount(),
          `"${location}" should find jobs`,
        ).toBeGreaterThan(0);
      });
    }
  });

  test('JSS-5: distance widens a ZIP search', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    await jobs.search(searchParams('55101', '5'));
    const near = await jobs.cities();
    expect(near.length, 'The 5-mile search should find jobs').toBeGreaterThan(
      0,
    );

    await jobs.distanceSelect.selectOption('100');
    await jobs.searchButton.click();
    await expect(page).toHaveURL(/[?&]radius=100(&|$)/);
    await expect(jobs.distanceSelect).toHaveValue('100');
    const far = await jobs.cities();

    expect(far.length, 'More cities at 100 miles than at 5').toBeGreaterThan(
      near.length,
    );
    expect(totalJobs(far), 'More jobs at 100 miles than at 5').toBeGreaterThan(
      totalJobs(near),
    );
  });

  test('JSS-6: distance widens a city search', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    await jobs.search(searchParams('Duluth, MN', '5'));
    const near = await jobs.cities();
    expect(near.length, 'The 5-mile search should find jobs').toBeGreaterThan(
      0,
    );

    await jobs.search(searchParams('Duluth, MN', '100'));
    const far = await jobs.cities();
    expect(far.length, 'More cities at 100 miles than at 5').toBeGreaterThan(
      near.length,
    );
  });

  test('JSS-7: an empty search falls back to Minnesota', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    await page.goto('/job-search');
    await jobs.searchButton.click();

    await expect(page).toHaveURL(/[?&]sort=best-match/);
    const params = new URL(page.url()).searchParams;
    expect(params.get('title')).toBe('');
    expect(params.get('location[text]')).toBe('');
    expect(params.get('radius')).toBe('20');

    expect(await jobs.resultCount()).toBeGreaterThan(0);
    expect(
      [...states(await jobs.cities())],
      'Every city should be in MN',
    ).toEqual(['MN']);
  });

  test('JSS-8: a plain page load uses the same default sort as a search', async ({
    page,
  }) => {
    // Known bug (manual session BUG-2, QA, 2026-11-04): a plain /job-search
    // load lists jobs A-Z while "Relevance" is shown, so it differs from the
    // submitted empty search. Remove this line once fixed.
    test.fail(true, 'A plain /job-search load is sorted A-Z, not by relevance');

    const jobs = new JobSearchPage(page);
    await page.goto('/job-search');
    await expect(jobs.sortSelect).toHaveValue('best-match');
    const plain = (await jobs.results()).items;

    await jobs.search({
      title: '',
      'location[text]': '',
      radius: '20',
      sort: 'best-match',
    });
    const searched = (await jobs.results()).items;

    expect(plain.length).toBeGreaterThan(0);
    expect(
      plain,
      'Same first page with and without the default query string',
    ).toEqual(searched);
  });

  test('JSS-9: an occupation keyword finds that occupation', async ({
    page,
  }) => {
    const jobs = new JobSearchPage(page);
    await jobs.search({ title: 'Registered Nurses (29-1141.00)' });

    const titles = (
      await jobs.cards.getByRole('heading', { level: 3 }).allTextContents()
    ).map((title) => title.trim());
    expect(titles.length).toBeGreaterThan(0);
    const other = titles.filter((title) => !/nurs|\bRN\b/i.test(title));
    expect(other, 'Every job should be a nursing job').toEqual([]);
  });

  test('JSS-10: a keyword with no matches shows the empty state', async ({
    page,
  }) => {
    const jobs = new JobSearchPage(page);
    await jobs.search({ title: 'zzqxqzz' });

    await expect(jobs.noResults).toHaveText('No results found.');
    await expect(jobs.cards).toHaveCount(0);
    await expect(jobs.keywordError).toHaveCount(0);
  });

  test('JSS-11: characters the Keyword does not allow get a message', async ({
    page,
  }) => {
    const keyword = 'C++ & "R&D"';
    const jobs = new JobSearchPage(page);
    await page.goto('/job-search');
    await jobs.keywordInput.fill(keyword);
    await jobs.searchButton.click();

    await expect(jobs.keywordError).toHaveText(
      `Please only use letters, numbers, periods (.), commas (,), hyphens (-), slashes (/), pluses (+), single-quotes (') and double-quotes (").`,
    );
    await expect(jobs.keywordInput).toHaveAttribute('aria-invalid', 'true');
    await expect(jobs.keywordInput).toHaveValue(keyword);
  });

  test('JSS-12: a keyword longer than 256 characters', async ({ page }) => {
    const long = 'a'.repeat(300);
    const jobs = new JobSearchPage(page);
    await page.goto('/job-search');

    await test.step('the box stops at 256 characters', async () => {
      await jobs.keywordInput.pressSequentially(long);
      await expect(jobs.keywordInput).toHaveValue('a'.repeat(256));
    });

    await test.step('the server rejects 300 characters sent in the URL', async () => {
      await jobs.search({ title: long });
      await expect(jobs.keywordError).toHaveText(
        'Keyword cannot be longer than 256 characters but is currently 300 characters long.',
      );
    });
  });

  test('JSS-13: HTML in the search is shown as text, never run', async ({
    page,
  }) => {
    const dialogs: string[] = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });
    const jobs = new JobSearchPage(page);

    await test.step('tags in Keyword and Location stay text', async () => {
      await jobs.search({
        title: '<b>x</b>',
        'location[text]': '<i>y</i>',
        radius: '20',
      });
      await expect(jobs.keywordInput).toHaveValue('<b>x</b>');
      await expect(jobs.locationInput).toHaveValue('<i>y</i>');
      const injected = page
        .getByRole('main')
        .locator('b, i')
        .filter({ hasText: /^[xy]$/ });
      await expect(injected).toHaveCount(0);
    });

    await test.step('a <script> keyword is blocked and nothing runs', async () => {
      const response = await page.goto(
        `/job-search?${new URLSearchParams({ title: '<script>alert(1)</script>' })}`,
      );
      expect(response?.status(), 'The WAF blocks the request').toBe(403);
      expect(dialogs, 'No dialog should open').toEqual([]);
    });
  });

  test('JSS-14: a blocked search shows a CareerForce error page', async ({
    page,
  }) => {
    // Known bug (manual session BUG-3, QA, 2026-11-04): the WAF answers with a
    // bare "403 Forbidden" page with no header or way back. Remove this line
    // once fixed.
    test.fail(true, 'The WAF block page is a bare, unbranded 403');

    await page.goto(
      `/job-search?${new URLSearchParams({ title: '<script>alert(1)</script>' })}`,
    );
    await expect(page.getByRole('banner')).toBeVisible({ timeout: 5_000 });
    await expect(
      page.getByRole('link', { name: /Job Search/ }).first(),
    ).toBeVisible({
      timeout: 5_000,
    });
  });

  test('JSS-15: location suggestions', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    await page.goto('/job-search');
    await jobs.locationInput.pressSequentially('Roch', { delay: 100 });

    const rochester = jobs.locationSuggestions.filter({
      hasText: /^Rochester, MN$/,
    });
    await expect(rochester).toBeVisible();
    const suggestions = (await jobs.locationSuggestions.allTextContents()).map(
      (s) => s.trim(),
    );
    const outside = suggestions.filter((s) => !/, (MN|WI|SD|ND|IA)$/.test(s));
    expect(
      outside,
      'Every suggestion should be in MN, WI, SD, ND or IA',
    ).toEqual([]);

    await rochester.click();
    await expect(jobs.locationInput).toHaveValue('Rochester, MN');
    await expect(jobs.locationSuggestions.first()).toBeHidden();

    await jobs.keywordInput.fill(KEYWORD);
    await jobs.searchButton.click();
    await expect(page).toHaveURL(/[?&]location%5Btext%5D=Rochester/);
    expect(await jobs.resultCount()).toBeGreaterThan(0);
    expect((await jobs.cities()).map((city) => city.name)).toContain(
      'Rochester, MN',
    );
  });
});
