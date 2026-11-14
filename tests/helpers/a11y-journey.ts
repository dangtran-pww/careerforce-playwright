import { createHash } from 'node:crypto';
import { appendFile, mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { BrowserContext, Page, TestInfo } from '@playwright/test';

import {
  compactViolations,
  scanPage,
  type CompactViolation,
} from './accessibility';

// Accessibility scans that follow a journey: while a test (or Claude, in the
// seed browser) moves through the site, every page it lands on and every
// dialog it opens is scanned with axe (WCAG 2.2 A/AA). Nobody has to list
// the pages, and pages behind IDs or only some users' logins are reached the
// way the journey reaches them.
//
// Off unless A11Y_JOURNEY=1 (the dashboard's "Scan pages for accessibility"
// sets it). The `a11yJourney` fixture in ./fixtures.ts starts it for every
// test. Scans never fail or slow down the test's own checks beyond the
// scan itself: they are reported next to the test's result
// (dashboard/server/runs/a11y-journey.mjs groups them by page pattern).
//
// Where the scans go:
//   - attached to the test as `a11y-journey` (JSON: an array of scans);
//   - and, when A11Y_JOURNEY_FILE is set (a Claude journey, where the seed
//     test never ends while Claude drives), appended to that file as JSON
//     lines as each one finishes.

export const journeyEnabled = () => process.env.A11Y_JOURNEY === '1';

export type JourneyScan = {
  pattern: string;
  url: string;
  title: string;
  dialog: string | null; // the open dialog's name, when a dialog was scanned
  layout: 'phone' | 'wide'; // under 768px wide, or not
  width: number; // the window's width in CSS pixels
  test: string;
  project: string;
  violations: CompactViolation[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The page's URL with its IDs taken out, so /user/123/edit and
// /user/456/edit are one page: path segments that are all digits, a UUID or
// a long hex ID (a job ID) become {id}. The query keeps its keys (sorted),
// not their values: /job-search?location&title.
export function pagePattern(url: string): string {
  const u = new URL(url);
  const path = u.pathname
    .split('/')
    .map((seg) =>
      /^\d+$/.test(seg) || UUID.test(seg) || /^[0-9a-f]{16,}$/i.test(seg)
        ? '{id}'
        : seg,
    )
    .join('/');
  const keys = [...new Set(u.searchParams.keys())].sort();
  return keys.length ? `${path}?${keys.join('&')}` : path;
}

// States already scanned (page pattern + dialog + phone or wide layout), so a long run scans each
// one once. With A11Y_JOURNEY_SEEN_DIR (the dashboard sets it to a folder of
// the run), each state is claimed by creating a file there, which holds
// across workers and the worker restarts that follow a failed test.
// Without it, only within this worker.
const scannedStates = new Set<string>();

function seenFile(state: string): string | null {
  const dir = process.env.A11Y_JOURNEY_SEEN_DIR;
  if (!dir) return null;
  return join(dir, createHash('sha1').update(state).digest('hex'));
}

// True when this call claimed the state (nobody scanned it yet).
async function claim(state: string): Promise<boolean> {
  if (scannedStates.has(state)) return false;
  scannedStates.add(state);
  const file = seenFile(state);
  if (!file) return true;
  try {
    await mkdir(join(file, '..'), { recursive: true });
    await writeFile(file, state, { flag: 'wx' });
    return true;
  } catch {
    return false; // another worker has it
  }
}

async function release(state: string) {
  scannedStates.delete(state);
  const file = seenFile(state);
  if (file) await unlink(file).catch(() => {});
}

// Set in every page before its scripts run: tells the scanner when a dialog
// becomes visible, by its accessible name (or "dialog").
const DIALOG_WATCH = `(() => {
  const seen = new WeakSet();
  const SELECTOR = '[role=dialog],[role=alertdialog],dialog[open],[aria-modal=true]';
  const visible = (el) => {
    const box = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return box.width > 0 && box.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const nameOf = (el) => {
    const label = el.getAttribute('aria-label');
    if (label) return label;
    const by = el.getAttribute('aria-labelledby');
    const ref = by && document.getElementById(by.split(' ')[0]);
    const heading = ref || el.querySelector('h1,h2,h3,h4');
    return ((heading && heading.textContent) || 'dialog').replace(/\\s+/g, ' ').trim().slice(0, 80);
  };
  // The visible dialog now, for the scanner's state key.
  window.__a11yOpenDialog = () => {
    const el = [...document.querySelectorAll(SELECTOR)].find(visible);
    return el ? nameOf(el) : null;
  };
  let timer = 0;
  const check = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      for (const el of document.querySelectorAll(SELECTOR)) {
        if (!visible(el)) { seen.delete(el); continue; }
        if (seen.has(el)) continue;
        seen.add(el);
        if (window.__a11yDialogOpened) window.__a11yDialogOpened(nameOf(el));
      }
    }, 400);
  };
  const start = () => new MutationObserver(check).observe(document.documentElement, {
    subtree: true, childList: true, attributes: true,
    attributeFilter: ['open', 'class', 'style', 'hidden', 'aria-hidden', 'aria-modal'],
  });
  if (document.documentElement) start();
  else document.addEventListener('DOMContentLoaded', start);
})();`;

// Actions that can change what the page shows. Before each, the scanner
// scans the page as it is now (if that state is new), so a test that moves
// on quickly still gets every state it saw scanned. Frame methods aren't
// wrapped: Page and Locator call them, so an action is wrapped once.
const ACTIONS: Record<string, string[]> = {
  page: [
    'goto',
    'reload',
    'goBack',
    'goForward',
    'close',
    'click',
    'dblclick',
    'tap',
    'fill',
    'press',
    'type',
    'check',
    'uncheck',
    'selectOption',
    'setInputFiles',
    'dragAndDrop',
  ],
  locator: [
    'click',
    'dblclick',
    'tap',
    'fill',
    'clear',
    'press',
    'pressSequentially',
    'type',
    'check',
    'uncheck',
    'setChecked',
    'selectOption',
    'setInputFiles',
    'dragTo',
  ],
  keyboard: ['press', 'type', 'insertText'],
  mouse: ['click', 'dblclick', 'down'],
};

const patched = new WeakSet<object>();

type AnyFn = (...args: unknown[]) => unknown;

function patch(
  proto: object,
  names: string[],
  pageOf: (self: object) => Page | undefined,
) {
  if (patched.has(proto)) return;
  patched.add(proto);
  const target = proto as Record<string, AnyFn>;
  for (const name of names) {
    const original = target[name];
    if (typeof original !== 'function') continue;
    target[name] = async function (this: object, ...args: unknown[]) {
      const page = pageOf(this);
      if (JourneyScanner.active && page)
        await JourneyScanner.active.beforeAction(page);
      return original.apply(this, args);
    };
  }
}

// Wraps the action methods of Page, Locator, Keyboard and Mouse (the
// classes aren't exported, so they are reached through a page).
function patchActions(page: Page) {
  const own = (o: object) => Object.getPrototypeOf(o) as object;
  patch(own(page), ACTIONS.page, (self) => self as Page);
  patch(own(page.locator('html')), ACTIONS.locator, (self) =>
    (self as { page(): Page }).page(),
  );
  const pageField = (self: object) => (self as { _page?: Page })._page;
  patch(own(page.keyboard), ACTIONS.keyboard, pageField);
  patch(own(page.mouse), ACTIONS.mouse, pageField);
}

export class JourneyScanner {
  // The scanner of the test running in this worker, if any.
  static active: JourneyScanner | null = null;
  readonly scans: JourneyScan[] = [];
  interrupted = 0;
  private queue: Promise<void> = Promise.resolve();
  private readonly timers = new Map<Page, ReturnType<typeof setTimeout>>();
  private stopped = false;
  private scanning = false;
  private readonly siteHost: string;

  constructor(
    private readonly context: BrowserContext,
    private readonly testInfo: TestInfo,
    baseURL: string,
  ) {
    this.siteHost = new URL(baseURL).host;
  }

  async start() {
    JourneyScanner.active = this;
    // A dialog opened: scan soon (Claude's journeys, whose clicks don't go
    // through this worker's Page objects).
    await this.context.exposeBinding('__a11yDialogOpened', ({ page }) =>
      this.soon(page),
    );
    await this.context.addInitScript(DIALOG_WATCH);
    for (const page of this.context.pages()) this.watch(page);
    this.context.on('page', (page) => this.watch(page));
  }

  private watch(page: Page) {
    patchActions(page);
    page.on('load', () => this.soon(page));
  }

  // After a load or a dialog, wait for redirects and late scripts to settle.
  private soon(page: Page) {
    clearTimeout(this.timers.get(page));
    this.timers.set(
      page,
      setTimeout(() => this.enqueue(page), 500),
    );
  }

  private enqueue(page: Page): Promise<void> {
    if (this.stopped) return this.queue;
    this.queue = this.queue.then(() => this.scan(page));
    return this.queue;
  }

  // Called before each action (see ACTIONS): scan what the page shows now.
  async beforeAction(page: Page) {
    if (this.scanning || this.stopped) return;
    clearTimeout(this.timers.get(page));
    await this.enqueue(page);
  }

  private async scan(page: Page) {
    if (page.isClosed()) return;
    const url = page.url();
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return;
    }
    // Only the site under test: not other sites a link leads to.
    if (parsed.host !== this.siteHost) return;
    this.scanning = true;
    let state = '';
    try {
      // The open dialog, and whether the page has its phone or wide
      // layout: the same page at another width is another state.
      const { dialog, width } = await page
        .evaluate(() => ({
          dialog:
            (
              window as unknown as { __a11yOpenDialog?: () => string | null }
            ).__a11yOpenDialog?.() ?? null,
          width: window.innerWidth,
        }))
        .catch(() => ({ dialog: null, width: 0 }));
      const layout = width && width < 768 ? 'phone' : 'wide';
      const pattern = pagePattern(url);
      state = `${pattern}#${dialog ?? ''}#${layout}`;
      if (!(await claim(state))) return;
      const results = await scanPage(page);
      // Moved on while scanning: what was scanned is unclear.
      if (page.url() !== url) throw new Error('navigated');
      const scan: JourneyScan = {
        pattern,
        url,
        title: await page.title(),
        dialog,
        layout,
        width,
        test: this.testInfo.titlePath.slice(1).join(' › '),
        project: this.testInfo.project.name,
        violations: compactViolations(results.violations),
      };
      this.scans.push(scan);
      const file = process.env.A11Y_JOURNEY_FILE;
      if (file) await appendFile(file, `${JSON.stringify(scan)}\n`);
    } catch {
      // The page navigated or closed mid-scan: try this state again later.
      if (state) await release(state);
      this.interrupted++;
    } finally {
      this.scanning = false;
    }
  }

  // At the end of the test: scan what each page shows now (if not scanned
  // yet), wait for the queue, then attach the scans.
  async finish() {
    for (const timer of this.timers.values()) clearTimeout(timer);
    for (const page of this.context.pages()) this.enqueue(page);
    this.stopped = true;
    if (JourneyScanner.active === this) JourneyScanner.active = null;
    await Promise.race([
      this.queue,
      new Promise((done) => setTimeout(done, 30_000)),
    ]);
    if (this.scans.length || this.interrupted)
      await this.testInfo.attach('a11y-journey', {
        body: JSON.stringify({
          scans: this.scans,
          interrupted: this.interrupted,
        }),
        contentType: 'application/json',
      });
  }
}
