import type { Locator, Page, TestInfo } from '@playwright/test';
import { test, expect } from '../helpers/fixtures';
import { describeViolations, scanPage } from '../helpers/a11y';
import { JobSearchPage } from '../pages/job-search.page';
import { LoginPage } from '../pages/login.page';
import { MobileHeader } from '../pages/mobile-header.page';

// [Accessibility - Public Pages] - Test Plan, A11Y-1 to A11Y-5.
// See test-plans/accessibility-public.md.
//
// Each test opens a public page, waits until its main content is drawn, and
// scans it with axe-core against WCAG 2.2 A/AA. A test fails on any
// violation, so every accessibility problem found is reported.

async function expectNoViolations(page: Page, testInfo: TestInfo) {
  const scan = await scanPage(page, testInfo);
  expect(scan.violations, describeViolations(scan)).toEqual([]);
}

const h1 = (page: Page, name: string | RegExp): Locator =>
  page.getByRole('main').getByRole('heading', { level: 1, name });

// The pages the anonymous smoke plan visits, plus the 404 page.
const PAGES: { name: string; path: string; ready: (page: Page) => Locator }[] = [
  {
    name: 'Homepage',
    path: '/',
    ready: (page) => page.getByRole('heading', { name: 'Job Search' }).first(),
  },
  { name: 'Login', path: '/user/login', ready: (page) => new LoginPage(page).jobSeekerHeading },
  {
    name: 'Site search',
    path: '/search?k=job',
    ready: (page) => page.locator('.view-header__result-summary-header'),
  },
  {
    name: 'Explore Careers search',
    path: '/explore/careers?otitle=Nursing',
    ready: (page) => page.locator('.views-row').first(),
  },
  {
    name: 'Career page',
    path: '/explore/careers/29-1141.00',
    ready: (page) => h1(page, 'Registered Nurses'),
  },
  {
    name: 'Job Search',
    path: '/job-search?title=nurse',
    ready: (page) => page.locator('main .job-search-result').first(),
  },
  {
    name: 'Events',
    path: '/education-and-training/events',
    ready: (page) => page.getByRole('main').getByRole('article').first(),
  },
  {
    name: 'Programs and Services',
    path: '/programs-services',
    ready: (page) => page.getByRole('main').getByRole('article').first(),
  },
  {
    name: 'Training Programs',
    path: '/training-programs',
    ready: (page) => page.getByRole('main').getByRole('article').first(),
  },
  {
    name: 'Location (Bloomington)',
    path: '/careerforce-location/careerforce-bloomington',
    ready: (page) => h1(page, 'CareerForce in Bloomington'),
  },
  {
    name: 'CareerForce from Anywhere',
    path: '/anywhere',
    ready: (page) => h1(page, 'CareerForce from Anywhere'),
  },
  {
    name: 'Schedule an appointment',
    path: '/connect-careerforce/schedule-an-appointment',
    ready: (page) => page.getByRole('main').getByRole('heading', { level: 1 }),
  },
  {
    name: 'Skills Matcher',
    path: '/occupations/skills_matcher',
    ready: (page) => page.getByRole('main').locator('form'),
  },
  {
    name: 'Interest Profiler',
    path: '/occupations/interest_profiler',
    ready: (page) => page.getByRole('main').locator('form'),
  },
  {
    name: 'Employment Readiness Assessment',
    path: '/employment-readiness/take',
    ready: (page) => h1(page, 'Employment Readiness Assessment'),
  },
  { name: 'Find a Job', path: '/find-job', ready: (page) => h1(page, /^Find a Job/) },
  {
    name: 'Job Loss Resources',
    path: '/job-loss-resources',
    ready: (page) => h1(page, /^Job Loss Resources/),
  },
  {
    name: 'Job Search Tools',
    path: '/job-search-tools',
    ready: (page) => h1(page, /^Job Search Tools/),
  },
  {
    name: 'Education and Training',
    path: '/education-and-training',
    ready: (page) => h1(page, /^Education and Training/),
  },
  {
    name: 'Resources for',
    path: '/resources-job-seekers-and-career-explorers',
    ready: (page) => h1(page, /^Resources for/),
  },
  {
    name: 'Blog post (High School, High Wages)',
    path: '/careerforce-blog/high-school-high-wages',
    ready: (page) => h1(page, 'High School, High Wages'),
  },
  {
    name: 'Page Not Found',
    path: '/pww-smoke-test-no-such-page',
    ready: (page) => page.getByRole('heading', { name: 'Page Not Found' }),
  },
];

for (const { name, path, ready } of PAGES) {
  test(`A11Y-1: ${name} has no WCAG 2.2 AA violations`, async ({ page }, testInfo) => {
    await page.goto(path);
    await expect(ready(page)).toBeVisible();
    await expectNoViolations(page, testInfo);
  });
}

test('A11Y-2: Login page with every section open has no violations', async ({
  page,
}, testInfo) => {
  const login = new LoginPage(page);
  await login.goto();
  await login.partnerToggle.click();
  await expect(login.partnerEmailInput).toBeVisible();
  await login.staffToggle.click();
  await expect(login.staffLoginButton).toBeVisible();
  await expectNoViolations(page, testInfo);
});

test('A11Y-3: Job Search login dialog has no violations', async ({ page }, testInfo) => {
  const jobs = new JobSearchPage(page);
  await jobs.search({ title: 'nurse' });
  await jobs.bookmarkLink(jobs.cards.first()).click();
  await expect(jobs.loginDialog).toBeVisible();
  await expectNoViolations(page, testInfo);
});

test(
  'A11Y-4: Open mobile menu has no violations',
  { tag: '@mobile-only' },
  async ({ page }, testInfo) => {
    const header = new MobileHeader(page);
    await page.goto('/');
    await header.menuToggle.click();
    await expect(header.mainNavigation).toBeVisible();
    await header.subMenuButton('Find a Job').click();
    await expect(header.subMenuLinks('Find a Job').first()).toBeVisible();
    await expectNoViolations(page, testInfo);
  },
);

test(
  'A11Y-5: Job Search filters drawer has no violations',
  { tag: '@mobile-only' },
  async ({ page }, testInfo) => {
    const jobs = new JobSearchPage(page);
    await jobs.search({ title: 'nurse' });
    await jobs.showFilters();
    await expect(jobs.companySelect).toBeVisible();
    await expectNoViolations(page, testInfo);
  },
);
