import type { Locator, Page } from '@playwright/test';

import { expect } from '../fixtures';
import { JobSearchPage } from '../../../pages/job-search.page';
import { hasFocus } from '../../../helpers/accessibility';

// The general keyboard helpers live in tests/helpers/accessibility.ts;
// re-exported here for the job-search specs.
export {
  FocusVisibility,
  describeFocus,
  focusStyle,
  hasFocus,
  headings,
  tabTo,
} from '../../../helpers/accessibility';

// Helpers for test-suites/job-search/functional-job-search-posting-accessibility.md
// (posting.spec.ts, responsive.spec.ts, accessibility.spec.ts).

export const KEYWORD = 'nurse';
export const NURSE_SEARCH = `/job-search?title=${KEYWORD}`;

// A job ID: 32 to 40 letters a–f and digits.
export const JOB_ID = /^[0-9a-f]{32,40}$/;

const clean = (text: string | null) => (text ?? '').replace(/\s+/g, ' ').trim();

export type JobSummary = {
  card: Locator;
  id: string;
  title: string;
  company: string;
  location: string;
  summary: string;
};

// The line under a job's title: the company, then the city.
export function cardLocation(card: Locator): Locator {
  return card.locator('div.tw-font-semibold > span').nth(1);
}

// The short description a list card shows.
export function cardSummary(card: Locator): Locator {
  return card.locator('.job-description__summary');
}

// Share is an icon button. Located by its class, not by its name: AX-5 is
// the case that checks the name.
export function shareButton(card: Locator): Locator {
  return card.locator('button.job-share');
}

// Each card has the apply link twice (wide screens and phones); this is the
// one the current screen shows.
export function visibleApplyLink(jobs: JobSearchPage, card: Locator): Locator {
  return jobs.applyLinks(card).filter({ visible: true }).first();
}

// Opens the "nurse" search and reads its first job. The jobs come from an
// outside feed, so no job is ever named in a test.
export async function openFirstNurseJob(page: Page): Promise<JobSummary> {
  const jobs = new JobSearchPage(page);
  await page.goto(NURSE_SEARCH);
  const card = jobs.cards.first();
  await expect(
    card,
    'the "nurse" search should list at least 1 job',
  ).toBeVisible();
  return {
    card,
    id: (await card.getAttribute('data-jvid')) ?? '',
    title: clean(await jobs.cardTitle(card).textContent()),
    company: clean(await jobs.cardCompany(card).textContent()),
    location: clean(await cardLocation(card).textContent()),
    summary: clean(await cardSummary(card).textContent()),
  };
}

// Does the page scroll sideways? Returns a message when it does.
export async function sideScroll(page: Page): Promise<string | undefined> {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const scrollWidth = document.documentElement.scrollWidth;
    if (scrollWidth <= width) return undefined;
    let widest: { el: Element; right: number } | undefined;
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      const right = el.getBoundingClientRect().right;
      if (right > width + 1 && (!widest || right > widest.right)) {
        widest = { el, right };
      }
    }
    const culprit = widest
      ? `<${widest.el.tagName.toLowerCase()}${widest.el.id ? `#${widest.el.id}` : ''}${Array.from(
          widest.el.classList,
        )
          .map((c) => `.${c}`)
          .join('')}> reaches ${Math.round(widest.right)}px`
      : 'unknown';
    return `content is ${scrollWidth}px wide on a ${width}px screen; widest element: ${culprit}`;
  });
}

export async function expectNoSideScroll(page: Page, where: string) {
  expect
    .soft(
      await sideScroll(page),
      `${where}: the page should not scroll sideways`,
    )
    .toBeUndefined();
}

// Every visible link, button and form field inside `scope` lies within the
// screen width: none is cut off at either side.
export async function expectFitsWidth(scope: Locator, where: string) {
  const cutOff = await scope.evaluateAll((roots) => {
    const width = document.documentElement.clientWidth;
    const out: string[] = [];
    for (const root of roots) {
      const controls = root.matches('a, button, input, select, textarea')
        ? [root]
        : Array.from(
            root.querySelectorAll(
              'a, button, input:not([type=hidden]), select, textarea',
            ),
          );
      for (const el of controls) {
        const box = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (
          box.width === 0 ||
          box.height === 0 ||
          style.visibility === 'hidden'
        )
          continue;
        if (box.left < -1 || box.right > width + 1) {
          const name = (el.textContent ?? '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 40);
          out.push(
            `<${el.tagName.toLowerCase()}> "${name || el.getAttribute('name') || ''}" spans ${Math.round(box.left)}–${Math.round(box.right)}px`,
          );
        }
      }
    }
    return out;
  });
  expect
    .soft(
      cutOff,
      `${where}: every link, button and field should fit the ${await scope.page().evaluate(() => document.documentElement.clientWidth)}px width`,
    )
    .toEqual([]);
}

// The login dialog's controls ("the login dialog" in the plan).
export function loginDialogControls(jobs: JobSearchPage) {
  const dialog = jobs.loginDialog;
  return {
    dialog,
    heading: dialog.getByRole('heading', {
      name: 'Create an account or log in to use this feature',
    }),
    login: dialog.getByRole('button', { name: 'Log In or Register' }),
    continueBrowsing: dialog.getByRole('link', { name: 'Continue Browsing' }),
    staffLogin: dialog.getByRole('link', {
      name: 'DEED staff and partners log in here.',
    }),
    close: dialog.getByRole('button', { name: 'Close' }),
  };
}

// Waits for the login dialog, then checks it is on top of the page and that
// keyboard focus moved into it.
export async function expectLoginDialogOpen(jobs: JobSearchPage, from: string) {
  const { dialog, heading, close } = loginDialogControls(jobs);
  await expect(dialog, `${from} should open the login dialog`).toBeVisible();
  await expect(heading).toBeVisible();
  await expect
    .poll(() => jobs.isOnTop(close), {
      message: `the login dialog from ${from} should be on top, not covered by another layer`,
    })
    .toBe(true);
  await expect
    .poll(() => hasFocus(dialog), {
      message: `opening the login dialog from ${from} should move keyboard focus into it`,
    })
    .toBe(true);
}

// After the dialog closes, focus goes back to the control that opened it.
export async function expectFocusBack(
  jobs: JobSearchPage,
  opener: Locator,
  name: string,
) {
  await expect(loginDialogControls(jobs).dialog).toBeHidden();
  await expect
    .poll(() => hasFocus(opener), {
      message: `closing the dialog should put focus back on ${name}`,
    })
    .toBe(true);
}
