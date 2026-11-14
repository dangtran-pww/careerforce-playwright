import AxeBuilder from '@axe-core/playwright';
import {
  expect,
  type ElementHandle,
  type Locator,
  type Page,
  type TestInfo,
} from '@playwright/test';

// Accessibility helpers for any page, logged in or not:
//
//   - scanPage / expectNoA11yViolations: an axe-core scan against the WCAG
//     2.0, 2.1 and 2.2 A and AA rules. A violation fails the test: there is
//     no list of rules or elements let through (tests report bugs).
//   - Keyboard helpers (hasFocus, describeFocus, tabTo, FocusVisibility,
//     headings) for cases that drive the page with the keyboard.
//
// For a logged-in page, call `useRole('<role>')` (tests/helpers/roles.ts)
// in the spec; the scan sees the page as that role does.

export const WCAG_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22aa',
];

export type ScanOptions = {
  // CSS selectors to scan; the whole page when left out.
  include?: string[];
  // CSS selectors to leave out, e.g. a third-party embed the site doesn't
  // control. Not for hiding the site's own bugs.
  exclude?: string[];
  tags?: string[];
};

export type AxeResults = Awaited<ReturnType<AxeBuilder['analyze']>>;
export type AxeViolation = AxeResults['violations'][number];

const IMPACT_ORDER = ['critical', 'serious', 'moderate', 'minor'];

function impactRank(v: AxeViolation): number {
  const i = IMPACT_ORDER.indexOf(v.impact ?? '');
  return i === -1 ? IMPACT_ORDER.length : i;
}

export async function scanPage(
  page: Page,
  { include, exclude, tags = WCAG_TAGS }: ScanOptions = {},
): Promise<AxeResults> {
  let builder = new AxeBuilder({ page }).withTags(tags);
  for (const selector of include ?? []) builder = builder.include(selector);
  for (const selector of exclude ?? []) builder = builder.exclude(selector);
  return builder.analyze();
}

// A violation as the dashboard stores it: the rule, how bad, what's wrong,
// a link on how to fix it, its WCAG tags, and the first 20 elements it was
// found on (`count` is all of them).
export type CompactViolation = {
  id: string;
  impact: string | null;
  help: string;
  helpUrl: string;
  tags: string[];
  count: number;
  nodes: { target: string; html: string; summary: string }[];
};

export function compactViolations(
  violations: AxeViolation[],
): CompactViolation[] {
  return violations.map((v) => ({
    id: v.id,
    impact: v.impact ?? null,
    help: v.help,
    helpUrl: v.helpUrl,
    tags: v.tags.filter((t) => t.startsWith('wcag')),
    count: v.nodes.length,
    nodes: v.nodes.slice(0, 20).map((n) => ({
      target: n.target.join(' '),
      html: n.html.slice(0, 300),
      summary: n.failureSummary ?? '',
    })),
  }));
}

// One line per violation, worst first: impact, rule, what's wrong, and the
// first few elements it was found on.
export function describeViolations(violations: AxeViolation[]): string {
  return [...violations]
    .sort((a, b) => impactRank(a) - impactRank(b))
    .map((v) => {
      const targets = v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(' '))
        .join(', ');
      const more = v.nodes.length > 3 ? ` (+${v.nodes.length - 3} more)` : '';
      return `[${v.impact ?? 'unknown'}] ${v.id}: ${v.help} — ${targets}${more}`;
    })
    .join('\n');
}

// Scans the page as it is now and fails (softly, so a test can scan several
// states) on any WCAG A/AA violation. The full axe result is attached to
// the test as `axe-results` (JSON), which the dashboard reads.
export async function expectNoA11yViolations(
  page: Page,
  testInfo: TestInfo,
  options: ScanOptions & { name?: string } = {},
): Promise<AxeResults> {
  const results = await scanPage(page, options);
  const where = options.name ?? new URL(page.url()).pathname;
  await testInfo.attach(`axe-results`, {
    body: JSON.stringify(
      {
        name: where,
        url: page.url(),
        violations: results.violations,
        incomplete: results.incomplete.length,
        passes: results.passes.length,
      },
      null,
      2,
    ),
    contentType: 'application/json',
  });
  expect
    .soft(
      results.violations.map((v) => v.id),
      `Accessibility violations on ${where} (WCAG A/AA):\n${describeViolations(results.violations)}`,
    )
    .toEqual([]);
  return results;
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
