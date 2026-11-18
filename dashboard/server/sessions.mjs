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
  ROLES,
  ROLE_DRUPAL_ROLES,
  ROLE_PROFILE_TYPES,
  ROLES_CHECKED_ON_ACCOUNT_SETTINGS,
  roleAvailableOn,
  siteRequest,
} from '../../scripts/lib/site.mjs';
import {
  accountInfo,
  accountRoles,
  ownRoles,
} from '../../scripts/lib/account.mjs';
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
  // when they can be read. For a role with a profile type, the answer turns
  // into no-access when the account has another one. `userPage` is where /user redirected to.
  const loggedIn = async (answer, userPage) => {
    let hit = infoCache.get(key);
    if (hit?.savedMs !== savedMs) {
      const info = await accountInfo(ctx, userPage);
      hit = { savedMs, ...info };
      if (info.email && info.profileTypeId !== undefined)
        infoCache.set(key, hit);
    }
    const { email, profileType, profileTypeId } = hit;
    // Jobseeker and partner sessions must belong to an account of that
    // profile type (drupalSettings.user.profile_type).
    const expected = ROLE_PROFILE_TYPES[role];
    if (expected && profileTypeId !== expected)
      answer =
        profileTypeId === undefined
          ? {
              status: 'error',
              message: `Logged in, but couldn't read the account's profile type to check it's ${roleName(role)}.`,
            }
          : {
              status: 'no-access',
              message: `Logged in, but this account's profile type is ${JSON.stringify(profileTypeId)}, not "${expected}", so it isn't ${roleName(role)}.`,
            };
    let roles = rolesCache.get(key);
    if (roles?.savedMs !== savedMs) {
      roles = ROLES_CHECKED_ON_ACCOUNT_SETTINGS.includes(role)
        ? await ownRoles(ctx, userPage)
        : email
          ? await accountRoles(email, role, env, ctx)
          : {
              detailsNote: `Couldn't read the account's email, so its roles are unknown.`,
            };
      if (roles.roles) rolesCache.set(key, { savedMs, ...roles });
    }
    // Manager sessions must belong to an account with that Drupal role:
    // checked on a platform manager's own account settings, and in the
    // People list with the admin or platform manager session for the others.
    const drupalRole = ROLE_DRUPAL_ROLES[role];
    if (drupalRole && answer.status === 'valid')
      answer = !roles.roles
        ? ROLES_CHECKED_ON_ACCOUNT_SETTINGS.includes(role)
          ? {
              // The account's own settings page didn't open or show its
              // roles. Why is in detailsNote, shown with the details.
              status: 'invalid',
              message: `Logged in, but this account doesn't have the ${drupalRole} role.`,
            }
          : {
              // No admin or platform manager login to read the People
              // list: the session may be fine, so it's only unchecked.
              status: 'error',
              message: `Logged in, but couldn't check that the account has the ${drupalRole} role: ${roles.detailsNote}`,
            }
        : roles.roles.includes(drupalRole)
          ? answer
          : {
              status: 'no-access',
              message: `Logged in, but this account doesn't have the ${drupalRole} role${roles.roles.length ? ` (it has: ${roles.roles.join(', ')})` : ''}.`,
            };
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

// What was last read for each saved session, by `${env}:${role}`, with the
// session file's mtime (savedMs): { savedMs, email, profileType }, and
// { savedMs, roles } (kept only when the roles lookup worked).
const infoCache = new Map();
const rolesCache = new Map();

// One check per role and environment at a time: a second request while one
// is running shares its answer instead of hitting the site again.
const checks = singleFlight();
export function checkSessionOnce(role, env) {
  return checks.run(`${env.id}:${role}`, () => checkSession(role, env));
}

// Every role the header's Logins menu lists for an environment: every role
// in ROLES, plus any other role a plan or suite prompt logs in as or with a
// saved session there (playwright/.auth/<env>/<role>.json), less any role
// that can't log in there (e.g. staff: local only). In ROLES order, then any
// others A–Z.
export async function knownRoles(env) {
  const roles = new Set(ROLES);
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
  const rank = (r) => {
    const i = ROLES.indexOf(r);
    return i < 0 ? ROLES.length : i;
  };
  return [...roles]
    .filter((r) => roleAvailableOn(r, env))
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}
