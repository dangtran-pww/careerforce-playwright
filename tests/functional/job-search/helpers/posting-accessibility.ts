import type { ElementHandle, Locator, Page } from '@playwright/test';

import { expect } from '../fixtures';
import { JobSearchPage } from '../../../pages/job-search.page';

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

// True when keyboard focus is on `element` (or inside it).
export function hasFocus(element: Locator): Promise<boolean> {
  return element.evaluate(
    (el) =>
      el === document.activeElement || el.contains(document.activeElement),
  );
}

// A short description of the focused element, for failure messages.
export function describeFocus(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return '<body> (nothing focused)';
    const id = el.id ? `#${el.id}` : '';
    const name =
      el.getAttribute('aria-label') ??
      el.getAttribute('name') ??
      (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
    return `<${el.tagName.toLowerCase()}${id}> "${name}"`;
  });
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

// The styles that show focus: outline, ring (box-shadow), border, and other
// visible changes such as a new background or underline.
// Waits for any CSS transition (e.g. on the outline) to finish first, so
// the look is read once it has settled.
export function focusStyle(element: Locator | ElementHandle): Promise<string> {
  const read = async (el: Element) => {
    await Promise.all(
      el
        .getAnimations({ subtree: true })
        .map((a) => a.finished.catch(() => undefined)),
    );
    const s = getComputedStyle(el);
    const outline =
      s.outlineStyle === 'none' || parseFloat(s.outlineWidth) === 0
        ? 'none'
        : `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`;
    // An icon button may draw its focus ring on ::before or ::after.
    const pseudo = (which: string) => {
      const p = getComputedStyle(el, which);
      if (p.content === 'none' || p.content === 'normal')
        return `${which}: none`;
      return `${which}: ${p.outlineStyle} ${p.outlineWidth} ${p.outlineColor} ${p.boxShadow} ${p.borderTopColor} ${p.backgroundColor} ${p.color} ${p.opacity}`;
    };
    return [
      pseudo('::before'),
      pseudo('::after'),
      `outline: ${outline}`,
      `box-shadow: ${s.boxShadow}`,
      `border: ${s.borderTopColor} ${s.borderTopWidth} ${s.borderBottomColor} ${s.borderBottomWidth}`,
      `background: ${s.backgroundColor}`,
      `color: ${s.color}`,
      `text-decoration: ${s.textDecorationLine}`,
      // A "skip" link that is moved on screen only when focused.
      `position: ${s.position} ${s.clip} ${s.clipPath} ${s.width} ${s.height}`,
    ].join('; ');
  };
  return (element as Locator).evaluate(read);
}

// Records each focus stop's look while focused, and checks it differs from
// its look once focus has left it. Purely keyboard: the check for a stop runs
// after the next key has moved focus on.
export class FocusVisibility {
  private readonly stops: Array<{
    handle: ElementHandle;
    name: string;
    focused: string;
  }> = [];

  constructor(private readonly page: Page) {}

  // Call while the element is focused (by the keyboard).
  async record(): Promise<string> {
    const handle = (await this.page.evaluateHandle(
      () => document.activeElement,
    )) as ElementHandle<Element>;
    const name = await describeFocus(this.page);
    this.stops.push({ handle, name, focused: await focusStyle(handle) });
    return name;
  }

  // Checks every recorded stop that focus has left. A stop that still has
  // focus is kept for a later call.
  async expectAllVisible(where: string) {
    for (const stop of this.stops.splice(0)) {
      if (await stop.handle.evaluate((el) => el === document.activeElement)) {
        this.stops.push(stop);
        continue;
      }
      const unfocused = await focusStyle(stop.handle);
      expect
        .soft(
          stop.focused,
          `${where}: focus should be visible on ${stop.name} (its outline, ring or look should change when focused)`,
        )
        .not.toBe(unfocused);
    }
  }
}

// Presses Tab until `target` has focus, at most `max` times. Fails with the
// stops it passed when it never gets there.
export async function tabTo(
  page: Page,
  target: Locator,
  what: string,
  max = 120,
) {
  const passed: string[] = [];
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    if (await hasFocus(target)) return passed;
    passed.push(await describeFocus(page));
  }
  throw new Error(
    `Tab never reached ${what} in ${max} presses. Last stops: ${passed.slice(-8).join(', ')}`,
  );
}

// The headings a screen reader finds, in page order (getByRole leaves out
// hidden ones but keeps visually hidden, screen-reader-only headings).
export async function headings(
  page: Page,
): Promise<Array<{ level: number; name: string }>> {
  return page.getByRole('heading').evaluateAll((els) =>
    els.map((el) => ({
      level: Number(el.getAttribute('aria-level') ?? el.tagName.slice(1)),
      name: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
    })),
  );
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
