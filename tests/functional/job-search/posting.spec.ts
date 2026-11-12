import type { Locator, Page, Request } from '@playwright/test';

import { test, expect } from './fixtures';
import { JobSearchPage } from '../../pages/job-search.page';
import {
  JOB_ID,
  KEYWORD,
  NURSE_SEARCH,
  cardLocation,
  expectFocusBack,
  expectLoginDialogOpen,
  loginDialogControls,
  openFirstNurseJob,
  shareButton,
  visibleApplyLink,
  type JobSummary,
} from './helpers/posting-accessibility';

// spec: test-plans/functional-job-search-posting-accessibility.md ("One job on its own", PO-1 to PO-9)
// seed: tests/seed.spec.ts
//
// A visitor who isn't logged in; nothing is changed. The jobs come from an
// outside feed, so every case uses the first job of a "nurse" search. The
// checks every case shares (no JavaScript error, no 4xx/5xx from the site,
// no raw error) run in ./fixtures.ts.

const clean = (text: string | null) => (text ?? '').replace(/\s+/g, ' ').trim();

// The job on its own, as PO-1 and PO-2 expect it.
async function expectJobOnItsOwn(page: Page, job: JobSummary) {
  const jobs = new JobSearchPage(page);
  await expect(jobs.cards, 'exactly one job should show').toHaveCount(1);
  const card = jobs.cards.first();
  await expect(card).toHaveAttribute('data-jvid', job.id);
  await expect(jobs.cardTitle(card), 'the same title').toHaveText(job.title);
  await expect(jobs.cardCompany(card), 'the same company').toHaveText(
    job.company,
  );
  await expect(cardLocation(card), 'the same location').toHaveText(
    job.location,
  );
  return card;
}

test.describe('One job on its own', () => {
  test('PO-1: Read more opens the job on its own', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    let job: JobSummary;

    // 1. Note the first job's title, company, location and short description.
    await test.step("1. Note the first job's title, company, location and short description.", async () => {
      job = await openFirstNurseJob(page);
      expect(job.title, 'the first job should have a title').not.toBe('');
      expect(
        job.summary,
        'the first job should have a short description',
      ).not.toBe('');
    });

    // 2. Click its "Read more".
    await test.step('2. Click its "Read more".', async () => {
      await jobs.readMoreLink(job.card).click();
      await page.waitForURL((url) => url.searchParams.has('jvid'));
      const url = new URL(page.url());
      expect(url.pathname, 'the address should be /job-search').toBe(
        '/job-search',
      );
      expect(
        [...url.searchParams.keys()],
        'the address should only have jvid',
      ).toEqual(['jvid']);
      expect(
        url.searchParams.get('jvid'),
        'the job ID: 32 to 40 letters a–f and digits',
      ).toMatch(JOB_ID);
      expect(url.searchParams.get('jvid'), 'the ID of the job clicked').toBe(
        job.id,
      );

      const card = await expectJobOnItsOwn(page, job);
      const full = jobs.fullDescription(card);
      await expect(full, 'the full description should show').toBeVisible();
      const fullText = clean(await full.textContent());
      // The short description ends with ".." or "…" where it was cut.
      const shortText = job.summary.replace(/(\.{2,}|…)$/, '').trim();
      expect(
        fullText.length,
        'the full description should be longer than the short one',
      ).toBeGreaterThan(shortText.length);
      const firstWords = shortText.split(' ').slice(0, 6).join(' ');
      expect(
        fullText,
        'the full description should start with the same words as the short one',
      ).toContain(firstWords);
      expect(
        fullText.indexOf(firstWords),
        'the full description should start with the same words',
      ).toBeLessThan(5);

      await expect(
        visibleApplyLink(jobs, card),
        '"Learn more and apply"',
      ).toBeVisible();
      await expect(shareButton(card), 'Share').toBeVisible();
      await expect(jobs.bookmarkLink(card), 'the bookmark icon').toBeVisible();
      await expect(
        page.getByRole('heading', { name: 'Get matched with the right jobs' }),
        'the "Get matched with the right jobs" banner should not show',
      ).toBeHidden();
      await expect(jobs.pager, 'the pager should not show').toBeHidden();
    });
  });

  test('PO-2: Share copies a link to the job', async ({ page, context }) => {
    const jobs = new JobSearchPage(page);
    let job: JobSummary;
    let copied = '';
    let readMoreId = '';

    // 1. Allow the page to use the clipboard.
    await test.step('1. Allow the page to use the clipboard.', async () => {
      job = await openFirstNurseJob(page);
      await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
        origin: new URL(page.url()).origin,
      });
      const href =
        (await jobs.readMoreLink(job.card).getAttribute('href')) ?? '';
      readMoreId = new URL(href, page.url()).searchParams.get('jvid') ?? '';
    });

    // 2. Click "Share" on the first job.
    await test.step('2. Click "Share" on the first job.', async () => {
      await shareButton(job.card).click();
      // The page confirms the copy, on the button or in a message.
      const confirmation = shareButton(job.card)
        .filter({ hasText: /copied/i })
        .or(page.getByRole('status').filter({ hasText: /copied/i }))
        .or(page.getByRole('alert').filter({ hasText: /copied/i }))
        .or(
          page.locator('#drupal-live-announce').filter({ hasText: /copied/i }),
        );
      await expect(
        confirmation.first(),
        'the page should confirm the link was copied',
      ).toBeAttached();
    });

    // 3. Read the clipboard.
    await test.step('3. Read the clipboard.', async () => {
      copied = await page.evaluate(() => navigator.clipboard.readText());
      const site = new URL(page.url());
      expect(
        copied,
        'the clipboard should hold a full https:// address',
      ).toMatch(/^https:\/\//);
      const url = new URL(copied);
      expect(url.host, 'the same site as the page').toBe(site.host);
      expect(url.pathname, 'the address should be /job-search').toBe(
        '/job-search',
      );
      expect(
        url.searchParams.get('jvid'),
        'the job ID should be 32 to 40 letters a–f and digits',
      ).toMatch(JOB_ID);
      expect(
        url.searchParams.get('jvid'),
        'the same ID as the job\'s "Read more" link',
      ).toBe(readMoreId);
      expect(url.searchParams.get('jvid'), 'the ID of the job shared').toBe(
        job.id,
      );
    });

    // 4. Open what was copied in a new tab.
    await test.step('4. Open what was copied in a new tab.', async () => {
      const tab = await context.newPage();
      await tab.goto(copied);
      await expectJobOnItsOwn(tab, job);
      await expect(
        new JobSearchPage(tab).fullDescription(
          new JobSearchPage(tab).cards.first(),
        ),
      ).toBeVisible();
      await tab.close();
    });
  });

  test('PO-3: "Learn more and apply" opens the employer\'s site in a new tab', async ({
    page,
    context,
  }) => {
    const jobs = new JobSearchPage(page);
    let job: JobSummary;
    let apply: Locator;
    let href = '';

    // 1. Look at the first job's "Learn more and apply" link.
    await test.step('1. Look at the first job\'s "Learn more and apply" link.', async () => {
      job = await openFirstNurseJob(page);
      apply = visibleApplyLink(jobs, job.card);
      await expect(apply).toBeVisible();
      await expect(apply, 'it should open in a new tab').toHaveAttribute(
        'target',
        '_blank',
      );
      await expect(
        apply,
        'it should have rel="noopener" or "noreferrer"',
      ).toHaveAttribute('rel', /\b(noopener|noreferrer)\b/);
      href = (await apply.getAttribute('href')) ?? '';
      expect(href, 'a full https:// address').toMatch(/^https:\/\//);
      expect(new URL(href).host, 'on another site, not this one').not.toBe(
        new URL(page.url()).host,
      );
    });

    // 2. Click it. 3. Wait for the new tab's first page to start loading.
    // The employer's site is never reached: its answer is replaced by an
    // empty page, so nothing can be filled in or submitted there.
    await test.step("2–3. Click it and wait for the new tab's first page to start loading.", async () => {
      const searchUrl = page.url();
      const before = context.pages().length;
      await context.route(href, (route) =>
        route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: '<!doctype html><title>employer</title>',
        }),
      );
      const [tab] = await Promise.all([
        context.waitForEvent('page'),
        apply.click(),
      ]);
      await tab.waitForURL((url) => url.href !== 'about:blank', {
        waitUntil: 'commit',
      });
      expect(tab.url(), "the new tab should open the link's address").toBe(
        href,
      );
      expect(context.pages().length, 'exactly one new tab should open').toBe(
        before + 1,
      );
      expect(page.url(), 'the Job Search tab should stay where it was').toBe(
        searchUrl,
      );

      // 4. Close the new tab.
      await tab.close();
      await expect(jobs.cards.first()).toBeVisible();
    });
  });

  test("PO-4: A job ID that doesn't exist", async ({ page, siteHealth }) => {
    const jobs = new JobSearchPage(page);
    // "Not found" may be answered with a 404, as long as it is this site's page.
    siteHealth.allowStatus('/job-search', [404]);

    // 1. Open the page.
    const response = await page.goto(`/job-search?jvid=${'0'.repeat(32)}`);
    expect(
      response?.status() ?? 0,
      'the site should answer with a page, not a server error',
    ).toBeLessThan(500);
    await expect(
      page.getByRole('banner').first(),
      'a page from this site (its header)',
    ).toBeVisible();
    await expect(
      page.getByRole('main').getByText(JOB_NOT_FOUND).first(),
      "the page should say the job wasn't found or is no longer available",
    ).toBeVisible();
    await expect(
      page
        .getByRole('main')
        .getByRole('link', { name: /job search|back|search (for )?jobs/i })
        .and(page.locator('a[href*="/job-search"]'))
        .first(),
      'a way back to Job Search',
    ).toBeVisible();
    await expectNoBrokenCard(jobs);
  });

  test("PO-5: A job ID that isn't a job ID", async ({ page, siteHealth }) => {
    const jobs = new JobSearchPage(page);
    siteHealth.allowStatus('/job-search', [404]);
    const alerts: string[] = [];
    page.on('dialog', async (dialog) => {
      alerts.push(dialog.message());
      await dialog.dismiss();
    });

    const values = [
      'nothex',
      'abcdef'.repeat(7).slice(0, 41),
      '<script>alert(1)</script>',
    ];
    // 1. Open each.
    for (const [index, value] of values.entries()) {
      await test.step(`1.${index + 1} Open ?jvid=${value}`, async () => {
        const response = await page.goto(
          `/job-search?jvid=${encodeURIComponent(value)}`,
        );
        const status = response?.status() ?? 0;
        // Soft, so every value is opened and reported.
        expect
          .soft(
            status < 400 || status === 404,
            `?jvid=${value} should not give an error (got ${status})`,
          )
          .toBe(true);
        await expect
          .soft(page.getByRole('banner').first(), 'a page from this site')
          .toBeVisible();
        const notFound = page
          .getByRole('main')
          .getByText(JOB_NOT_FOUND)
          .first();
        await expect
          .soft(
            notFound.or(jobs.cards.first()),
            `?jvid=${value} should show the "job not found" message or the normal Job Search page with jobs`,
          )
          .toBeVisible();
        await expectNoBrokenCard(jobs);
        const injected = await page.evaluate(() =>
          Array.from(document.querySelectorAll('script')).some((s) =>
            s.textContent?.includes('alert(1)'),
          ),
        );
        expect(
          injected,
          'the page should never show the raw value as markup',
        ).toBe(false);
        expect(alerts, 'no alert should open').toEqual([]);
      });
    }
  });

  // PO-6 to PO-8: the login dialog opens from a control, and Esc, the close
  // button and "Continue Browsing" each close it.
  const OPENERS = [
    {
      id: 'PO-6',
      title: 'Bookmark asks a visitor to log in',
      name: 'the bookmark icon',
      opener: (jobs: JobSearchPage) => jobs.bookmarkLink(jobs.cards.first()),
      reveal: async () => undefined,
    },
    {
      id: 'PO-7',
      title: 'Save search asks a visitor to log in',
      name: '"Save search"',
      opener: (jobs: JobSearchPage) => jobs.saveSearchLink,
      // On a phone, Save search is in the "Filters" drawer.
      reveal: async (jobs: JobSearchPage) => {
        if (!(await jobs.saveSearchLink.isVisible())) await jobs.showFilters();
      },
    },
    {
      id: 'PO-8',
      title: 'Customize my search asks a visitor to log in',
      name: '"Customize my search"',
      opener: (jobs: JobSearchPage) =>
        jobs.page
          .getByRole('main')
          .getByRole('link', { name: 'Customize my search' }),
      reveal: async () => undefined,
    },
  ];

  for (const { id, title, name, opener, reveal } of OPENERS) {
    test(`${id}: ${title}`, async ({ page }) => {
      const jobs = new JobSearchPage(page);
      await openFirstNurseJob(page);
      const searchUrl = page.url();
      const listed = (await jobs.results()).items;
      const control = opener(jobs);
      const { dialog, close, continueBrowsing } = loginDialogControls(jobs);

      const closers = [
        { how: 'press Esc', close: () => page.keyboard.press('Escape') },
        {
          how: "close with the dialog's close button",
          close: () => close.click(),
        },
        {
          how: 'click "Continue Browsing"',
          close: () => continueBrowsing.click(),
        },
      ];
      for (const [index, closer] of closers.entries()) {
        // 1. Click it, press Esc. 2. Click again, close button. 3. Click again, "Continue Browsing".
        await test.step(`${index + 1}. Click ${name}, then ${closer.how}.`, async () => {
          await reveal(jobs);
          await control.click();
          await expectLoginDialogOpen(jobs, name);
          await closer.close();
          await expect(
            dialog,
            `${closer.how} should close the dialog`,
          ).toBeHidden();
          await expectFocusBack(jobs, control, name);
          expect(page.url(), 'the address should be unchanged').toBe(searchUrl);
          expect(
            (await jobs.results()).items,
            'the jobs listed should be unchanged',
          ).toEqual(listed);
        });
      }
    });
  }

  test("PO-9: The dialog's login links come back to this search", async ({
    page,
  }) => {
    const jobs = new JobSearchPage(page);
    const sources = [
      {
        name: "the first job's bookmark icon",
        open: async (job: JobSummary) => jobs.bookmarkLink(job.card).click(),
        fragment: (job: JobSummary) => `#bookmark[${job.id}]`,
      },
      {
        name: '"Save search"',
        open: async () => {
          if (!(await jobs.saveSearchLink.isVisible()))
            await jobs.showFilters();
          await jobs.saveSearchLink.click();
        },
        fragment: () => '#save-search',
      },
    ];

    for (const [index, source] of sources.entries()) {
      // 1. Open the dialog from the bookmark icon and look where its links go.
      // 2. Do the same from "Save search".
      await test.step(`${index + 1}. Open the login dialog from ${source.name} and look where its links go.`, async () => {
        const job = await openFirstNurseJob(page);
        const siteHost = new URL(page.url()).host;
        const back = `/job-search?title=${KEYWORD}${source.fragment(job)}`;
        await source.open(job);
        await expectLoginDialogOpen(jobs, source.name);
        const { staffLogin, login } = loginDialogControls(jobs);

        // "DEED staff and partners log in here." goes to this site's /user/login.
        const staffHref = new URL(
          (await staffLogin.getAttribute('href')) ?? '',
          page.url(),
        );
        expect(staffHref.host, 'the staff login should be on this site').toBe(
          siteHost,
        );
        expect(
          staffHref.pathname,
          'the staff login should go to /user/login',
        ).toBe('/user/login');
        expect(
          staffHref.searchParams.get('destination') ?? '',
          'the staff login should come back to this search',
        ).toMatch(new RegExp(`^${escape(NURSE_SEARCH)}(#|$)`));

        // "Log In or Register" sends the browser to the login page. The first
        // address it is sent to is read, and the request is stopped there.
        const isLoginPage = (request: Request) => {
          const url = new URL(request.url());
          return (
            request.isNavigationRequest() &&
            request.frame() === page.mainFrame() &&
            (url.host !== siteHost || url.pathname === '/user/login')
          );
        };
        await page.route('**/*', (route) =>
          isLoginPage(route.request()) ? route.abort() : route.fallback(),
        );
        const [request] = await Promise.all([
          page.waitForRequest(isLoginPage),
          login.click(),
        ]);
        await page.unroute('**/*');
        const target = new URL(request.url());
        expect(
          /(^|[.-])login\.mn\.gov$/.test(target.host) ||
            (target.host === siteHost && target.pathname === '/user/login'),
          `"Log In or Register" should lead to LoginMN or /user/login, not ${target.origin}${target.pathname}`,
        ).toBe(true);
        // Soft, so the "Save search" step still runs and reports too.
        expect
          .soft(
            decodeAll(request.url()),
            `"Log In or Register" should carry a return address back to this search (${back})`,
          )
          .toContain(back);
      });
    }
  });
});

// "The job wasn't found", "this job is no longer available", and the like.
// A plain "No results found." for the search doesn't count.
const JOB_NOT_FOUND =
  /\bjob\b[^.]{0,40}\b(not found|no longer available|not available|has expired|expired|been removed|doesn'?t exist|does not exist)|(couldn'?t|could not|can'?t|cannot) find (this|that|the) job/i;

// No job card without a title, and no "Learn more and apply" without an address.
async function expectNoBrokenCard(jobs: JobSearchPage) {
  for (const card of await jobs.cards.all()) {
    await expect(jobs.cardTitle(card), 'no empty job card').not.toBeEmpty();
    for (const apply of await jobs.applyLinks(card).all()) {
      await expect(
        apply,
        '"Learn more and apply" should have an address',
      ).toHaveAttribute('href', /^https?:\/\/\S+/);
    }
  }
}

function escape(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// The URL with every layer of %-encoding undone, so a return address nested
// in a parameter can be found.
function decodeAll(url: string): string {
  let current = url;
  for (let i = 0; i < 4; i++) {
    try {
      const next = decodeURIComponent(current);
      if (next === current) break;
      current = next;
    } catch {
      break;
    }
  }
  return current;
}
