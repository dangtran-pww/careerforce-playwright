// Saved login sessions: is the one for a role still logged in, and which
// roles the header's Logins menu lists.
//
// The session check asks the site, the same way useRole in
// tests/helpers/roles.ts does: request /admin/reports/status with the saved
// cookies and see whether Drupal sends us to /user/login. The cookie's expiry
// date alone isn't enough, because Drupal also ends sessions server-side
// (autologout after inactivity, or a login somewhere else).

import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  authFile as authFileFor,
  hostOf,
  isDrupalSession,
  loginCommand as loginCommandFor,
  siteRequest,
} from '../../scripts/lib/site.mjs';
import { loadPlans } from './catalog/plans.mjs';
import { loadSuites } from './catalog/suites.mjs';
import { singleFlight } from './lib/single-flight.mjs';

async function checkSession(role, env) {
  const baseURL = env.baseURL;
  const siteHost = hostOf(env);
  const authFile = authFileFor(role, env);
  const loginCommand = loginCommandFor(role, env);
  const result = {
    role,
    env: env.id,
    envName: env.name,
    baseURL,
    authFile,
    loginCommand,
    checkedAt: new Date().toISOString(),
    savedAt: null,
  };

  let state;
  let savedMs;
  try {
    const [text, info] = await Promise.all([
      readFile(authFile, 'utf8'),
      stat(authFile),
    ]);
    state = JSON.parse(text);
    result.savedAt = info.mtime.toISOString();
    savedMs = info.mtimeMs;
  } catch (err) {
    if (err.code === 'ENOENT') {
      return {
        ...result,
        status: 'missing',
        message: `No saved ${role} session.`,
      };
    }
    return {
      ...result,
      status: 'error',
      message: `Couldn't read ${authFile}: ${err.message}`,
    };
  }

  const cookie = (state.cookies ?? []).find((c) => isDrupalSession(c, env));
  if (!cookie) {
    return {
      ...result,
      status: 'expired',
      message: `The saved session has no login cookie for ${siteHost}.`,
    };
  }

  const started = Date.now();
  const ctx = await siteRequest(state, env);
  // The account behind a session file doesn't change until the file is
  // saved again, so its email is looked up once per save.
  const emailKey = `${env.id}:${role}`;
  const emailOf = async (userPage) => {
    const hit = emailCache.get(emailKey);
    if (hit?.savedMs === savedMs) return hit.email;
    const email = await accountEmail(ctx, userPage);
    if (email) emailCache.set(emailKey, { savedMs, email });
    return email;
  };
  try {
    // Other roles: Drupal sends a logged-in user from /user to their own
    // page, and a logged-out one to /user/login.
    if (role !== 'admin') {
      const res = await ctx.get('/user', { maxRedirects: 0 });
      result.httpStatus = res.status();
      result.durationMs = Date.now() - started;
      const location = res.headers().location ?? '';
      const redirected = res.status() >= 300 && res.status() < 400;
      if (redirected && !location.includes('/user/login'))
        return {
          ...result,
          status: 'valid',
          message: `Logged in as ${role}.`,
          email: await emailOf(location),
        };
      if (redirected || res.status() === 200)
        return {
          ...result,
          status: 'expired',
          message:
            'The site sent the saved session to the login page. It has expired or was logged out.',
        };
      return {
        ...result,
        status: 'error',
        message: `Unexpected answer from the site: HTTP ${res.status()}.`,
      };
    }
    const res = await ctx.get('/admin/reports/status', { maxRedirects: 0 });
    result.httpStatus = res.status();
    result.durationMs = Date.now() - started;
    const location = res.headers().location ?? '';

    if (
      res.status() >= 300 &&
      res.status() < 400 &&
      location.includes('/user/login')
    ) {
      return {
        ...result,
        status: 'expired',
        message:
          'The site sent the saved session to the login page. It has expired or was logged out.',
      };
    }
    if (res.status() === 403) {
      return {
        ...result,
        status: 'no-access',
        message: `Logged in, but this account can't open the status report, so it isn't an admin.`,
        email: await emailOf(),
      };
    }
    if (res.status() === 200 && (await res.text()).includes('Status report')) {
      return {
        ...result,
        status: 'valid',
        message: 'Logged in as an admin.',
        email: await emailOf(),
      };
    }
    return {
      ...result,
      status: 'error',
      message: `Unexpected answer from the site: HTTP ${res.status()}${location ? ` to ${location}` : ''}.`,
    };
  } catch (err) {
    result.durationMs = Date.now() - started;
    return {
      ...result,
      status: 'error',
      message: `Couldn't reach ${baseURL}: ${err.message.split('\n')[0]}`,
    };
  } finally {
    await ctx.dispose();
  }
}

// The email of the account a logged-in session belongs to, read from the
// Email block of its edit form (<user page>/edit). Users log in with
// their email, and it's also their display name. `userPage` is where /user
// redirected to, when already known. Undefined when it can't be read; that
// never changes the session's status.
async function accountEmail(ctx, userPage) {
  try {
    if (!userPage) {
      const res = await ctx.get('/user', { maxRedirects: 0 });
      userPage = res.headers().location;
      if (!userPage || userPage.includes('/user/login')) return undefined;
    }
    const path = new URL(userPage, 'http://site').pathname.replace(/\/$/, '');
    const res = await ctx.get(`${path}/edit`, { maxRedirects: 0 });
    if (res.status() !== 200) return undefined;
    const html = await res.text();
    // CareerForce shows the email as text with a "change email" link
    // (fam-operation-link--edit-email) instead of the core input. Only the
    // part of the page after that link is searched, so the lazy matches
    // can't backtrack over the whole page.
    const at = html.indexOf('fam-operation-link--edit-email');
    const shown =
      at < 0
        ? undefined
        : html
            .slice(at, at + EMAIL_WINDOW)
            .match(
              /<label[^>]*>[\s\S]*?<\/label>\s*<div>\s*([^<\s][^<]*?)\s*<\/div>/,
            )?.[1];
    // Core Drupal names the input "mail". LoginMN (SSO) accounts, such as
    // job seekers, get a disabled one named "email" on "My Profile".
    const input = html.match(/<input\b[^>]*\bname="e?mail"[^>]*>/);
    const value = shown ?? input?.[0].match(/\bvalue="([^"]*)"/)?.[1];
    return value ? decodeHtml(value) : undefined;
  } catch {
    return undefined;
  }
}

// How far past the "change email" link the email is looked for.
const EMAIL_WINDOW = 20_000;
// The email last read for each saved session: `${env}:${role}` →
// { savedMs: the session file's mtime, email }.
const emailCache = new Map();

// Enough HTML entity decoding for an attribute value that holds an email.
// An invalid code point throws a RangeError; accountEmail catches it.
function decodeHtml(text) {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16)),
    )
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

// One check per role and environment at a time: a second request while one
// is running shares its answer instead of hitting the site again.
const checks = singleFlight();
export function checkSessionOnce(role, env) {
  return checks.run(`${env.id}:${role}`, () => checkSession(role, env));
}

// Every role the header's Logins menu lists for an environment: admin, the
// roles any plan or suite prompt logs in as, and any role with a saved
// session there (playwright/.auth/<env>/<role>.json). Admin first, then A–Z.
export async function knownRoles(env) {
  const roles = new Set(['admin']);
  const [{ plans }, suites, saved] = await Promise.all([
    loadPlans(),
    loadSuites(),
    readdir(dirname(authFileFor('admin', env))).catch(() => []),
  ]);
  for (const p of plans) for (const r of p.roles) roles.add(r);
  for (const s of suites) for (const r of s.roles) roles.add(r);
  for (const name of saved) {
    const m = name.match(/^([a-z-]+)\.json$/);
    if (m) roles.add(m[1]);
  }
  const rest = [...roles].filter((r) => r !== 'admin').sort();
  return ['admin', ...rest];
}
