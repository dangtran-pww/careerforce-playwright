import { Marked } from 'marked';
import { useMemo, type MouseEvent } from 'react';
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

const marked = new Marked({
  gfm: true,
  renderer: {
    heading({ tokens, depth, text }) {
      const id = ID_PREFIX + slugify(text);
      return `<h${depth} id="${id}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
    },
    link({ href, title, tokens }) {
      const label = this.parser.parseInline(tokens);
      const t = title ? ` title="${title}"` : '';
      // In-page: scrolls to the prefixed heading (see onClick below; the
      // URL hash belongs to the router).
      if (href.startsWith('#'))
        return `<a href="${href}" data-heading="${ID_PREFIX}${href.slice(1)}"${t}>${label}</a>`;
      if (/^https?:/.test(href))
        return `<a href="${href}"${t} target="_blank" rel="noreferrer">${label}</a>`;
      // Repo files (other plans, README.md, specs) aren't served: keep the text.
      return `<span${t}>${label}</span>`;
    },
  },
});

// A plan's whole Markdown file, rendered. The plans are this repo's own
// files, so their HTML is trusted.
export function PlanMarkdown({ slug }: { slug: string }) {
  const { data, error } = useApi<PlanMarkdownResponse>(
    `/api/plans/${slug}/markdown`,
  );
  const html = useMemo(
    () => (data ? (marked.parse(data.markdown) as string) : ''),
    [data],
  );

  if (error) return <ErrorBox>{error.message}</ErrorBox>;
  if (!data) return <Loading />;
  // The dashboard routes on the URL hash, so in-page links scroll instead
  // of changing it.
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
      className="markdown"
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
