import { request, type APIRequestContext } from '@playwright/test';

// Reads emails from a public Mailinator inbox (<name>@mailinator.com), for
// tests that check an email the site sends. Public inboxes need no token,
// but anyone can read them, so only send synthetic test data there. A stand-in
// until the team has its own test mailbox.
//
// Uses its own request context, not the test's `request` fixture, so the
// site's Basic Auth credentials are never sent to Mailinator.

const API = 'https://www.mailinator.com/api/v2/domains/public/inboxes';

export type Email = {
  id: string;
  subject: string;
  from: string;
  /** The message body as Mailinator returns it (usually HTML). */
  html: string;
  /** The body with tags removed and whitespace collapsed. */
  text: string;
  /** Every link's href in the body. */
  links: string[];
};

type InboxMessage = { id: string; subject: string; from?: string };
type FullMessage = {
  subject?: string;
  from?: string;
  parts?: { headers?: Record<string, string>; body?: string }[];
  text?: string;
  body?: string;
};

/** A run-unique inbox name, e.g. `playwright-ext-pw20261117…`. */
export function inboxAddress(name: string): string {
  return `${name}@mailinator.com`;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Mailinator rate-limits public inboxes (429 Too Many Requests): wait as long
// as its Retry-After says (else 5s, 10s, 20s ...) and try again.
async function get(api: APIRequestContext, url: string) {
  let wait = 5_000;
  for (let attempt = 1; ; attempt++) {
    const response = await api.get(url);
    if (response.status() !== 429 || attempt === 5) return response;
    const retryAfter = Number(response.headers()['retry-after']);
    await sleep(retryAfter > 0 ? retryAfter * 1000 : wait);
    wait *= 2;
  }
}

async function inbox(api: APIRequestContext, name: string): Promise<InboxMessage[]> {
  const response = await get(api, `${API}/${encodeURIComponent(name)}`);
  if (!response.ok()) return [];
  const data = (await response.json()) as { msgs?: InboxMessage[] };
  return data.msgs ?? [];
}

function toText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    // A tag before punctuation ("<strong>name</strong>,") leaves a space.
    .replace(/ ([,.;:!?])/g, '$1')
    .trim();
}

/**
 * Waits for an email whose subject is `subject` in the public inbox `name`
 * (the part before @mailinator.com) and returns it. Fails with a clear
 * message when none arrives within `timeout`.
 */
export async function waitForEmail(
  name: string,
  subject: string,
  { timeout = 120_000, interval = 5_000 } = {},
): Promise<Email> {
  const api = await request.newContext();
  try {
    const deadline = Date.now() + timeout;
    let seen: string[] = [];
    for (;;) {
      const msgs = await inbox(api, name);
      seen = msgs.map((m) => m.subject);
      const match = msgs.find((m) => m.subject === subject);
      if (match) {
        const response = await get(
          api,
          `${API}/${encodeURIComponent(name)}/messages/${match.id}`,
        );
        if (!response.ok()) {
          throw new Error(
            `Mailinator listed "${subject}" in ${name} but opening it answered ${response.status()}.`,
          );
        }
        const full = (await response.json()) as FullMessage;
        const html =
          full.parts?.map((p) => p.body ?? '').join('\n') ||
          full.body ||
          full.text ||
          '';
        const links = Array.from(html.matchAll(/href\s*=\s*"([^"]+)"/gi), (m) =>
          m[1].replace(/&amp;/g, '&'),
        );
        return {
          id: match.id,
          subject: match.subject,
          from: full.from ?? match.from ?? '',
          html,
          text: toText(html),
          links,
        };
      }
      if (Date.now() > deadline) {
        throw new Error(
          `No email "${subject}" reached ${inboxAddress(name)} within ${timeout / 1000}s. ` +
            `Inbox has: ${seen.length ? seen.map((s) => `"${s}"`).join(', ') : 'nothing'}.`,
        );
      }
      await sleep(interval);
    }
  } finally {
    await api.dispose();
  }
}

/** How many emails with this subject the inbox holds right now. */
export async function countEmails(name: string, subject: string): Promise<number> {
  const api = await request.newContext();
  try {
    return (await inbox(api, name)).filter((m) => m.subject === subject).length;
  } finally {
    await api.dispose();
  }
}
