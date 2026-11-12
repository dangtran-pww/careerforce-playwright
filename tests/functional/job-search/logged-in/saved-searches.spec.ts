import { test, expect } from '../fixtures';
import { useRole } from '../../../helpers/roles';
import { DashboardPage } from '../../../pages/dashboard.page';
import { JobSearchPage } from '../../../pages/job-search.page';
import {
  KEYWORD,
  SAVED,
  SEARCH_LIMIT,
  checkAccountUnchanged,
  cleanUpSearchesStartingWith,
  expectSearchRoom,
  fitsWidth,
  insideViewport,
  jobsForMeOptions,
  pickJobsForMe,
  recordDialogs,
  saveCurrentSearch,
  saveDialogParts,
  testName,
  waitForNewPage,
} from './helpers';

// [Functional] - Job Search - Logged-in Job Seeker - Test Plan, SV-1 to SV-9.
// See test-suites/job-search/functional-job-search-logged-in.md.
//
// Saves searches on the job seeker account, so QA and Stage only
// (@no-prod), desktop only. Every name starts with `Playwright test
// <timestamp>`, and each test removes, in `finally`, only the searches it
// saved.

// Saved searches with a blank name (which SV-2 must not create) have no
// name to match, so they are found by counting.
async function blankSearchCount(dashboard: DashboardPage): Promise<number> {
  return (await dashboard.savedSearchNames()).filter((n) => n === '').length;
}

// Removes the newest blank-named saved searches beyond the `before` that
// were there before the test.
async function removeNewBlankSearches(
  dashboard: DashboardPage,
  before: number,
) {
  for (let tries = 0; tries < 3; tries++) {
    await dashboard.goto();
    if ((await blankSearchCount(dashboard)) <= before) return;
    const items = dashboard.items(dashboard.savedSearches);
    const texts = await items
      .locator('a:not(.remove-field-link)')
      .allTextContents();
    const last = texts.map((t) => t.trim()).lastIndexOf('');
    await dashboard.remove(items.nth(last));
  }
}

// The form values a saved search must give back (SV-3).
type SearchValues = {
  title: string;
  location: string;
  radius: string;
  sort: string;
  loc: string;
  company: string;
};

async function expectSearchShown(
  jobs: JobSearchPage,
  values: SearchValues,
  ids: string[],
) {
  const params = jobs.params();
  expect(params.get('title')).toBe(values.title);
  expect(params.get('location[text]')).toBe(values.location);
  expect(params.get('radius')).toBe(values.radius);
  expect(params.get('sort')).toBe(values.sort);
  expect(params.get('loc')).toBe(values.loc);
  expect(params.get('company')).toBe(values.company);
  await expect(jobs.keywordInput).toHaveValue(values.title);
  await expect(jobs.locationInput).toHaveValue(values.location);
  await expect(jobs.distanceSelect).toHaveValue(values.radius);
  await expect(jobs.sortSelect).toHaveValue(values.sort);
  await expect(jobs.citySelect).toHaveValue(values.loc);
  await expect(jobs.companySelect).toHaveValue(values.company);
  expect((await jobs.results()).items, 'the same jobs as when saved').toEqual(
    ids,
  );
}

test.describe('saved searches', { tag: ['@no-prod', '@desktop-only'] }, () => {
  useRole('jobseeker');
  checkAccountUnchanged();

  test('SV-1: closing the dialog saves nothing', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    const dashboard = new DashboardPage(page);
    const name = testName();
    const before = await expectSearchRoom(dashboard, 0);

    try {
      await jobs.search({ title: KEYWORD });
      const listedBefore = (await jobsForMeOptions(jobs, SAVED)).map(
        (o) => o.text,
      );
      const { dialog, nameBox, save, close } = saveDialogParts(jobs);

      await test.step('close with Esc', async () => {
        await jobs.openSaveSearchDialog();
        await expect(
          dialog.getByRole('heading', {
            name: 'Save this search to your dashboard',
          }),
        ).toBeVisible();
        await expect(nameBox, 'a labelled "Name job search" box').toBeVisible();
        await expect(save).toBeVisible();
        await expect(close).toBeVisible();
        await nameBox.fill(name);
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
      });

      await test.step('close with the close button', async () => {
        await jobs.openSaveSearchDialog();
        await nameBox.fill(name);
        await close.click();
        await expect(dialog).toBeHidden();
      });

      expect(
        (await jobsForMeOptions(jobs, SAVED)).map((o) => o.text),
        'Jobs for me is unchanged',
      ).toEqual(listedBefore);
      await page.reload();
      expect(
        (await jobsForMeOptions(jobs, SAVED)).map((o) => o.text),
        'Jobs for me is unchanged after a reload',
      ).toEqual(listedBefore);
      await dashboard.goto();
      expect(
        await dashboard.savedSearchNames(),
        'the dashboard is unchanged',
      ).toEqual(before);
    } finally {
      await dashboard.cleanUp({ searches: [name] });
    }
  });

  test('SV-2: a name is needed', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    const dashboard = new DashboardPage(page);
    const before = await expectSearchRoom(dashboard, 1);
    const blanksBefore = before.filter((n) => n === '').length;

    try {
      await jobs.search({ title: KEYWORD });
      const { dialog, nameBox, save } = saveDialogParts(jobs);
      await jobs.openSaveSearchDialog();

      for (const [label, value] of [
        ['empty', ''],
        ['only spaces', '   '],
      ]) {
        await test.step(`name ${label}`, async () => {
          await nameBox.fill(value);
          await save.click();
          await expect(dialog, 'the dialog stays open').toBeVisible();
          // The browser's own "Please fill out this field" on a required
          // box counts as the message, as does one from the site next to
          // the box.
          const siteMessage = dialog
            .locator(
              '.form-item--error-message, .messages--error, [role="alert"]',
            )
            .filter({ hasText: /required|name|enter/i });
          await expect
            .poll(
              async () =>
                (await nameBox.evaluate(
                  (el) => (el as HTMLInputElement).validationMessage,
                )) !== '' || (await siteMessage.first().isVisible()),
              { message: 'a message says the name is needed' },
            )
            .toBe(true);
        });
      }

      await dashboard.goto();
      expect(await dashboard.savedSearchNames(), 'nothing is saved').toEqual(
        before,
      );
    } finally {
      await removeNewBlankSearches(dashboard, blanksBefore);
    }
  });

  test('SV-3: a saved search keeps every value', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    const dashboard = new DashboardPage(page);
    const name = testName();
    await expectSearchRoom(dashboard, 1);

    try {
      const base = {
        title: KEYWORD,
        'location[text]': '55101',
        radius: '50',
        sort: 'company-asc',
      };
      await jobs.search(base);
      const [city] = await jobs.topOptions(jobs.citySelect, 1);
      expect(city, 'the City dropdown lists at least 1 city').toBeDefined();
      await jobs.search({ ...base, loc: city.value });
      const [company] = await jobs.topOptions(jobs.companySelect, 1);
      expect(
        company,
        'the Company dropdown lists at least 1 company',
      ).toBeDefined();
      await jobs.search({ ...base, loc: city.value, company: company.value });
      const ids = (await jobs.results()).items;
      expect(ids.length, 'the search lists jobs').toBeGreaterThan(0);
      await saveCurrentSearch(jobs, name);

      const values: SearchValues = {
        title: KEYWORD,
        location: '55101',
        radius: '50',
        sort: 'company-asc',
        loc: city.value,
        company: company.value,
      };

      await test.step('from Jobs for me', async () => {
        await page.goto('/job-search');
        const option = (await jobsForMeOptions(jobs, SAVED)).find(
          (o) => o.text === name,
        );
        expect(option, `Jobs for me lists "${name}"`).toBeDefined();
        await pickJobsForMe(jobs, SAVED, option?.value ?? '');
        await expectSearchShown(jobs, values, ids);
      });

      await test.step('from the dashboard', async () => {
        await dashboard.goto();
        await dashboard.open('Saved searches');
        await waitForNewPage(page, () =>
          dashboard
            .savedSearch(name)
            .getByRole('link', { name, exact: true })
            .click(),
        );
        await expectSearchShown(jobs, values, ids);
      });
    } finally {
      await dashboard.cleanUp({ searches: [name] });
    }
  });

  test('SV-4: names are shown as typed', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    const dashboard = new DashboardPage(page);
    const dialogs = recordDialogs(page);
    const name = testName('<b>Bold</b> & "R&D" <script>alert(1)</script>');
    await expectSearchRoom(dashboard, 1);

    // No element on the page made from the name.
    const expectNoMarkupFromName = async () => {
      await expect(
        page.locator('b, strong').filter({ hasText: /^Bold$/ }),
      ).toHaveCount(0);
      expect(
        await page.evaluate(
          () =>
            Array.from(document.querySelectorAll('script')).filter(
              (s) => s.textContent?.trim() === 'alert(1)',
            ).length,
        ),
        'no <script> element from the name',
      ).toBe(0);
    };

    try {
      await jobs.search({ title: KEYWORD });
      await saveCurrentSearch(jobs, name);

      await test.step('Jobs for me', async () => {
        await expect
          .poll(async () =>
            (await jobsForMeOptions(jobs, SAVED)).map((o) => o.text),
          )
          .toContain(name);
        await page.reload();
        expect(
          (await jobsForMeOptions(jobs, SAVED)).map((o) => o.text),
          'shown exactly as typed after a reload',
        ).toContain(name);
        await expectNoMarkupFromName();
      });

      await test.step('the dashboard', async () => {
        await dashboard.goto();
        await dashboard.open('Saved searches');
        const link = dashboard
          .items(dashboard.savedSearches)
          .locator('a:not(.remove-field-link)')
          .filter({ hasText: 'Bold' });
        await expect(link).toHaveCount(1);
        expect(((await link.textContent()) ?? '').trim()).toBe(name);
        await expectNoMarkupFromName();
      });

      expect(dialogs, 'no alert opens').toEqual([]);
    } finally {
      await dashboard.cleanUp({ searches: [name] });
    }
  });

  test('SV-5: a long name', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    const dashboard = new DashboardPage(page);
    const prefix = testName();
    const long = `${prefix} `.padEnd(300, 'x');
    await expectSearchRoom(dashboard, 1);

    try {
      await jobs.search({ title: KEYWORD });
      const { dialog, nameBox, save } = saveDialogParts(jobs);
      await jobs.openSaveSearchDialog();
      await nameBox.fill(long);
      const typed = await nameBox.inputValue();
      await save.click();

      const tooLong = dialog.getByText(/too long|at most|characters/i);
      await expect
        .poll(
          async () =>
            !(await dialog.isVisible()) || (await tooLong.isVisible()),
          { message: 'saved (dialog closed) or "too long" shown' },
        )
        .toBe(true);
      const refused = await dialog.isVisible();

      await dashboard.goto();
      const saved = (await dashboard.savedSearchNames()).filter((n) =>
        n.startsWith(prefix),
      );
      if (refused) {
        expect(saved, 'refused with a message: nothing is saved').toEqual([]);
        return;
      }

      await test.step('saved with the name the box allowed', async () => {
        expect(saved).toHaveLength(1);
        expect(
          typed.length,
          'the box allows at least 128 characters',
        ).toBeGreaterThanOrEqual(128);
        expect(saved[0]).toBe(typed);
      });

      await test.step('fits on the dashboard', async () => {
        await dashboard.open('Saved searches');
        const link = dashboard
          .items(dashboard.savedSearches)
          .locator('a:not(.remove-field-link)')
          .filter({ hasText: prefix });
        expect(await insideViewport(link), 'the name fits the screen').toBe(
          true,
        );
        expect(await fitsWidth(page), 'no sideways scroll').toBe(true);
      });

      await test.step('fits in Jobs for me', async () => {
        await page.goto('/job-search');
        await jobs.jobsForMeCategory.selectOption({ label: SAVED });
        expect(
          await insideViewport(jobs.jobsForMeItem),
          'the item dropdown fits the screen',
        ).toBe(true);
        expect(await fitsWidth(page), 'no sideways scroll').toBe(true);
      });
    } finally {
      await cleanUpSearchesStartingWith(dashboard, prefix);
    }
  });

  test('SV-6: two searches with the same name', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    const dashboard = new DashboardPage(page);
    const name = testName('twin');
    await expectSearchRoom(dashboard, 2);

    const twins = () => dashboard.savedSearch(name);
    const openTwin = async (index: number): Promise<string | null> => {
      await dashboard.goto();
      await dashboard.open('Saved searches');
      await waitForNewPage(page, () =>
        twins().nth(index).getByRole('link', { name, exact: true }).click(),
      );
      return jobs.params().get('title');
    };

    try {
      await jobs.search({ title: KEYWORD });
      await saveCurrentSearch(jobs, name);

      await jobs.search({ title: 'welder' });
      const { dialog, save } = saveDialogParts(jobs);
      await jobs.openSaveSearchDialog();
      await dialog.getByLabel('Name job search').fill(name);
      await save.click();
      const taken = dialog.getByText(/taken|already|exists|in use/i);
      await expect
        .poll(
          async () => !(await dialog.isVisible()) || (await taken.isVisible()),
          { message: 'saved (dialog closed) or refused with a message' },
        )
        .toBe(true);

      await dashboard.goto();
      await dashboard.open('Saved searches');
      const count = await twins().count();
      if (await dialog.isVisible()) {
        expect(count, 'refused: only the first is saved').toBe(1);
        return;
      }
      expect(count, 'both are saved').toBe(2);

      const opened = [await openTwin(0), await openTwin(1)];
      expect([...opened].sort(), 'each opens its own search').toEqual(
        [KEYWORD, 'welder'].sort(),
      );

      await test.step('remove the welder search', async () => {
        await dashboard.goto();
        await dashboard.open('Saved searches');
        const welder = twins().filter({
          has: page.locator('a:not(.remove-field-link)[href*="title=welder"]'),
        });
        await expect(welder).toHaveCount(1);
        const response = await dashboard.remove(welder);
        expect(response.ok()).toBe(true);

        await dashboard.goto();
        await dashboard.open('Saved searches');
        await expect(twins(), 'the nurse search is still listed').toHaveCount(
          1,
        );
        expect(await openTwin(0), 'and still opens "nurse"').toBe(KEYWORD);
      });
    } finally {
      await dashboard.cleanUp({ searches: [name] });
    }
  });

  test('SV-7: removing the right search when another tab changed the list', async ({
    page,
    context,
  }) => {
    const jobs = new JobSearchPage(page);
    const dashboard = new DashboardPage(page);
    const stamp = testName();
    const a = `${stamp} A`;
    const b = `${stamp} B`;
    const before = await expectSearchRoom(dashboard, 2);

    try {
      await jobs.search({ title: KEYWORD });
      await saveCurrentSearch(jobs, a);
      await saveCurrentSearch(jobs, b);

      const tab2 = await context.newPage();
      const dashboard2 = new DashboardPage(tab2);
      await dashboard.goto();
      await dashboard.open('Saved searches');
      await dashboard2.goto();
      await dashboard2.open('Saved searches');

      expect((await dashboard.remove(dashboard.savedSearch(a))).ok()).toBe(
        true,
      );
      expect((await dashboard2.remove(dashboard2.savedSearch(b))).ok()).toBe(
        true,
      );

      await dashboard.goto();
      const after = await dashboard.savedSearchNames();
      expect(after, 'A is gone').not.toContain(a);
      expect(after, 'B is gone').not.toContain(b);
      expect(
        [...after].sort(),
        'every search from before the case is still listed',
      ).toEqual([...before].sort());
    } finally {
      await dashboard.cleanUp({ searches: [a, b] });
    }
  });

  test('SV-8: room again after removing one', async ({ page }) => {
    test.setTimeout(180_000);
    const jobs = new JobSearchPage(page);
    const dashboard = new DashboardPage(page);
    const stamp = testName();
    const added: string[] = [];
    const before = await expectSearchRoom(dashboard, 1);
    const { dialog, limitWarning } = saveDialogParts(jobs);

    try {
      await jobs.search({ title: KEYWORD });
      for (let n = before.length + 1; n <= SEARCH_LIMIT; n++) {
        const name = `${stamp} ${n}`;
        added.push(name);
        await test.step(`save ${name}`, () => saveCurrentSearch(jobs, name));
      }

      await test.step('the dialog warns at the limit', async () => {
        await jobs.openSaveSearchDialog();
        await expect(limitWarning).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
      });

      await test.step('remove one this case added', async () => {
        await dashboard.goto();
        await dashboard.open('Saved searches');
        const response = await dashboard.remove(
          dashboard.savedSearch(added[added.length - 1]),
        );
        expect(response.ok()).toBe(true);
      });

      const extra = `${stamp} again`;
      added.push(extra);
      await test.step('room again: no warning, and it saves', async () => {
        await jobs.search({ title: KEYWORD });
        await jobs.openSaveSearchDialog();
        await expect(limitWarning).toHaveCount(0);
        await dialog.getByLabel('Name job search').fill(extra);
        await dialog.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(dialog).toBeHidden();
        await expect
          .poll(
            async () =>
              (await jobsForMeOptions(jobs, SAVED)).map((o) => o.text),
            { message: 'Jobs for me lists it without a reload' },
          )
          .toContain(extra);
      });
    } finally {
      await dashboard.cleanUp({ searches: added });
    }
  });

  test('SV-9: save a search with nothing searched', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    const dashboard = new DashboardPage(page);
    const name = testName();
    await expectSearchRoom(dashboard, 1);

    const formValues = async () => ({
      title: await jobs.keywordInput.inputValue(),
      location: await jobs.locationInput.inputValue(),
      radius: await jobs.distanceSelect.inputValue(),
      sort: await jobs.sortSelect.inputValue(),
      loc: await jobs.citySelect.inputValue(),
      company: await jobs.companySelect.inputValue(),
    });

    try {
      await page.goto('/job-search');
      await expect(jobs.cards.first()).toBeVisible();
      const plain = {
        values: await formValues(),
        ids: (await jobs.results()).items,
      };
      await saveCurrentSearch(jobs, name);

      await page.goto('/job-search');
      const option = (await jobsForMeOptions(jobs, SAVED)).find(
        (o) => o.text === name,
      );
      expect(option, `Jobs for me lists "${name}"`).toBeDefined();
      await pickJobsForMe(jobs, SAVED, option?.value ?? '');

      const set = [...jobs.params().entries()].filter(
        ([key, value]) => key !== 'delta' && value !== '',
      );
      expect(
        set,
        'no keyword, location, sort or filters in the address',
      ).toEqual([]);
      expect(
        await formValues(),
        'the form is as on a plain /job-search',
      ).toEqual(plain.values);
      await expect(jobs.cards.first(), 'jobs are listed').toBeVisible();
      expect(
        (await jobs.results()).items,
        'the same jobs as /job-search with nothing after it',
      ).toEqual(plain.ids);
    } finally {
      await dashboard.cleanUp({ searches: [name] });
    }
  });
});
