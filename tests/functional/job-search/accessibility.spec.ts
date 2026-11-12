import type { Page } from '@playwright/test';

import { test, expect } from './fixtures';
import { JobSearchPage } from '../../pages/job-search.page';
import {
  FocusVisibility,
  KEYWORD,
  NURSE_SEARCH,
  describeFocus,
  expectLoginDialogOpen,
  hasFocus,
  headings,
  loginDialogControls,
  openFirstNurseJob,
  shareButton,
  tabTo,
} from './helpers/posting-accessibility';

// spec: test-suites/job-search/functional-job-search-posting-accessibility.md ("Keyboard and accessibility", AX-1 to AX-6)
// seed: tests/seed.spec.ts
//
// AX-1 to AX-4 use only the keyboard (Tab, Shift+Tab, Enter, Space, Esc and
// the arrow keys), never a mouse click, and run on desktop only. "Focus is
// visible" compares the focused control's outline, ring, border, background
// and underline with its look once focus has left it. AX-5 and AX-6 read the
// accessibility tree and run on desktop and phone.

const PLACE = 'Saint Paul, MN';

test.describe('Keyboard', { tag: '@desktop-only' }, () => {
  test('AX-1: Search with the keyboard only', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    const focus = new FocusVisibility(page);
    await page.goto('/job-search');
    await expect(jobs.heading).toBeVisible();

    // From the top of the page: the first Tab stop is a "Skip to main content" link.
    await test.step('The first Tab stop skips to the main content.', async () => {
      await page.keyboard.press('Tab');
      const first = await focus.record();
      const skip = await page.evaluate(() => {
        const el = document.activeElement as HTMLAnchorElement | null;
        return {
          text: (el?.textContent ?? '').trim(),
          href: el?.getAttribute('href') ?? '',
        };
      });
      expect
        .soft(
          skip.text,
          `the first Tab stop should be "Skip to main content" (or similar), not ${first}`,
        )
        .toMatch(/skip to (main )?content|skip to main/i);
      expect
        .soft(skip.href, 'the skip link should point into the page')
        .toMatch(/^#\S+/);
    });

    // 1. Tab to Keyword and type "nurse".
    await test.step('1. Tab to Keyword and type "nurse".', async () => {
      await tabTo(page, jobs.keywordInput, 'Keyword');
      await focus.record();
      await page.keyboard.type(KEYWORD);
      await expect(jobs.keywordInput).toHaveValue(KEYWORD);
    });

    // 2. Tab to Location and type "Saint Paul, MN".
    await test.step('2. Tab to Location and type "Saint Paul, MN".', async () => {
      await page.keyboard.press('Tab');
      expect(
        await hasFocus(jobs.locationInput),
        `the stop after Keyword should be Location, not ${await describeFocus(page)}`,
      ).toBe(true);
      await focus.record();
      await page.keyboard.type(PLACE);
      await expect(jobs.locationInput).toHaveValue(PLACE);
    });

    // 3. Tab to Distance and pick "10 miles" with the arrow keys.
    await test.step('3. Tab to Distance and pick "10 miles" with the arrow keys.', async () => {
      // Only the Location suggestions may sit between Location and Distance.
      for (let i = 0; i < 12 && !(await hasFocus(jobs.distanceSelect)); i++) {
        await page.keyboard.press('Tab');
        if (await hasFocus(jobs.distanceSelect)) break;
        const inSuggestions = await page.evaluate(
          () =>
            !!document.activeElement?.closest(
              '#edit-location-text-listbox, [role="listbox"]',
            ),
        );
        expect(
          inSuggestions,
          `the stop after Location should be Distance (or a Location suggestion), not ${await describeFocus(page)}`,
        ).toBe(true);
      }
      expect(
        await hasFocus(jobs.distanceSelect),
        'Tab should reach Distance',
      ).toBe(true);
      await focus.record();
      await page.keyboard.press('ArrowUp');
      await expect(
        jobs.distanceSelect,
        'Up from "20 miles" should pick "10 miles"',
      ).toHaveValue('10');
    });

    // 4. Tab to "Search" and press Enter.
    await test.step('4. Tab to "Search" and press Enter.', async () => {
      await page.keyboard.press('Tab');
      expect(
        await hasFocus(jobs.searchButton),
        `the stop after Distance should be Search, not ${await describeFocus(page)}`,
      ).toBe(true);
      await focus.record();
      // Check focus was visible at every stop: Tab on, then back.
      await page.keyboard.press('Tab');
      await focus.expectAllVisible('AX-1');
      await page.keyboard.press('Shift+Tab');
      expect(
        await hasFocus(jobs.searchButton),
        'Shift+Tab should come back to Search',
      ).toBe(true);
      await page.keyboard.press('Enter');
      await jobs.waitForParams({ title: KEYWORD });
      expect(jobs.params().get('location[text]')).toBe(PLACE);
      expect(jobs.params().get('radius')).toBe('10');
      await expect(jobs.cards.first(), 'jobs are listed').toBeVisible();
    });
  });

  test('AX-2: Change the sort with the keyboard only', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    const focus = new FocusVisibility(page);
    await page.goto(NURSE_SEARCH);
    await expect(jobs.cards.first()).toBeVisible();
    let navigations = 0;
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) navigations++;
    });

    // 1. Tab to the Sort dropdown.
    await test.step('1. Tab to the Sort dropdown.', async () => {
      await tabTo(page, jobs.sortSelect, 'Sort');
      await focus.record();
      await page.keyboard.press('Tab');
      await focus.expectAllVisible('AX-2 Sort');
      await page.keyboard.press('Shift+Tab');
      expect(
        await hasFocus(jobs.sortSelect),
        'Shift+Tab should come back to Sort',
      ).toBe(true);
    });

    // 2. Choose "Job title": open with Alt+Down, move with the arrows, confirm with Enter.
    await test.step('2. Choose "Job title" with the keyboard.', async () => {
      const options = await jobs.sortSelect
        .locator('option')
        .evaluateAll((els) => els.map((el) => (el as HTMLOptionElement).value));
      const from = options.indexOf(await jobs.sortSelect.inputValue());
      const to = options.indexOf('job-title-asc');
      expect(to, 'Sort should offer "Job title"').toBeGreaterThanOrEqual(0);
      const start = page.url();
      await page.keyboard.press('Alt+ArrowDown');
      for (let i = from; i < to; i++) await page.keyboard.press('ArrowDown');
      expect(
        page.url(),
        'moving through the options should not reload the page',
      ).toBe(start);
      expect(
        navigations,
        'moving through the options should not reload the page',
      ).toBe(0);
      await page.keyboard.press('Enter');
      await jobs.waitForParams({ sort: 'job-title-asc' });
      await expect(jobs.sortSelect).toHaveValue('job-title-asc');
      await expect(jobs.sortSelect.locator('option:checked')).toHaveText(
        /^Job title/i,
      );
    });
  });

  test('AX-3: Open and close the login dialog with the keyboard only', async ({
    page,
  }) => {
    const jobs = new JobSearchPage(page);
    const job = await openFirstNurseJob(page);
    const bookmark = jobs.bookmarkLink(job.card);
    const { dialog, close } = loginDialogControls(jobs);

    // Tab round the dialog: every stop inside it, with visible focus, until
    // focus is back where it started.
    const tabRound = async () => {
      const focus = new FocusVisibility(page);
      const start = await focus.record();
      const startHandle = await page.evaluateHandle(
        () => document.activeElement,
      );
      for (let i = 0; i < 15; i++) {
        await page.keyboard.press('Tab');
        expect(
          await hasFocus(dialog),
          `Tab should stay inside the dialog, not go to ${await describeFocus(page)}`,
        ).toBe(true);
        if (
          await page.evaluate(
            (el) => el === document.activeElement,
            startHandle,
          )
        ) {
          // Back at the start: check every stop focus has left, then step
          // off the start to check it too, and come back.
          await focus.expectAllVisible('the login dialog');
          await page.keyboard.press('Tab');
          await focus.expectAllVisible('the login dialog');
          await page.keyboard.press('Shift+Tab');
          return;
        }
        await focus.record();
      }
      throw new Error(`Tab never came back to ${start} inside the dialog`);
    };

    const expectFocusOnBookmark = async () => {
      await expect(dialog, 'the dialog should close').toBeHidden();
      await expect
        .poll(() => hasFocus(bookmark), {
          message: 'focus should go back to the bookmark icon',
        })
        .toBe(true);
    };

    // 1. Tab to the first job's bookmark icon and press Enter.
    await test.step("1. Tab to the first job's bookmark icon and press Enter.", async () => {
      await tabTo(page, bookmark, "the first job's bookmark icon", 200);
      await page.keyboard.press('Enter');
      await expectLoginDialogOpen(jobs, 'Enter on the bookmark icon');
    });

    // 2. Tab through the dialog until focus comes back to where it started.
    await test.step(
      '2. Tab through the dialog until focus comes back to where it started.',
      tabRound,
    );

    // 3. Press Esc.
    await test.step('3. Press Esc.', async () => {
      await page.keyboard.press('Escape');
      await expectFocusOnBookmark();
    });

    // 4. Do the same with Space instead of Enter.
    await test.step('4. Press Space on the bookmark icon.', async () => {
      expect(
        await hasFocus(bookmark),
        'focus should still be on the bookmark icon',
      ).toBe(true);
      await page.keyboard.press('Space');
      await expect
        .soft(dialog, 'Space on the bookmark icon should open the dialog')
        .toBeVisible();
      // So the close button is still checked when Space did nothing.
      if (!(await dialog.isVisible())) {
        await bookmark.focus();
        await page.keyboard.press('Enter');
      }
      await expectLoginDialogOpen(jobs, 'the bookmark icon');
      await tabRound();
    });

    // 5. Close with the dialog's close button (Tab to it, press Enter).
    await test.step('5. Tab to the close button and press Enter.', async () => {
      for (let i = 0; i < 15 && !(await hasFocus(close)); i++) {
        await page.keyboard.press('Tab');
      }
      expect(
        await hasFocus(close),
        "Tab should reach the dialog's close button",
      ).toBe(true);
      await page.keyboard.press('Enter');
      await expectFocusOnBookmark();
    });
  });

  test('AX-4: Pick a location suggestion with the keyboard', async ({
    page,
  }) => {
    const jobs = new JobSearchPage(page);
    await page.goto('/job-search');
    await expect(jobs.heading).toBeVisible();
    const start = page.url();

    // 1. Tab to Location and type "Roch".
    await test.step('1. Tab to Location and type "Roch".', async () => {
      await tabTo(page, jobs.locationInput, 'Location');
      await page.keyboard.type('Roch');
      await expect(
        jobs.locationSuggestions.first(),
        'the suggestions should open',
      ).toBeVisible();
    });

    // 2. Press Down until "Rochester, MN" is highlighted.
    await test.step('2. Press Down until "Rochester, MN" is highlighted.', async () => {
      const highlighted = () =>
        page.evaluate(() => {
          const box = document.querySelector('input[name="location[text]"]');
          const id = box?.getAttribute('aria-activedescendant');
          const option = id
            ? document.getElementById(id)
            : document.activeElement?.closest('[role="option"]');
          return {
            id: id ?? '',
            text: (option?.textContent ?? '').replace(/\s+/g, ' ').trim(),
          };
        });
      const seen: string[] = [];
      let previous = '';
      const count = await jobs.locationSuggestions.count();
      for (let i = 0; i < count; i++) {
        await page.keyboard.press('ArrowDown');
        const now = await highlighted();
        expect
          .soft(
            now.text,
            'screen readers should be told which suggestion is highlighted',
          )
          .not.toBe('');
        seen.push(now.text);
        if (now.text === 'Rochester, MN') break;
        expect(
          now.id + now.text,
          `Down should move the highlight on (it stayed on "${now.text}")`,
        ).not.toBe(previous);
        previous = now.id + now.text;
      }
      expect(
        seen.at(-1),
        `Down should reach "Rochester, MN" (highlighted: ${seen.join(' → ')})`,
      ).toBe('Rochester, MN');
    });

    // 3. Press Enter.
    await test.step('3. Press Enter.', async () => {
      await page.keyboard.press('Enter');
      await expect(
        jobs.locationInput,
        'Enter should put "Rochester, MN" in the box',
      ).toHaveValue('Rochester, MN');
      await expect(
        jobs.locationSuggestions.first(),
        'the list should close',
      ).toBeHidden();
      expect(page.url(), 'Enter should not run the search').toBe(start);
    });
  });
});

// AX-5 and AX-6 read the search page, then the first job on its own.
async function eachPage(page: Page, check: (where: string) => Promise<void>) {
  const jobs = new JobSearchPage(page);
  const job = await openFirstNurseJob(page);
  const href = (await jobs.readMoreLink(job.card).getAttribute('href')) ?? '';
  await test.step(`${NURSE_SEARCH}`, () => check(NURSE_SEARCH));
  await page.goto(href);
  await expect(jobs.cards).toHaveCount(1);
  await test.step('the first job on its own', () =>
    check('the job on its own'));
}

test.describe('Accessibility tree', () => {
  test('AX-5: Every control has a name', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    await eachPage(page, async (where) => {
      const main = page.getByRole('main');
      // Every text box, dropdown, button and link in main has a name.
      const tree = await main.ariaSnapshot();
      const unnamed = tree
        .split('\n')
        .filter(
          (line) =>
            /^\s*- (link|button|textbox|combobox|searchbox|listbox|checkbox|radio|spinbutton)(\s*\[[^\]]*\])?\s*:?\s*$/.test(
              line,
            ) ||
            /^\s*- (link|button|textbox|combobox|searchbox|listbox|checkbox|radio|spinbutton) "[\s\p{S}\p{P}]*"/u.test(
              line,
            ),
        )
        .map((line) => line.trim());
      expect
        .soft(unnamed, `${where}: every control should have a name`)
        .toEqual([]);

      // Every visible dropdown and text box has a label, not only a hint.
      const unlabelled = await main
        .locator(
          'input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea',
        )
        .filter({ visible: true })
        .evaluateAll((els) =>
          els
            .filter((el) => {
              const field = el as HTMLInputElement;
              const byLabel = Array.from(field.labels ?? []).some((l) =>
                l.textContent?.trim(),
              );
              const byAria =
                !!field.getAttribute('aria-label')?.trim() ||
                (field.getAttribute('aria-labelledby') ?? '')
                  .split(/\s+/)
                  .some((id) =>
                    document.getElementById(id)?.textContent?.trim(),
                  );
              return !byLabel && !byAria;
            })
            .map(
              (el) =>
                `<${el.tagName.toLowerCase()} name="${el.getAttribute('name')}">`,
            ),
        );
      expect
        .soft(
          unlabelled,
          `${where}: every dropdown and text box should have a label`,
        )
        .toEqual([]);

      // The icon controls are named for what they do.
      const card = jobs.cards.first();
      await expect
        .soft(jobs.bookmarkLink(card), `${where}: the bookmark icon's name`)
        .toHaveAccessibleName(/bookmark/i);
      await expect
        .soft(shareButton(card), `${where}: the Share icon's name`)
        .toHaveAccessibleName(/share/i);
    });
  });

  test('AX-6: Headings', async ({ page }) => {
    const jobs = new JobSearchPage(page);
    await eachPage(page, async (where) => {
      const list = await headings(page);
      const outline = list.map((h) => `h${h.level} ${h.name}`).join(' | ');

      // Exactly one level-1 heading, "Job Search".
      expect
        .soft(
          list.filter((h) => h.level === 1).map((h) => h.name),
          `${where}: exactly one level-1 heading, "Job Search" (${outline})`,
        )
        .toEqual(['Job Search']);

      // Each job's title is a heading, all at the same level, below level 1.
      const levels = await jobs.cards.evaluateAll((cards) =>
        cards.map((card) => {
          const title = card.querySelector('[id$="-title"]');
          if (!title) return 0;
          const role = title.getAttribute('role');
          if (/^H[1-6]$/.test(title.tagName))
            return Number(
              title.getAttribute('aria-level') ?? title.tagName.slice(1),
            );
          return role === 'heading'
            ? Number(title.getAttribute('aria-level') ?? 2)
            : 0;
        }),
      );
      expect(levels.length, `${where}: at least one job`).toBeGreaterThan(0);
      expect
        .soft(
          levels.filter((l) => l === 0),
          `${where}: every job title should be a heading`,
        )
        .toEqual([]);
      expect
        .soft(
          new Set(levels).size,
          `${where}: all job titles at the same level (${levels.join(', ')})`,
        )
        .toBe(1);
      expect
        .soft(Math.min(...levels), `${where}: job titles below level 1`)
        .toBeGreaterThan(1);

      // No level skipped on the way down.
      const skips = list
        .map((h, i) => ({ h, prev: list[i - 1] }))
        .filter(({ h, prev }) => prev && h.level > prev.level + 1)
        .map(
          ({ h, prev }) =>
            `h${prev.level} "${prev.name}" → h${h.level} "${h.name}"`,
        );
      expect
        .soft(skips, `${where}: no heading level should be skipped`)
        .toEqual([]);

      // Jobs for me, Services and Resources have their own headings.
      for (const block of [/^Jobs for me$/i, /^Services$/i, /^Resources$/i]) {
        expect
          .soft(
            list.some((h) => block.test(h.name)),
            `${where}: a heading for ${block.source.replace(/[$^]/g, '')}`,
          )
          .toBe(true);
      }
    });
  });
});
