// Serving files from disk: a run's report files and the built app.

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname } from 'node:path';
import { Readable } from 'node:stream';

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/vnd.microsoft.icon',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.log': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webm': 'video/webm',
  '.zip': 'application/zip',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

// "bytes=a-b", "bytes=a-" or "bytes=-n" → { start, end }, null for no (or an
// unsupported) Range, or false when it's past the end of the file.
function byteRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header ?? '');
  if (!m || (!m[1] && !m[2])) return null;
  let start;
  let end = size - 1;
  if (m[1]) {
    start = Number(m[1]);
    if (m[2]) end = Math.min(Number(m[2]), end);
  } else {
    start = Math.max(0, size - Number(m[2]));
  }
  return start <= end ? { start, end } : false;
}

/**
 * A response that streams a file, with Range support (the trace viewer and
 * <video> ask for parts of a file). Throws when the file can't be read, so
 * the caller can answer 404.
 */
export async function fileResponse(c, file) {
  const info = await stat(file);
  if (!info.isFile()) throw new Error(`Not a file: ${file}`);
  const range = byteRange(c.req.header('range'), info.size);
  if (range === false)
    return new Response(null, {
      status: 416,
      headers: { 'content-range': `bytes */${info.size}` },
    });
  const { start, end } = range ?? { start: 0, end: info.size - 1 };
  const headers = {
    'content-type': contentTypes[extname(file)] ?? 'application/octet-stream',
    'cache-control': 'no-store',
    'accept-ranges': 'bytes',
    'content-length': String(Math.max(0, end - start + 1)),
  };
  if (range) headers['content-range'] = `bytes ${start}-${end}/${info.size}`;
  // Hono answers HEAD with the GET route's headers and no body; opening the
  // file anyway would leave it open until the stream is collected.
  const body =
    c.req.method === 'HEAD' || info.size === 0
      ? null
      : Readable.toWeb(createReadStream(file, { start, end }));
  return new Response(body, { status: range ? 206 : 200, headers });
}
