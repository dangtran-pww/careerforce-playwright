import { test, expect } from '../../helpers/fixtures';
import { HomePage } from '../../pages/home.page';
import { JobSearchPage } from '../../pages/job-search.page';

// [Smoke] - Job Search - Test Plan, JS-1 to JS-5.
// See test-plans/smoke-job-search.md.
//
// The jobs come from an outside feed, so the tests never name a job,
// company or city: they take whatever the search returns.
// Nothing is saved: Save search and Bookmark only open the login prompt,
// which is closed again.

const KEYWORD = 'nurse';

const DISTANCES = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(
  (miles) => `${miles} miles`,
);

// JS-1 runs first: if Job Search doesn't load, nothing else here can pass.
// Uncaught JavaScript errors only, as in GN-5 (test-plans/smoke-public-site.md):
// the tests block analytics and the AWS WAF script on purpose, and those
// blocked loads show up in the console as errors.
test('JS-1: Job Search loads, and its search form works', async ({ page }) => {
  const jobs = new JobSearchPage(page);
  const main = page.getByRole('main');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await test.step('open Job Search with no search', async () => {
    const response = await page.goto('/job-search');
    expect(response?.status(), 'Job Search should load').toBeLessThan(400);
    await expect(jobs.heading).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Page not found' }),
    ).toHaveCount(0);
    await expect(jobs.cards.first()).toBeVisible();
    // Soft, so the form steps below still run and report too.
    expect.soft(errors, 'JavaScript errors on /job-search').toEqual([]);
  });

  await test.step('the search form', async () => {
    const keyword = main.getByRole('textbox', { name: 'Keyword', exact: true });
    await expect(keyword).toHaveValue('');
    await expect(keyword).toHaveAttribute(
      'placeholder',
      'Title, Company or Description',
    );
    const location = main.getByRole('combobox', {
      name: 'Location',
      exact: true,
    });
    await expect(location).toHaveValue('');
    await expect(location).toHaveAttribute(
      'placeholder',
      'City, State or ZIP code',
    );
    const distance = main.getByRole('combobox', {
      name: 'Distance',
      exact: true,
    });
    await expect(distance).toHaveValue('20');
    await expect(distance.locator('option:checked')).toHaveText('20 miles');
    await expect(distance.locator('option')).toHaveText(DISTANCES);
    await expect(jobs.searchButton).toBeVisible();
  });

  await test.step('Location suggests places', async () => {
    await jobs.locationInput.click();
    await jobs.locationInput.pressSequentially('Saint P');
    await expect(jobs.locationSuggestions.first()).toBeVisible();
    for (const suggestion of await jobs.locationSuggestions.all()) {
      await expect(suggestion).toContainText('Saint P');
    }
    await jobs.locationSuggestions
      .filter({ hasText: /^\s*Saint Paul, MN\s*$/ })
      .click();
    await expect(jobs.locationInput).toHaveValue('Saint Paul, MN');
    // The list closes (hidden or gone).
    await expect(jobs.locationSuggestions.first()).toBeHidden();
  });

  await test.step('search with keyword, location and distance', async () => {
    await jobs.keywordInput.fill(KEYWORD);
    await jobs.distanceSelect.selectOption('10');
    await jobs.searchButton.click();
    await jobs.waitForParams({ title: KEYWORD });
    const params = jobs.params();
    expect(params.get('location[text]')).toBe('Saint Paul, MN');
    expect(params.get('radius')).toBe('10');
    await expect(jobs.keywordInput).toHaveValue(KEYWORD);
    await expect(jobs.locationInput).toHaveValue('Saint Paul, MN');
    await expect(jobs.distanceSelect.locator('option:checked')).toHaveText(
      '10 miles',
    );
    await expect(jobs.cards.first()).toBeVisible();
  });
});

// JS-2 checks only that the homepage block hands its search over to Job
// Search. That Job Search itself loads, lists jobs and has no JavaScript
// errors is JS-1; the homepage's JavaScript errors are GN-5 in
// test-plans/smoke-public-site.md.
test('JS-2: homepage Job Search opens Job Search with the keyword', async ({
  page,
}) => {
  const home = new HomePage(page);
  const jobs = new JobSearchPage(page);
  await home.goto();
  await home.jobSearchKeywordInput.fill(KEYWORD);
  await home.jobSearchButton.click();

  await expect(page).toHaveURL(/\/job-search\?/);
  const params = new URL(page.url()).searchParams;
  expect(params.get('title')).toBe(KEYWORD);
  expect(params.get('radius'), 'the default distance, 20 miles').toBe('20');
  await expect(jobs.keywordInput).toHaveValue(KEYWORD);
});

test('JS-3: each job in the results has a title and its links', async ({
  page,
}) => {
  const jobs = new JobSearchPage(page);
  await jobs.search({ title: KEYWORD });
  const cards = await jobs.cards.all();
  expect(cards.length).toBeGreaterThan(0);

  // The first page shows up to 10 jobs; check the first 3.
  for (const [index, card] of cards.slice(0, 3).entries()) {
    await test.step(`job ${index + 1}`, async () => {
      const jobId = await card.getAttribute('data-jvid');
      expect(jobId, 'every job has an ID').toBeTruthy();
      await expect(jobs.cardTitle(card)).not.toBeEmpty();
      // Apply goes to the employer's posting on an outside site.
      for (const apply of await jobs.applyLinks(card).all()) {
        await expect(apply).toHaveAttribute('href', /^https:\/\//);
        await expect(apply).toHaveAttribute('target', '_blank');
      }
      expect(await jobs.applyLinks(card).count()).toBeGreaterThan(0);
      await expect(jobs.readMoreLink(card)).toHaveAttribute(
        'href',
        new RegExp(`jvid=${jobId}`),
      );
    });
  }
});

test('JS-4: Read more opens the job on its own', async ({ page }) => {
  const jobs = new JobSearchPage(page);
  await jobs.search({ title: KEYWORD });
  const first = jobs.cards.first();
  const jobId = await first.getAttribute('data-jvid');
  const title = (await jobs.cardTitle(first).textContent())?.trim() ?? '';

  await jobs.readMoreLink(first).click();

  await expect(page).toHaveURL(new RegExp(`[?&]jvid=${jobId}`));
  await expect(jobs.cards).toHaveCount(1);
  const job = jobs.cards.first();
  await expect(job).toHaveAttribute('data-jvid', jobId!);
  await expect(jobs.cardTitle(job)).toHaveText(title);
  await expect(jobs.fullDescription(job)).not.toBeEmpty();
});

test('JS-5: Save search and Bookmark ask an anonymous visitor to log in', async ({
  page,
}) => {
  const jobs = new JobSearchPage(page);
  await jobs.search({ title: KEYWORD });

  // Bookmark first: on a phone, Save search is in the filters drawer, which
  // stays open over the job cards after the dialog is closed.
  const actions = [
    { name: 'Bookmark', link: jobs.bookmarkLink(jobs.cards.first()) },
    { name: 'Save search', link: jobs.saveSearchLink },
  ];
  for (const { name, link } of actions) {
    await test.step(name, async () => {
      if (name === 'Save search') await jobs.showFilters();
      await link.click();
      const dialog = jobs.loginDialog;
      await expect(dialog).toBeVisible();
      const close = dialog.getByRole('button', { name: 'Close' });
      await expect
        .poll(() => jobs.isOnTop(close), {
          message: `The login dialog from ${name} should be on top, not covered by another layer`,
        })
        .toBe(true);
      await expect(
        dialog.getByRole('heading', {
          name: 'Create an account or log in to use this feature',
        }),
      ).toBeVisible();
      await expect(
        dialog.getByRole('button', { name: 'Log In or Register' }),
      ).toBeVisible();
      await expect(
        dialog.getByRole('link', { name: 'Continue Browsing' }),
      ).toBeVisible();
      // The staff/partner login sends them back to this search afterwards.
      await expect(
        dialog.getByRole('link', {
          name: 'DEED staff and partners log in here.',
        }),
      ).toHaveAttribute('href', /^\/user\/login\?destination=\/job-search/);
      await close.click();
      await expect(dialog).toBeHidden();
    });
  }
});
