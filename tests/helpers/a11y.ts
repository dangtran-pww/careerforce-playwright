import { writeFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';

// Automated accessibility scan with axe-core, against WCAG 2.2 level A and AA
// (which includes the 2.0 and 2.1 A/AA rules). axe finds roughly a third of
// WCAG problems; the rest (keyboard use, screen reader wording, focus order)
// still need a person. See test-plans/accessibility-public.md.
export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'];

// Content the site embeds but doesn't build, so a violation there can't be
// fixed in CareerForce's own code:
// - the Apple MapKit map on location pages,
// - Google reCAPTCHA (partner login form).
// Blocked tracking and WAF scripts (see fixtures.ts) never render anything.
const THIRD_PARTY = ['.js-mapkit-map', 'iframe[src*="recaptcha"]', '.grecaptcha-badge'];

type Impact = 'critical' | 'serious' | 'moderate' | 'minor';

export type A11yNode = { target: string; html: string };

export type A11yViolation = {
  rule: string;
  impact: Impact | null;
  help: string;
  helpUrl: string;
  wcag: string[];
  nodes: A11yNode[];
};

// What one scan found. Saved as axe-results.json in the test's output folder
// (test-results/<test>/) and attached to the test, for
// scripts/a11y-summary.mjs and the HTML report.
export type A11yScan = {
  test: string;
  project: string;
  url: string;
  path: string;
  scannedAt: string;
  axeVersion: string;
  passes: number;
  incomplete: number;
  violations: A11yViolation[];
};

export type ScanOptions = {
  // Scan only inside these selectors (default: the whole page).
  include?: string[];
  // Skip these selectors as well as the third-party ones above.
  exclude?: string[];
};

export async function scanPage(
  page: Page,
  testInfo: TestInfo,
  options: ScanOptions = {},
): Promise<A11yScan> {
  let builder = new AxeBuilder({ page }).withTags(WCAG_TAGS);
  for (const selector of options.include ?? []) builder = builder.include(selector);
  for (const selector of [...THIRD_PARTY, ...(options.exclude ?? [])]) {
    builder = builder.exclude(selector);
  }
  const results = await builder.analyze();

  const url = new URL(page.url());
  const path = url.pathname + url.search;
  const scan: A11yScan = {
    test: testInfo.titlePath.slice(1).join(' › '),
    project: testInfo.project.name,
    url: page.url(),
    path,
    scannedAt: results.timestamp,
    axeVersion: results.testEngine.version,
    passes: results.passes.length,
    incomplete: results.incomplete.length,
    violations: results.violations.map((v) => ({
      rule: v.id,
      impact: (v.impact ?? null) as Impact | null,
      help: v.help,
      helpUrl: v.helpUrl,
      wcag: v.tags.filter((t) => /^wcag\d/.test(t)),
      nodes: v.nodes.map((n) => ({ target: n.target.map(String).join(' '), html: n.html })),
    })),
  };

  const file = testInfo.outputPath('axe-results.json');
  await writeFile(file, JSON.stringify(scan, null, 2));
  await testInfo.attach('axe-results', { path: file, contentType: 'application/json' });
  return scan;
}

// A readable failure message: one block per rule, with up to 5 elements.
export function describeViolations(scan: A11yScan): string {
  const lines = [`Accessibility violations on ${scan.path} (${scan.project}):`];
  for (const v of scan.violations) {
    lines.push('', `[${v.impact ?? 'unknown'}] ${v.rule}: ${v.help}`, `  ${v.helpUrl}`);
    for (const n of v.nodes.slice(0, 5)) {
      lines.push(`  - ${n.target}`, `      ${n.html.slice(0, 160)}`);
    }
    if (v.nodes.length > 5) lines.push(`  … and ${v.nodes.length - 5} more`);
  }
  return lines.join('\n');
}
