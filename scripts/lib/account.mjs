// What can be read about the account behind a saved login session: its
// email and profile type (from its own edit form), its Drupal roles (from
// the People list) and, for staff and partners, its groups and primary
// locations (from the Staff & Partner search), the last two with the saved
// admin or platform manager session. Shared by the
// dashboard's Login Sessions check (dashboard/server/sessions.mjs) and
// useRole (tests/helpers/roles.ts).
//
// `ctx` is a request context with the session's cookies (siteRequest).

import { readFile } from 'node:fs/promises';
import { authFile as authFileFor, siteRequest } from './site.mjs';

// The email and profile type of the account a logged-in session belongs
// to, read from its edit form (<user page>/edit). Users log in with their
// email, and it's also their display name. The profile type comes from
// drupalSettings.user.profile_type, which CareerForce adds to every page for
// the logged-in account. `userPage` is where /user redirected to, when
// already known. A field is undefined when it can't be read. Only the
// profile type changes the session's status, for roles that need one.
export async function accountInfo(ctx, userPage) {
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
    const profileTypeId = profileTypeOf(html);
    return {
      email: accountEmail(html),
      profileTypeId,
      profileType:
        profileTypeId === undefined
          ? undefined
          : (PROFILE_TYPES[profileTypeId] ?? profileTypeId),
    };
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

// The profile type id ("career_seeker", "partner", "staff"; '' for none)
// from the page's drupalSettings JSON ("user":{"profile_type":"partner",...}).
function profileTypeOf(html) {
  const m = html.match(/"user":\{[^{}]*?"profile_type":(null|"([^"]*)")/);
  if (!m) return undefined;
  return m[2] ?? '';
}

// How each profile type id reads in the dashboard.
export const PROFILE_TYPES = {
  career_seeker: 'Job Seeker',
  partner: 'Partner',
  staff: 'Staff',
};

// How far past the "change email" link the email is looked for.
const EMAIL_WINDOW = 20_000;

// The roles whose saved sessions can open the People list and the Staff &
// Partner search, in the order they're tried.
export const PEOPLE_LIST_ROLES = ['admin', 'platform-manager'];

// Runs `read(viewerCtx)` with the first saved session of PEOPLE_LIST_ROLES
// for the same environment that can open `path` (an admin page), and returns
// what it returns, given the page's HTML. When the role being checked is one
// of them, its own context (`ctx`) is tried first. `what` names what is read,
// for the notes. Returns { detailsNote } when no session can open the page.
// Never throws.
async function withAdminPage(path, what, role, env, ctx, read) {
  const viewers = PEOPLE_LIST_ROLES.includes(role)
    ? [role, ...PEOPLE_LIST_ROLES.filter((r) => r !== role)]
    : PEOPLE_LIST_ROLES;
  for (const viewer of viewers) {
    let viewerCtx = viewer === role ? ctx : undefined;
    try {
      if (!viewerCtx) {
        let state;
        try {
          state = JSON.parse(await readFile(authFileFor(viewer, env), 'utf8'));
        } catch {
          continue; // no saved session for this one
        }
        viewerCtx = await siteRequest(state, env);
      }
      const res = await viewerCtx.get(path, { maxRedirects: 0 });
      // Logged out, or can't open the page: try the next session.
      if ((res.status() >= 300 && res.status() < 400) || res.status() === 403)
        continue;
      if (res.status() !== 200)
        return {
          detailsNote: `Couldn't read ${what}: ${path.split('?')[0]} answered HTTP ${res.status()}.`,
        };
      return read(await res.text());
    } catch {
      return { detailsNote: `Couldn't read ${what}.` };
    } finally {
      if (viewerCtx && viewerCtx !== ctx) await viewerCtx.dispose();
    }
  }
  return {
    detailsNote: `${capitalize(what)} are read with the admin or platform manager session, and neither is logged in here. Log in as one of them to see them.`,
  };
}

// The table row whose name or email cell is `email`, if any.
function rowFor(html, email) {
  return tableRows(html).find(
    (cells) =>
      cells.name?.toLowerCase() === email.toLowerCase() ||
      cells.mail?.toLowerCase() === email.toLowerCase(),
  );
}

// The account's roles, read from its row in the People list
// (/admin/people?user=<email>). Most accounts can't see their own roles,
// and only admins and platform managers can open that list, so the lookup
// uses their saved sessions (withAdminPage).
//
// Returns { roles } with the names the site shows ([] for none), or
// { detailsNote } saying why they couldn't be read. Never throws.
export function accountRoles(email, role, env, ctx) {
  return withAdminPage(
    `/admin/people?user=${encodeURIComponent(email)}`,
    'roles',
    role,
    env,
    ctx,
    (html) => {
      const row = rowFor(html, email);
      if (!row)
        return {
          detailsNote: `${email} wasn't found in the People list, so its roles are unknown.`,
        };
      return { roles: row.items['roles-target-id'] ?? [] };
    },
  );
}

// A staff or partner account's groups (Group/Organization) and primary
// locations, read from its row in the Staff & Partner search
// (/admin/people/search-users/partners-staff?k=<email>), which only admins,
// platform managers and account managers can open. Uses the admin or
// platform manager session like accountRoles.
//
// Returns { groups, locations } with the names the site shows ([] for
// none), or { detailsNote } saying why they couldn't be read. Never throws.
export function accountGroups(email, role, env, ctx) {
  return withAdminPage(
    `/admin/people/search-users/partners-staff?k=${encodeURIComponent(email)}`,
    'groups and locations',
    role,
    env,
    ctx,
    (html) => {
      const row = rowFor(html, email);
      if (!row)
        return {
          detailsNote: `${email} wasn't found in the Staff & Partner search, so its group and location are unknown.`,
        };
      return {
        groups: row.items['civiserv-provider'] ?? [],
        locations: row.items['civiserv-location__field-primary-location'] ?? [],
      };
    },
  );
}

const capitalize = (text) => text[0].toUpperCase() + text.slice(1);

// The rows of an admin Views table (the People list, the Staff & Partner
// search), each as { name, mail, items }. Cells are found by their Views
// class (views-field-<field id>, e.g. roles-target-id, civiserv-provider).
// `items` has each cell's values by field id: the items of its list, or the
// comma-separated parts of its text ([] when empty).
function tableRows(html) {
  const body = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/)?.[1] ?? '';
  return body
    .split(/<tr\b/)
    .slice(1)
    .map((tr) => {
      const cells = {};
      for (const [, field, inner] of tr.matchAll(
        /<td\b[^>]*\bclass="[^"]*\bviews-field-([a-z0-9_-]+)[^"]*"[^>]*>([\s\S]*?)<\/td>/g,
      ))
        cells[field] = inner;
      const items = {};
      for (const [field, inner] of Object.entries(cells)) {
        const listed = inner
          .split(/<li\b[^>]*>/)
          .slice(1)
          .map(cellText)
          .filter(Boolean);
        items[field] = listed.length
          ? listed
          : cellText(inner).split(/\s*,\s*/).filter(Boolean);
      }
      return {
        name: cells.name && cellText(cells.name),
        mail: cells.mail && cellText(cells.mail),
        items,
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

// The roles checked on the account's own settings form
// (/user/<uid>/account-settings), for accounts that can open it (platform
// managers; ROLES_CHECKED_ON_ACCOUNT_SETTINGS). The form shows them as
// CareerForce's "Roles" checkboxes (role_change[<machine name>], labelled
// with the role's name), not core's roles[...]. The uid comes from
// drupalSettings.user.uid on the account's page. `userPage` is where /user
// redirected to, when already known.
//
// Returns { roles } with the checked roles' labels, or { detailsNote } saying
// why they couldn't be read. Never throws.
export async function ownRoles(ctx, userPage = '/user') {
  try {
    const page = await ctx.get(userPage);
    const uid = (await page.text()).match(/"user":\{[^{}]*?"uid":"?(\d+)/)?.[1];
    if (!uid) return { detailsNote: `Couldn't read the account's user ID.` };
    const path = `/user/${uid}/account-settings`;
    const res = await ctx.get(path, { maxRedirects: 0 });
    if (res.status() !== 200)
      return {
        detailsNote: `${path} isn't available (HTTP ${res.status()}), so the account's roles can't be read.`,
      };
    const html = await res.text();
    const roles = [];
    for (const [input] of html.matchAll(
      /<input\b[^>]*\bname="role_change\[[^\]]+\]"[^>]*>/g,
    )) {
      if (!/\schecked\b/.test(input)) continue;
      const id = input.match(/\bid="([^"]+)"/)?.[1];
      const label = id
        ? html.match(
            new RegExp(
              `<label\\b[^>]*\\bfor="${id}"[^>]*>([\\s\\S]*?)</label>`,
            ),
          )?.[1]
        : undefined;
      if (label) roles.push(cellText(label));
    }
    return { roles };
  } catch {
    return { detailsNote: `Couldn't read the account's roles.` };
  }
}
