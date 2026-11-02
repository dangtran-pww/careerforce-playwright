// Publishes a test report written by the /test-plan-report skill
// (reports/<plan>-<stamp>/report.md) to a Confluence page, for the
// /publish-report-confluence skill. Claude creates the page and prepares the
// upload token with the Atlassian MCP tools; this script does the parts that
// must not depend on hand-copying: uploading every screenshot, and turning
// the Markdown into Confluence HTML with every image in place.
//
//   node scripts/confluence-report.mjs check <report-dir>
//   CONFLUENCE_MEDIA_TOKEN=<token> \
//     node scripts/confluence-report.mjs upload <report-dir> <upload-url>
//   node scripts/confluence-report.mjs html <report-dir>
//
// check  lists the images report.md references and fails if a file is missing.
// upload posts each image to <upload-url> (from createConfluenceAttachment) and
//        records its media file ID in <report-dir>/confluence/media.json.
//        Images already recorded for the same upload URL are skipped, so a
//        run stopped by an expired token can be resumed with a new token.
// html   writes <report-dir>/confluence/body.html, title.txt, and
//        expected.json (the media file IDs the published page must contain).
//
// Confluence silently drops an image placed inside a list item, so html ends
// the list before each image, puts the image after it, and resumes the
// numbering with <ol start="N">.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [command, reportDir, uploadUrl] = process.argv.slice(2);
const USAGE = `Usage:
  node scripts/confluence-report.mjs check <report-dir>
  CONFLUENCE_MEDIA_TOKEN=<token> node scripts/confluence-report.mjs upload <report-dir> <upload-url>
  node scripts/confluence-report.mjs html <report-dir>`;
if (!reportDir || !['check', 'upload', 'html'].includes(command)) {
  console.error(USAGE);
  process.exit(1);
}

const reportFile = path.join(reportDir, 'report.md');
if (!existsSync(reportFile)) {
  console.error(`No report at ${reportFile}`);
  process.exit(1);
}
const markdown = readFileSync(reportFile, 'utf8');
const outDir = path.join(reportDir, 'confluence');
const mediaFile = path.join(outDir, 'media.json');

const IMAGE_LINE = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;
const MEDIA_TYPES = {
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
};

// Every image in report.md, in order, without duplicates. Images are always
// on a line of their own in these reports.
function reportImages() {
  const seen = new Set();
  for (const line of markdown.split('\n')) {
    const match = line.trim().match(IMAGE_LINE);
    if (match) seen.add(match[2]);
  }
  return [...seen];
}

// Attachment names must be unique on the page: screenshots/01-hp-1/01.jpeg
// becomes 01-hp-1-01.jpeg.
const attachmentName = (src) =>
  src.replace(/^screenshots\//, '').replaceAll('/', '-');

function readMedia() {
  return existsSync(mediaFile)
    ? JSON.parse(readFileSync(mediaFile, 'utf8'))
    : {};
}

const metaLine = (label) =>
  markdown
    .match(new RegExp(`\\*\\*${label}:\\*\\*\\s*([^·*\\n]+)`))?.[1]
    .trim();

// Confluence titles are unique per space, so the run date and environment
// keep reports of the same plan apart.
function pageTitle() {
  const heading =
    markdown.match(/^#\s+(.+)$/m)?.[1].trim() ?? path.basename(reportDir);
  const env = metaLine('Environment')
    ?.replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
  return [heading, metaLine('Date'), env && `(${env})`]
    .filter(Boolean)
    .join(' ');
}

function check() {
  const images = reportImages();
  const missing = images.filter(
    (src) => !existsSync(path.join(reportDir, src)),
  );
  for (const src of images)
    console.log(`${missing.includes(src) ? 'MISSING' : 'ok     '} ${src}`);
  console.log(`Title: ${pageTitle()}`);
  console.log(`${images.length} images referenced, ${missing.length} missing.`);
  if (missing.length) process.exit(1);
  return images;
}

async function upload() {
  const token = process.env.CONFLUENCE_MEDIA_TOKEN;
  if (!uploadUrl || !token) {
    console.error(USAGE);
    process.exit(1);
  }
  const images = check();
  mkdirSync(outDir, { recursive: true });
  const media = readMedia();
  let failed = 0;
  for (const src of images) {
    if (media[src]?.uploadUrl === uploadUrl) continue;
    const name = attachmentName(src);
    const type =
      MEDIA_TYPES[path.extname(src).toLowerCase()] ??
      'application/octet-stream';
    const form = new FormData();
    form.append(
      'file',
      new Blob([readFileSync(path.join(reportDir, src))], { type }),
      name,
    );
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      body: form,
    });
    const text = await response.text();
    if (response.status === 401 || response.status === 403) {
      writeFileSync(mediaFile, JSON.stringify(media, null, 2));
      console.error(
        `${name}: HTTP ${response.status}. The upload token has expired or is for another page. ` +
          'Prepare a new one and rerun upload; finished images are kept.',
      );
      process.exit(2);
    }
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = {};
    }
    if (!response.ok || !body.fileId) {
      failed++;
      console.error(
        `FAILED  ${name}: HTTP ${response.status} ${text.slice(0, 300)}`,
      );
      continue;
    }
    media[src] = {
      fileId: body.fileId,
      attachmentId: body.id,
      name,
      uploadUrl,
    };
    console.log(`uploaded ${name} -> ${body.fileId}`);
  }
  writeFileSync(mediaFile, JSON.stringify(media, null, 2));
  const done = images.filter(
    (src) => media[src]?.uploadUrl === uploadUrl,
  ).length;
  console.log(`${done} of ${images.length} images uploaded to this page.`);
  if (failed || done !== images.length) process.exit(1);
}

// ---- Markdown to Confluence HTML -------------------------------------------
// Covers what the reports use: headings, paragraphs, bold, inline code, links,
// tables, ordered and bullet lists (with paragraphs, images and nested lists
// inside items), images on their own line, code fences, and rules.

const escape = (text) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

function inline(text) {
  const codes = [];
  let out = text.replace(
    /`([^`]+)`/g,
    (_, code) => `\u0000${codes.push(code) - 1}\u0000`,
  );
  out = escape(out);
  // Only web links stay links. Report-relative links (the plan file) and
  // in-page anchors (#hp-1--…) mean nothing on Confluence, so keep the text.
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) =>
    /^https?:/.test(href) ? `<a href="${href}">${label}</a>` : label,
  );
  out = out.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>');
  // eslint-disable-next-line no-control-regex
  return out.replace(
    /\u0000(\d+)\u0000/g,
    (_, i) => `<code>${escape(codes[i])}</code>`,
  );
}

const STATUS = { Passed: 'green', Failed: 'red', Skipped: 'neutral' };
function cell(text) {
  const match = text.match(/^(?:✅|❌|⏭️)\s*(Passed|Failed|Skipped)$/u);
  return match
    ? `<span data-type="status" data-color="${STATUS[match[1]]}">${match[1]}</span>`
    : inline(text);
}

const indentOf = (line) => line.match(/^ */)[0].length;
const LIST_ITEM = /^(\d+)\.\s+|^[-*]\s+/;

// Parses lines (already dedented to this level) into blocks.
function parseBlocks(lines) {
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      i++;
    } else if (trimmed.startsWith('```')) {
      const code = [];
      for (i++; i < lines.length && !lines[i].trim().startsWith('```'); i++)
        code.push(lines[i]);
      i++;
      blocks.push({ type: 'code', text: code.join('\n') });
    } else if (/^#{1,6}\s/.test(trimmed)) {
      const [, hashes, text] = trimmed.match(/^(#+)\s+(.*)$/);
      blocks.push({ type: 'heading', level: hashes.length, text });
      i++;
    } else if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      blocks.push({ type: 'rule' });
      i++;
    } else if (IMAGE_LINE.test(trimmed)) {
      const [, alt, src] = trimmed.match(IMAGE_LINE);
      blocks.push({ type: 'image', alt, src });
      i++;
    } else if (trimmed.startsWith('|')) {
      const rows = [];
      for (; i < lines.length && lines[i].trim().startsWith('|'); i++)
        rows.push(lines[i].trim());
      const split = (row) =>
        row
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((c) => c.trim());
      blocks.push({
        type: 'table',
        header: split(rows[0]),
        rows: rows.slice(2).map(split),
      });
    } else if (LIST_ITEM.test(line)) {
      const ordered = /^\d+\./.test(line);
      const list = {
        type: ordered ? 'ol' : 'ul',
        start: ordered ? Number(line.match(/^\d+/)[0]) : 1,
        items: [],
      };
      while (
        i < lines.length &&
        LIST_ITEM.test(lines[i]) &&
        /^\d+\./.test(lines[i]) === ordered
      ) {
        const marker = lines[i].match(LIST_ITEM)[0];
        const body = [lines[i].slice(marker.length)];
        i++;
        // The item continues over blank lines and lines indented under it.
        while (i < lines.length) {
          if (!lines[i].trim()) {
            const next = lines.slice(i).find((l) => l.trim());
            if (!next || indentOf(next) < 2) break;
            body.push('');
          } else if (indentOf(lines[i]) >= 2) {
            body.push(lines[i].replace(/^ {2,4}/, ''));
          } else if (!LIST_ITEM.test(lines[i]) && body.at(-1) !== '') {
            body.push(lines[i]); // lazy continuation of the item's paragraph
          } else break;
          i++;
        }
        list.items.push(parseBlocks(body));
        while (i < lines.length && !lines[i].trim()) {
          const next = lines.slice(i).find((l) => l.trim());
          if (next && LIST_ITEM.test(next) && /^\d+\./.test(next) === ordered)
            i++;
          else break;
        }
      }
      blocks.push(list);
    } else {
      const para = [];
      for (; i < lines.length; i++) {
        const t = lines[i].trim();
        if (
          !t ||
          /^#{1,6}\s/.test(t) ||
          t.startsWith('|') ||
          t.startsWith('```') ||
          IMAGE_LINE.test(t) ||
          LIST_ITEM.test(lines[i])
        )
          break;
        para.push(t);
      }
      blocks.push({ type: 'para', lines: para });
    }
  }
  return blocks;
}

// A line that starts with a bold label ("**Page:** …") starts a new line in
// the rendered paragraph, as the reports lay out their metadata that way.
// The lines are joined before inline() so bold that wraps onto the next
// line still converts; a "**" that closes bold opened earlier is not a label.
const paragraph = (lines) => {
  let text = '';
  for (const line of lines) {
    const boldOpen = (text.match(/\*\*/g) ?? []).length % 2 === 1;
    if (text) text += line.startsWith('**') && !boldOpen ? '\n' : ' ';
    text += line;
  }
  return `<p>${inline(text).replaceAll('\n', '<br>')}</p>`;
};

function figure(block, media, used) {
  const entry = media[block.src];
  if (!entry)
    throw new Error(`No uploaded file for ${block.src}. Run upload first.`);
  used.push(entry.fileId);
  const collection = `contentId-${entry.uploadUrl.match(/content\/(\d+)\//)[1]}`;
  return (
    `<figure data-type="media-single" data-layout="center" data-width="60" data-width-type="percentage">` +
    `<div data-type="media" data-media-type="file" data-id="${entry.fileId}" data-collection="${collection}" data-alt="${escape(entry.name)}"></div>` +
    (block.alt ? `<figcaption>${inline(block.alt)}</figcaption>` : '') +
    `</figure>`
  );
}

// Renders blocks to chunks: { html } can sit inside a list item,
// { html, figure: true } must be at the top level of the page.
function render(blocks, media, used) {
  const chunks = [];
  for (const block of blocks) {
    switch (block.type) {
      case 'heading':
        chunks.push({
          html: `<h${block.level}>${inline(block.text)}</h${block.level}>`,
        });
        break;
      case 'para':
        chunks.push({ html: paragraph(block.lines) });
        break;
      case 'code':
        chunks.push({ html: `<pre><code>${escape(block.text)}</code></pre>` });
        break;
      case 'rule':
        chunks.push({ html: '<hr>' });
        break;
      case 'image':
        chunks.push({ html: figure(block, media, used), figure: true });
        break;
      case 'table':
        chunks.push({
          html:
            `<table><thead><tr>${block.header.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>` +
            block.rows
              .map(
                (r) =>
                  `<tr>${r.map((c) => `<td>${cell(c)}</td>`).join('')}</tr>`,
              )
              .join('') +
            `</tbody></table>`,
        });
        break;
      case 'ol':
      case 'ul':
        chunks.push(...renderList(block, media, used));
        break;
    }
  }
  return chunks;
}

function renderList(list, media, used) {
  const chunks = [];
  let items = [];
  let firstNumber = list.start;
  const flush = () => {
    if (!items.length) return;
    const start = list.type === 'ol' ? ` start="${firstNumber}"` : '';
    chunks.push({
      html: `<${list.type}${start}>${items.join('')}</${list.type}>`,
    });
    items = [];
  };
  list.items.forEach((itemBlocks, index) => {
    const number = list.start + index;
    if (!items.length) firstNumber = number;
    let parts = [];
    let afterFigure = false;
    for (const chunk of render(itemBlocks, media, used)) {
      if (chunk.figure) {
        if (parts.length) items.push(`<li>${parts.join('')}</li>`);
        parts = [];
        flush();
        chunks.push(chunk);
        afterFigure = true;
        firstNumber = number + 1;
      } else if (afterFigure) {
        chunks.push(chunk); // rest of an item after its image: keep it in order, unnumbered
      } else {
        parts.push(chunk.html);
      }
    }
    if (parts.length) items.push(`<li>${parts.join('')}</li>`);
  });
  flush();
  return chunks;
}

function html() {
  const images = reportImages();
  const media = readMedia();
  const missing = images.filter((src) => !media[src]);
  if (missing.length) {
    console.error(`Not uploaded yet: ${missing.join(', ')}. Run upload first.`);
    process.exit(1);
  }

  // The page title replaces the report's own heading.
  const blocks = parseBlocks(markdown.split('\n'));
  const h1 = blocks.findIndex((b) => b.type === 'heading' && b.level === 1);
  if (h1 >= 0) blocks.splice(h1, 1);

  // The metadata paragraph under the title becomes a coloured panel.
  const meta = blocks.find(
    (b) => b.type === 'para' && b.lines[0].startsWith('**Result:**'),
  );
  if (meta) {
    const passed = /\b0 failed\b/.test(meta.lines[0]);
    meta.type = 'panel';
    meta.html =
      `<div data-type="panel-${passed ? 'success' : 'error'}">` +
      meta.lines.map((l) => `<p>${inline(l)}</p>`).join('') +
      `</div>`;
  }

  const used = [];
  const body = blocks
    .flatMap((b) =>
      b.type === 'panel' ? [{ html: b.html }] : render([b], media, used),
    )
    .map((c) => c.html)
    .join('\n');

  const unused = images.filter((src) => !used.includes(media[src].fileId));
  if (unused.length || used.length < images.length) {
    console.error(`Images not placed in the page: ${unused.join(', ')}`);
    process.exit(1);
  }

  const title = pageTitle();
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'body.html'), body + '\n');
  writeFileSync(path.join(outDir, 'title.txt'), title + '\n');
  writeFileSync(
    path.join(outDir, 'expected.json'),
    JSON.stringify({ title, imageCount: used.length, fileIds: used }, null, 2),
  );
  console.log(`Title: ${title}`);
  console.log(
    `Wrote ${path.join(outDir, 'body.html')} (${body.length} chars) with ${used.length} images.`,
  );
}

if (command === 'check') check();
else if (command === 'upload') await upload();
else html();
