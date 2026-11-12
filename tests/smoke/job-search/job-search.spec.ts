import { test, expect } from '../../helpers/fixtures';
import { HomePage } from '../../pages/home.page';
import { JobSearchPage } from '../../pages/job-search.page';

// spec: test-suites/smoke/smoke-job-search.md ("Search and results", JS-1 to JS-5)
// seed: tests/seed.spec.ts
//
// Not logged in, and nothing is saved: Save search and Bookmark only open the
// login prompt, which is closed again. The jobs come from an outside feed, so
// the tests never name a job, company or city: they take whatever the search
// returns. On a phone, the fixtures also check the page doesn't scroll
// sideways after each test.

const KEYWORD = 'nurse';
const PLACE = 'Saint Paul, MN';

const DISTANCES = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(
  (miles) => `${miles} miles`,
);

test.describe('Search and results', () => {
  // JS-1 runs first: if Job Search doesn't load, nothing else here can pass.
  // Uncaught JavaScript errors only, as in GN-5 (test-suites/smoke/smoke-public-site.md):
  // the tests block analytics and the AWS WAF script on purpose, and those
  // blocked loads show up in the console as errors.
  test('JS-1: Job Search loads, and its search form works', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    const main = page.getByRole('main');
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    // 1. Open Job Search with nothing after /job-search in the address.
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

    // 2. Look at the search form.
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

    // 3. Type "Saint P" in Location and pick "Saint Paul, MN" from the suggestions.
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
      await expect(jobs.locationInput).toHaveValue(PLACE);
      // The list closes (hidden or emptied).
      await expect(jobs.locationSuggestions.first()).toBeHidden();
    });

    // 4. Type "nurse" in Keyword, set Distance to "10 miles", and click "Search".
    await test.step('search with keyword, location and distance', async () => {
      await jobs.keywordInput.fill(KEYWORD);
      await jobs.distanceSelect.selectOption('10');
      await jobs.searchButton.click();
      await jobs.waitForParams({ title: KEYWORD });
      const params = jobs.params();
      expect(params.get('location[text]')).toBe(PLACE);
      expect(params.get('radius')).toBe('10');
      await expect(jobs.keywordInput).toHaveValue(KEYWORD);
      await expect(jobs.locationInput).toHaveValue(PLACE);
      await expect(jobs.distanceSelect.locator('option:checked')).toHaveText(
        '10 miles',
      );
      await expect(jobs.cards.first()).toBeVisible();
    });
  });

  // JS-2 checks only that the homepage block hands its search over to Job
  // Search. That Job Search itself loads, lists jobs and has no JavaScript
  // errors is JS-1; the homepage's JavaScript errors are GN-5 in
  // test-suites/smoke/smoke-public-site.md.
  test('JS-2: Homepage Job Search hands over the search', async ({ page }) => {
    const home = new HomePage(page);
    const jobs = new JobSearchPage(page);
    await home.goto();

    // In the Job Search block, type "nurse" and click "Search".
    await home.jobSearchKeywordInput.fill(KEYWORD);
    await home.jobSearchButton.click();

    await expect(page).toHaveURL(/\/job-search\?/);
    const params = jobs.params();
    expect(params.get('title')).toBe(KEYWORD);
    expect(params.get('radius'), 'the default distance, 20 miles').toBe('20');
    await expect(jobs.keywordInput).toHaveValue(KEYWORD);
  });

  test('JS-3: Jobs have their links', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    await jobs.search({ title: KEYWORD });
    const siteHost = new URL(page.url()).host;

    // Look at the first 3 jobs.
    await expect(jobs.cards.nth(2)).toBeVisible();
    const cards = (await jobs.cards.all()).slice(0, 3);
    for (const [index, card] of cards.entries()) {
      await test.step(`job ${index + 1}`, async () => {
        await expect(card, 'every job has an ID').toHaveAttribute(
          'data-jvid',
          /.+/,
        );
        const jobId = await card.getAttribute('data-jvid');
        // A title.
        await expect(jobs.cardTitle(card)).not.toBeEmpty();
        // A "Learn more and apply" link to the employer's posting on another
        // site, in a new tab. Each card has it twice (wide screens, phones).
        const applyLinks = jobs.applyLinks(card);
        expect(await applyLinks.count()).toBeGreaterThan(0);
        for (const apply of await applyLinks.all()) {
          const href = (await apply.getAttribute('href')) ?? '';
          expect(href).toMatch(/^https:\/\//);
          expect(
            new URL(href).host,
            'Learn more and apply should go to another site',
          ).not.toBe(siteHost);
          await expect(apply).toHaveAttribute('target', '_blank');
        }
        // A "Read more" link to that job.
        await expect(jobs.readMoreLink(card)).toHaveAttribute(
          'href',
          new RegExp(`[?&]jvid=${jobId}`),
        );
      });
    }
  });

  test('JS-4: A job opens on its own', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    await jobs.search({ title: KEYWORD });
    const first = jobs.cards.first();
    await expect(first).toBeVisible();
    const jobId = (await first.getAttribute('data-jvid')) ?? '';
    const title = (await jobs.cardTitle(first).textContent())?.trim() ?? '';

    // Click "Read more" on the first job.
    await jobs.readMoreLink(first).click();

    await expect(page).toHaveURL(new RegExp(`[?&]jvid=${jobId}`));
    await expect(jobs.cards).toHaveCount(1);
    const job = jobs.cards.first();
    await expect(job).toHaveAttribute('data-jvid', jobId);
    await expect(jobs.cardTitle(job)).toHaveText(title);
    await expect(jobs.fullDescription(job)).toBeVisible();
    await expect(jobs.fullDescription(job)).not.toBeEmpty();
  });

  test('JS-5: Save search and Bookmark ask to log in', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    // Don't log in.
    await jobs.search({ title: KEYWORD });
    await expect(jobs.cards.first()).toBeVisible();

    // Bookmark first: on a phone, Save search is in the filters drawer, which
    // stays open over the job cards after the dialog is closed.
    const actions = [
      {
        step: '1. Click "Bookmark" on the first job, then close the dialog.',
        name: 'Bookmark',
        open: async () => jobs.bookmarkLink(jobs.cards.first()).click(),
      },
      {
        step: '2. Click "Save search" (on a phone, open "Filters" first), then close the dialog.',
        name: 'Save search',
        open: async () => {
          await jobs.showFilters();
          await jobs.saveSearchLink.click();
        },
      },
    ];
    for (const { step, name, open } of actions) {
      await test.step(step, async () => {
        await open();
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
        const staffLogin = dialog.getByRole('link', {
          name: 'DEED staff and partners log in here.',
        });
        await expect(staffLogin).toHaveAttribute('href', /^\/user\/login\?/);
        const href = (await staffLogin.getAttribute('href')) ?? '';
        const destination =
          new URL(href, page.url()).searchParams.get('destination') ?? '';
        expect(
          destination,
          'the staff login should come back to this search',
        ).toMatch(new RegExp(`^/job-search\\?title=${KEYWORD}(#|&|$)`));
        await close.click();
        await expect(dialog).toBeHidden();
      });
    }
  });
});
