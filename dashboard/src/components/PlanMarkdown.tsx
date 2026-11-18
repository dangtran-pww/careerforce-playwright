import { Marked } from 'marked';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type RefObject,
} from 'react';
import type { PlanMarkdownResponse } from '../api/types';
import { useApi } from '../hooks/useApi';
import { ErrorBox, Loading } from './Callouts';

// Headings get ids so the plan's own "#section" links work; they're
// prefixed so they can't clash with ids elsewhere on the page.
const ID_PREFIX = 'plan-md-';
const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

// For text put in the page as-is or inside an attribute: a quote in a
// link's title would otherwise end the attribute early, and a "<City>" in
// a plan would become a tag and vanish.
const escapeHtml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

// A plan's header lines ("Status: implemented", "Implemented test: …"):
// a paragraph whose every line starts with a short "Label: ".
const META_LINE = /^[A-Z][A-Za-z ]{0,30}: \S/;

// Case table columns and their share of the width. A table with a Steps,
// Expected result or Prompt column is a case table: fixed widths, so long
// addresses wrap instead of stretching the Page column, and a header that
// sticks while it scrolls. Other columns get UNKNOWN_COLUMN.
const COLUMN_WEIGHTS: Record<string, number> = {
  ID: 5,
  Test: 11,
  Title: 11,
  Page: 12,
  Persona: 10,
  Steps: 26,
  'Expected result': 26,
  Assertions: 26,
  Prompt: 40,
  Notes: 14,
  'Required login': 11,
  Prod: 10,
};
const UNKNOWN_COLUMN = 10;
const isCaseTable = (headers: string[]) =>
  headers.some((h) => ['Steps', 'Expected result', 'Prompt'].includes(h));

// Puts each numbered step of a table cell ("1. … 2. …", or "**1.** …"),
// and its "**Cleanup:**", on a line of its own. A number counts only in
// order from 1 and only when a 2 follows, so "Seats 10. Status" stays one
// sentence. Code spans are masked so nothing inside them splits.
const STEP = /(^|\s)(?:<strong>)?(\d{1,2})\.(?:<\/strong>)?(?=\s)/g;
const CLEANUP = /<strong>Cleanup:<\/strong>/g;
function splitSteps(html: string) {
  const masked = html.replace(/<code>[\s\S]*?<\/code>/g, (m) =>
    'x'.repeat(m.length),
  );
  const starts: number[] = [];
  let next = 1;
  for (const m of masked.matchAll(STEP)) {
    if (Number(m[2]) !== next) continue;
    starts.push(m.index + m[1].length);
    next++;
  }
  if (starts.length < 2) return html;
  for (const m of masked.matchAll(CLEANUP)) starts.push(m.index);
  const cuts = [...new Set([0, ...starts, html.length])].sort((a, b) => a - b);
  return cuts
    .slice(0, -1)
    .map((from, i) => html.slice(from, cuts[i + 1]).trim())
    .filter(Boolean)
    .map((line) => `<span class="cell-line">${line}</span>`)
    .join('');
}

const marked = new Marked({
  gfm: true,
  renderer: {
    // Raw HTML in a plan is shown as text: plans write placeholders like
    // <City> outside code, and none uses HTML on purpose.
    html({ text }) {
      return escapeHtml(text);
    },
    paragraph({ tokens, text }) {
      const html = this.parser.parseInline(tokens);
      const lines = text.split('\n');
      if (lines.length < 2 || !lines.every((l) => META_LINE.test(l)))
        return `<p>${html}</p>\n`;
      const rows = html.split('\n').map((line) => {
        const at = line.indexOf(': ');
        return `<dt>${line.slice(0, at)}</dt><dd>${line.slice(at + 2)}</dd>`;
      });
      return `<dl class="markdown-meta">${rows.join('')}</dl>\n`;
    },
    table(token) {
      const headers = token.header.map((c) => c.text.trim());
      const cells = (row: typeof token.header) =>
        this.tablerow({ text: row.map((c) => this.tablecell(c)).join('') });
      const body = token.rows.map(cells).join('');
      if (!isCaseTable(headers))
        return `<table>\n<thead>\n${cells(token.header)}</thead>\n<tbody>${body}</tbody></table>\n`;
      const weights = headers.map((h) => COLUMN_WEIGHTS[h] ?? UNKNOWN_COLUMN);
      const total = weights.reduce((a, b) => a + b, 0);
      const cols = weights
        .map((w) => `<col style="width:${((w / total) * 100).toFixed(2)}%">`)
        .join('');
      return `<table class="plan-cases">\n<colgroup>${cols}</colgroup>\n<thead>\n${cells(token.header)}</thead>\n<tbody>${body}</tbody></table>\n`;
    },
    tablecell(token) {
      const content = this.parser.parseInline(token.tokens);
      const type = token.header ? 'th' : 'td';
      const align = token.align ? ` align="${token.align}"` : '';
      const html = token.header ? content : splitSteps(content);
      return `<${type}${align}>${html}</${type}>\n`;
    },
    heading({ tokens, depth, text }) {
      // The plan's name is the modal's title, so its "# [Suite] - Name -
      // Test Plan" line would only repeat it.
      if (depth === 1) return '';
      const id = ID_PREFIX + slugify(text);
      return `<h${depth} id="${id}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
    },
    link({ href, title, tokens }) {
      const label = this.parser.parseInline(tokens);
      const t = title ? ` title="${escapeHtml(title)}"` : '';
      const url = escapeHtml(href);
      // In-page: scrolls to the prefixed heading (see onClick below; the
      // URL hash belongs to the router).
      if (href.startsWith('#'))
        return `<a href="${url}" data-heading="${escapeHtml(ID_PREFIX + href.slice(1))}"${t}>${label}</a>`;
      if (/^https?:/.test(href))
        return `<a href="${url}"${t} target="_blank" rel="noreferrer">${label}</a>`;
      // A repo file: PlanMarkdown makes it a dashboard link when it's a
      // plan or a suite (see repoLinks), and leaves the text otherwise.
      return `<span data-repo-link="${url}"${t}>${label}</span>`;
    },
  },
});

// Where a plan's link to another file in the repo goes in the dashboard:
// another plan opens on its suite's page with its full text showing, and a
// suite's folder or suite.md opens that suite. Anything else (README.md,
// prompts, specs) isn't served: null, and it stays text.
function dashboardLink(planFile: string, href: string): string | null {
  const parts = planFile.split('/').slice(0, -1);
  for (const seg of href.split('#')[0].split('/')) {
    if (seg === '..') parts.pop();
    else if (seg && seg !== '.') parts.push(seg);
  }
  if (parts[0] !== 'test-suites' || parts.length < 2 || parts.length > 3)
    return null;
  const suite = `#/suites/${encodeURIComponent(parts[1])}`;
  if (parts.length === 2 || parts[2] === 'suite.md') return suite;
  const plan = /^(.+)\.md$/.exec(parts[2])?.[1];
  return plan ? `${suite}?plan=${encodeURIComponent(plan)}&read=1` : null;
}

const REPO_LINK = /<span data-repo-link="([^"]*)"([^>]*)>([\s\S]*?)<\/span>/g;
const repoLinks = (html: string, planFile: string) =>
  html.replace(REPO_LINK, (_, href: string, attrs: string, label) => {
    const to = dashboardLink(planFile, toText(href));
    return to
      ? `<a href="${to}"${attrs}>${label}</a>`
      : `<span${attrs}>${label}</span>`;
  });

// The nearest ancestor that scrolls (the modal's body).
function scrollParent(el: HTMLElement | null) {
  for (let p = el?.parentElement; p; p = p.parentElement)
    if (/auto|scroll/.test(getComputedStyle(p).overflowY)) return p;
  return null;
}

// The "## " sections of a rendered plan, for its contents list.
const H2 = /<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g;
const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};
const toText = (html: string) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|#39);/g, (e) => ENTITIES[e]);
const sectionsOf = (html: string) =>
  [...html.matchAll(H2)].map((m) => ({ id: m[1], label: toText(m[2]) }));

// Fewer sections than this read fine without a contents list.
const MIN_SECTIONS = 3;

// A plan's whole Markdown file, rendered. Raw HTML in it shows as text;
// case tables get fixed column widths and a step per line (see above).
// Beside it, a contents list of the plan's sections stays in view and marks
// the one being read. `scrollMemory` keeps how far it was scrolled, so it
// opens again where the reader left it.
export function PlanMarkdown({
  slug,
  scrollMemory,
}: {
  slug: string;
  scrollMemory?: RefObject<number>;
}) {
  const { data, error } = useApi<PlanMarkdownResponse>(
    `/api/plans/${slug}/markdown`,
  );
  const html = useMemo(
    () =>
      data ? repoLinks(marked.parse(data.markdown) as string, data.file) : '',
    [data],
  );
  const sections = useMemo(() => sectionsOf(html), [html]);
  const showToc = sections.length >= MIN_SECTIONS;
  const docRef = useRef<HTMLDivElement>(null);
  const tocRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState<string | null>(null);

  // The section being read is the last one whose heading has scrolled up to
  // the top of the contents list (which sticks at the top of the scroll
  // area). Scroll events don't bubble, so listen in the capture phase.
  useEffect(() => {
    if (!showToc) return;
    const update = () => {
      const doc = docRef.current;
      const toc = tocRef.current;
      if (!doc || !toc) return;
      const line = toc.getBoundingClientRect().top + 24;
      // Above the first section (the plan's intro) none is marked.
      let current: string | null = null;
      for (const s of sections) {
        const h = doc.querySelector(`#${CSS.escape(s.id)}`);
        if (h && h.getBoundingClientRect().top <= line) current = s.id;
      }
      setActive(current);
    };
    update();
    document.addEventListener('scroll', update, true);
    return () => document.removeEventListener('scroll', update, true);
  }, [sections, showToc]);

  // Back to where it was last read, and remember where it is now.
  useEffect(() => {
    const scroller = scrollParent(docRef.current);
    if (!scroller || !scrollMemory || !html) return;
    scroller.scrollTop = scrollMemory.current;
    const save = () => (scrollMemory.current = scroller.scrollTop);
    scroller.addEventListener('scroll', save);
    return () => scroller.removeEventListener('scroll', save);
  }, [html, scrollMemory]);

  if (error) return <ErrorBox>{error.message}</ErrorBox>;
  if (!data) return <Loading />;
  // The dashboard routes on the URL hash, so in-page links (the plan's own
  // and the contents list's) scroll instead of changing it.
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const link = (e.target as Element).closest<HTMLElement>('a[data-heading]');
    if (!link) return;
    e.preventDefault();
    e.currentTarget
      .querySelector(`#${CSS.escape(link.dataset.heading ?? '')}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    // The clicks handled are on links, so keyboard users get them too.
    <div
      ref={docRef}
      className={showToc ? 'plan-doc' : undefined}
      onClick={onClick}
    >
      {showToc && (
        <nav ref={tocRef} className="plan-toc" aria-label="Plan sections">
          <ul>
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  data-heading={s.id}
                  aria-current={s.id === active ? 'location' : undefined}
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <div className="markdown" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
