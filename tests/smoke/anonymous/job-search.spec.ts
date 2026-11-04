import { test, expect } from '../../helpers/fixtures';
import { isKnownPageError } from '../../helpers/known-issues';
import { HomePage } from '../../pages/home.page';
import { JobSearchPage } from '../../pages/job-search.page';

// [Smoke] - Anonymous - Test Plan, JS-1 to JS-5.
// See test-plans/smoke-anonymous.md.
//
// The jobs come from an outside feed, so the tests never name a job,
// company or city: they take whatever the search returns.
// Nothing is saved: Save search and Bookmark only open the login prompt,
// which is closed again.

const KEYWORD = 'nurse';

test('JS-1: homepage Job Search opens Job Search results', async ({ page }) => {
  const home = new HomePage(page);
  const jobs = new JobSearchPage(page);
  await home.goto();
  await home.jobSearchKeywordInput.fill(KEYWORD);
  await home.jobSearchButton.click();

  await expect(page).toHaveURL(/\/job-search\?/);
  const params = new URL(page.url()).searchParams;
  expect(params.get('title')).toBe(KEYWORD);
  expect(params.get('radius'), 'the default distance, 20 miles').toBe('20');
  await expect(jobs.heading).toBeVisible();
  await expect(jobs.keywordInput).toHaveValue(KEYWORD);
  expect(await jobs.resultCount()).toBeGreaterThan(0);
});

test('JS-2: each job in the results has a title and its links', async ({ page }) => {
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
      await expect(jobs.readMoreLink(card)).toHaveAttribute('href', new RegExp(`jvid=${jobId}`));
    });
  }
});

test('JS-3: Read more opens the job on its own', async ({ page }) => {
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

test('JS-4: Save search and Bookmark ask an anonymous visitor to log in', async ({
  page,
  isMobile,
}) => {
  // Known bug (found on QA, 2026-11-04): on a phone, Save search is in the
  // full-screen filters drawer, and its login dialog opens *behind* that
  // drawer, so the visitor sees nothing happen. Remove this line once it's
  // fixed: Playwright then reports "expected to fail, but passed".
  test.fail(isMobile, 'Phone: Save search login dialog opens behind the filters drawer');

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
        dialog.getByRole('heading', { name: 'Create an account or log in to use this feature' }),
      ).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Log In or Register' })).toBeVisible();
      await expect(dialog.getByRole('link', { name: 'Continue Browsing' })).toBeVisible();
      // The staff/partner login sends them back to this search afterwards.
      await expect(
        dialog.getByRole('link', { name: 'DEED staff and partners log in here.' }),
      ).toHaveAttribute('href', /^\/user\/login\?destination=\/job-search/);
      await close.click();
      await expect(dialog).toBeHidden();
    });
  }
});

// Uncaught JavaScript errors only. Console messages are not checked: the
// tests block analytics and the AWS WAF script on purpose, and those
// blocked loads show up in the console as errors.
const PAGES = [
  { name: 'Homepage', path: '/' },
  { name: 'Job Search', path: `/job-search?title=${KEYWORD}` },
  { name: 'Site search', path: '/search?k=job' },
  { name: 'Explore Careers', path: '/explore/careers?otitle=Nursing' },
];

for (const { name, path } of PAGES) {
  test(`JS-5: ${name} loads without JavaScript errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(path);
    await page.waitForLoadState('networkidle');

    const pagePath = new URL(page.url()).pathname;
    const unknown = errors.filter((message) => !isKnownPageError(pagePath, message));
    const known = errors.filter((message) => isKnownPageError(pagePath, message));
    if (known.length > 0) {
      test.info().annotations.push({
        type: 'known issue',
        description: `Known JavaScript error(s), see tests/helpers/known-issues.ts: ${known.join(' | ')}`,
      });
    }
    expect(unknown, `New JavaScript errors on ${path}`).toEqual([]);
  });
}
