// Summarises the accessibility scans (tests/accessibility) of the last
// run into one Markdown report: a row per page and device, the rules that
// fail most across the site, and the change since the previous summary.
//
// Each scan saves axe-results.json in its test's output folder (see
// tests/helpers/a11y.ts), so run the tests first, then this script:
//   BASE_URL=https://qa.careerforce.link npm run test:a11y
//   node scripts/a11y-summary.mjs [results-dir] [reports-dir]
//
// results-dir defaults to test-results/ (Playwright's output folder; pass the
// --output folder if the run used one). reports-dir defaults to reports/.
// Writes <reports-dir>/a11y-<YYYY-MM-DD-HHMM>/summary.md and summary.json.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [resultsDir = 'test-results', reportsDir = 'reports'] = process.argv.slice(2);
const IMPACTS = ['critical', 'serious', 'moderate', 'minor'];

function findScans(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true })
    .filter((f) => path.basename(String(f)) === 'axe-results.json')
    .map((f) => JSON.parse(readFileSync(path.join(dir, String(f)), 'utf8')));
}

const scans = findScans(resultsDir).sort(
  (a, b) =>
    a.test.localeCompare(b.test, 'en', { numeric: true }) || a.project.localeCompare(b.project),
);
if (scans.length === 0) {
  console.error(
    `No axe-results.json found under ${resultsDir}/. Run the accessibility tests first:\n` +
      '  BASE_URL=https://qa.careerforce.link npm run test:a11y',
  );
  process.exit(1);
}

// Short test name: "A11Y-1: Homepage has no new …" → "A11Y-1: Homepage".
const shortName = (scan) =>
  scan.test.split(' › ').pop().replace(/ has no .*$/, '');

function rowFor(scan) {
  const byImpact = Object.fromEntries(IMPACTS.map((i) => [i, 0]));
  for (const v of scan.violations) byImpact[v.impact ?? 'minor'] += 1;
  return {
    name: shortName(scan),
    project: scan.project,
    path: scan.path,
    ...byImpact,
    rules: scan.violations.length,
    elements: scan.violations.reduce((sum, v) => sum + v.nodes.length, 0),
  };
}

const rows = scans.map(rowFor);

// Rules across all scans: how many pages and elements each one hits.
const rules = new Map();
for (const scan of scans) {
  for (const v of scan.violations) {
    const rule = rules.get(v.rule) ?? {
      rule: v.rule,
      impact: v.impact,
      help: v.help,
      helpUrl: v.helpUrl,
      wcag: v.wcag,
      scans: 0,
      elements: 0,
    };
    rule.scans += 1;
    rule.elements += v.nodes.length;
    rules.set(v.rule, rule);
  }
}
const impactRank = (i) => (IMPACTS.indexOf(i) === -1 ? 9 : IMPACTS.indexOf(i));
const topRules = [...rules.values()].sort(
  (a, b) => impactRank(a.impact) - impactRank(b.impact) || b.scans - a.scans,
);

const totals = {
  scans: scans.length,
  cleanScans: rows.filter((r) => r.rules === 0).length,
  ...Object.fromEntries(IMPACTS.map((i) => [i, rows.reduce((s, r) => s + r[i], 0)])),
  rules: rules.size,
  elements: rows.reduce((s, r) => s + r.elements, 0),
};

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
const outDir = path.join(reportsDir, `a11y-${stamp}`);

// Previous summary (not this run's own folder), for the trend.
function previousSummary() {
  if (!existsSync(reportsDir)) return undefined;
  const dirs = readdirSync(reportsDir)
    .filter((d) => /^a11y-\d{4}-\d{2}-\d{2}-\d{4}$/.test(d) && d !== `a11y-${stamp}`)
    .filter((d) => existsSync(path.join(reportsDir, d, 'summary.json')))
    .sort();
  const last = dirs.at(-1);
  return last
    ? { dir: last, ...JSON.parse(readFileSync(path.join(reportsDir, last, 'summary.json'), 'utf8')) }
    : undefined;
}
const previous = previousSummary();

mkdirSync(outDir, { recursive: true });

const site = new URL(scans[0].url).origin;
const md = [];
const delta = (key) => {
  if (!previous) return '';
  const d = totals[key] - previous.totals[key];
  return d === 0 ? ' (no change)' : ` (${d > 0 ? '+' : ''}${d})`;
};

md.push(
  '# Accessibility report',
  '',
  `**Site:** ${site}  `,
  `**Scanned:** ${scans[0].scannedAt.slice(0, 16).replace('T', ' ')} UTC with axe-core ${scans[0].axeVersion}  `,
  '**Standard:** WCAG 2.2 level A and AA (automated rules only)',
  '',
  '## Summary',
  '',
  `- **${totals.cleanScans} of ${totals.scans}** scans had no violations${delta('cleanScans')}.`,
  `- **${totals.rules}** different WCAG rules failed${delta('rules')}, on **${totals.elements}** elements in all${delta('elements')}.`,
  `- By impact (rule failures summed over all scans): critical ${totals.critical}${delta('critical')}, serious ${totals.serious}${delta('serious')}, moderate ${totals.moderate}${delta('moderate')}, minor ${totals.minor}${delta('minor')}.`,
);
if (previous) md.push(`- Compared with the previous summary, \`reports/${previous.dir}\`.`);
md.push(
  '',
  'Automated checks find only part of WCAG problems (roughly a third). Keyboard use, ' +
    'focus order and screen reader wording still need a manual check.',
  '',
  '## By page',
  '',
  '| Page | Device | Critical | Serious | Moderate | Minor |',
  '|---|---|---|---|---|---|',
);
for (const r of rows) {
  const device = r.project.endsWith('-mobile') ? 'Phone' : 'Desktop';
  md.push(
    `| ${r.name} (\`${r.path}\`) | ${device} | ${r.critical} | ${r.serious} | ${r.moderate} | ${r.minor} |`,
  );
}
md.push('', 'Numbers are failing rules; one rule can cover many elements on the page.', '');

md.push('## Failing rules', '');
if (topRules.length === 0) {
  md.push('No rule failed on any page.');
} else {
  md.push(
    '| Rule | Impact | WCAG | Scans | Elements |',
    '|---|---|---|---|---|',
  );
  for (const r of topRules) {
    md.push(
      `| [${r.rule}](${r.helpUrl}): ${r.help} | ${r.impact ?? '?'} | ${r.wcag.join(', ')} | ${r.scans} | ${r.elements} |`,
    );
  }
}

md.push('', '## Details', '');
for (const scan of scans) {
  if (scan.violations.length === 0) continue;
  const device = scan.project.endsWith('-mobile') ? 'Phone' : 'Desktop';
  md.push(`### ${shortName(scan)}, ${device}`, '', `\`${scan.url}\``, '');
  for (const v of scan.violations) {
    md.push(`- **${v.rule}** [${v.impact ?? '?'}]: ${v.help}`);
    for (const n of v.nodes.slice(0, 3)) md.push(`  - \`${n.target.replace(/`/g, "'")}\``);
    if (v.nodes.length > 3) md.push(`  - … and ${v.nodes.length - 3} more`);
  }
  md.push('');
}

writeFileSync(path.join(outDir, 'summary.md'), md.join('\n'));
writeFileSync(
  path.join(outDir, 'summary.json'),
  JSON.stringify({ site, totals, rows, rules: topRules }, null, 2),
);
console.log(`Wrote ${outDir}/summary.md (${scans.length} scans, ${totals.rules} failing rules)`);
