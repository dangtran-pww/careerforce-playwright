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
  // saved again, so its details are looked up once per save (roles: once
  // per save that the lookup worked for).
  const key = `${env.id}:${role}`;
  // A logged-in answer, with the account's email, profile type and roles
  // when they can be read. `userPage` is where /user redirected to.
  const loggedIn = async (answer, userPage) => {
    let hit = infoCache.get(key);
    if (hit?.savedMs !== savedMs) {
      const info = await accountInfo(ctx, userPage);
      hit = { savedMs, ...info };
      if (info.email) infoCache.set(key, hit);
    }
    const { email, profileType } = hit;
    let roles = rolesCache.get(key);
    if (roles?.savedMs !== savedMs) {
      roles = email
        ? await accountRoles(email, role, env, ctx)
        : {
            detailsNote: `Couldn't read the account's email, so its roles are unknown.`,
          };
      if (roles.roles) rolesCache.set(key, { savedMs, ...roles });
    }
    return {
      ...result,
      ...answer,
      email,
      profileType,
      roles: roles.roles,
      detailsNote: roles.detailsNote,
    };
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
        return await loggedIn(
          { status: 'valid', message: `Logged in as ${roleName(role)}.` },
          location,
        );
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
      return await loggedIn({
        status: 'no-access',
        message: `Logged in, but this account can't open the status report, so it isn't an admin.`,
      });
    }
    if (res.status() === 200 && (await res.text()).includes('Status report')) {
      return await loggedIn({
        status: 'valid',
        message: 'Logged in as an admin.',
      });
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

// A role id as it reads in a sentence, with its article:
// "jobseeker" → "a job seeker", "event-manager" → "an event manager".
function roleName(role) {
  const words = role === 'jobseeker' ? 'job seeker' : role.replace(/-/g, ' ');
  return `${/^[aeiou]/.test(words) ? 'an' : 'a'} ${words}`;
}

// The email and profile type of the account a logged-in session belongs
// to, read from its edit form (<user page>/edit). Users log in with their
// email, and it's also their display name. The profile type comes from
// drupalSettings.user.profile_type, which CareerForce adds to every page for
// the logged-in account. `userPage` is where /user redirected to, when
// already known. A field is undefined when it can't be read; that never
// changes the session's status.
async function accountInfo(ctx, userPage) {
  try {
    if (!userPage) {
      const res = await ctx.get('/user', { maxRedirects: 0 });
      userPage = res.headers().location;
      if (!userPage || userPage.includes('/user/login')) return {};
    }
    const path = new URL(userPage, 'http://site').pathname.replace(/\/$/, '');
    const res = await ctx.get(`${path}/edit`, { maxRedirects: 0 });
    if (res.status() !== 200) return {};
    const html = await res.text();
    return { email: accountEmail(html), profileType: profileType(html) };
  } catch {
    return {};
  }
}

function accountEmail(html) {
  try {
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

// "Job Seeker", "Partner" or "Staff" ('' for none), from the page's
// drupalSettings JSON ("user":{"profile_type":"career_seeker",...}).
function profileType(html) {
  const m = html.match(/"user":\{[^{}]*?"profile_type":(null|"([^"]*)")/);
  if (!m) return undefined;
  const id = m[2] ?? '';
  return PROFILE_TYPES[id] ?? id;
}

const PROFILE_TYPES = {
  career_seeker: 'Job Seeker',
  partner: 'Partner',
  staff: 'Staff',
};

// How far past the "change email" link the email is looked for.
const EMAIL_WINDOW = 20_000;
// What was last read for each saved session, by `${env}:${role}`, with the
// session file's mtime (savedMs): { savedMs, email, profileType }, and
// { savedMs, roles } (kept only when the roles lookup worked).
const infoCache = new Map();
const rolesCache = new Map();

// The account's roles, read from its row in the People list
// (/admin/people?user=<email>). An account can't see its own roles,
// and only staff can open that list, so the lookup uses the saved admin
// session for the same environment; the admin session's own context
// (`ctx`) when that's the one being checked.
//
// Returns { roles } with the names the site shows ([] for none), or
// { detailsNote } saying why they couldn't be read. Never throws.
async function accountRoles(email, role, env, ctx) {
  let adminCtx = role === 'admin' ? ctx : undefined;
  try {
    if (!adminCtx) {
      let state;
      try {
        state = JSON.parse(await readFile(authFileFor('admin', env), 'utf8'));
      } catch {
        return { detailsNote: NO_ADMIN_NOTE };
      }
      adminCtx = await siteRequest(state, env);
    }
    const res = await adminCtx.get(
      `/admin/people?user=${encodeURIComponent(email)}`,
      { maxRedirects: 0 },
    );
    if (res.status() !== 200)
      return {
        detailsNote: [301, 302, 303, 403].includes(res.status())
          ? NO_ADMIN_NOTE
          : `Couldn't read roles: the People list answered HTTP ${res.status()}.`,
      };
    const row = peopleRows(await res.text()).find(
      (cells) =>
        cells.name?.toLowerCase() === email.toLowerCase() ||
        cells.mail?.toLowerCase() === email.toLowerCase(),
    );
    if (!row)
      return {
        detailsNote: `${email} wasn't found in the People list, so its roles are unknown.`,
      };
    return { roles: row.roles };
  } catch {
    return { detailsNote: `Couldn't read the account's roles.` };
  } finally {
    if (adminCtx && adminCtx !== ctx) await adminCtx.dispose();
  }
}

const NO_ADMIN_NOTE =
  'Roles are read from the People list with the admin session, which is not logged in here. Log in as admin to see them.';

// The rows of the People list's table, each as { name, mail, roles }. Cells are found by their Views class (views-field-<field id>);
// roles are the items of the cell's list.
function peopleRows(html) {
  const body = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/)?.[1] ?? '';
  return body
    .split(/<tr\b/)
    .slice(1)
    .map((tr) => {
      const cells = {};
      for (const [, field, inner] of tr.matchAll(
        /<td\b[^>]*\bclass="[^"]*\bviews-field-([a-z0-9-]+)[^"]*"[^>]*>([\s\S]*?)<\/td>/g,
      ))
        cells[field] = inner;
      const items = (cells['roles-target-id'] ?? '')
        .split(/<li\b[^>]*>/)
        .slice(1)
        .map(cellText)
        .filter(Boolean);
      return {
        name: cells.name && cellText(cells.name),
        mail: cells.mail && cellText(cells.mail),
        roles:
          items.length || !cells['roles-target-id']
            ? items
            : cellText(cells['roles-target-id'])
                .split(/\s*,\s*/)
                .filter(Boolean),
      };
    });
}

// A table cell's text: tags dropped, entities decoded, spaces collapsed.
function cellText(html) {
  return decodeHtml(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

// Enough HTML entity decoding for an attribute value that holds an email.
// An invalid code point throws a RangeError; its callers catch it.
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
