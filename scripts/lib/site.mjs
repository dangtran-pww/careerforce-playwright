// Shared by the scripts that talk to the site under test outside a test run
// (login-manual.mjs, open-browser.mjs, dashboard/server/index.mjs): which
// environment, how to get past QA's Basic Auth gate, and how to tell whether
// saved cookies are still logged in.
//
// Every function takes the environment (tests/helpers/environments.mts), so
// the dashboard can check QA, Stage and Production from one process. The
// default is the one BASE_URL points at.
import 'dotenv/config';
import { request } from '@playwright/test';
import {
  credentialsFor,
  currentEnv,
} from '../../tests/helpers/environments.mts';

export {
  authFile,
  credentialsFor,
  currentEnv,
  environmentById,
  environments,
  envFor,
  isActive,
  loginCommand,
} from '../../tests/helpers/environments.mts';

// The environment BASE_URL points at, for scripts that use only one.
export const defaultEnv = currentEnv();
export const baseURL = defaultEnv.baseURL;
export const siteHost = new URL(baseURL).hostname;
export const httpCredentials = credentialsFor(defaultEnv);

export const hostOf = (env) => new URL(env.baseURL).hostname;

// Playwright's request client doesn't read HTTPS_PROXY by itself.
export function proxyFromEnv() {
  const raw = process.env.HTTPS_PROXY ?? process.env.https_proxy;
  if (!raw) return undefined;
  const url = new URL(raw);
  return {
    server: `${url.protocol}//${url.host}`,
    username: decodeURIComponent(url.username) || undefined,
    password: decodeURIComponent(url.password) || undefined,
  };
}

// The env argument, or the default when called as an array callback
// (`cookies.filter(isSiteCookie)` passes the index second).
const envArg = (env) => (env && typeof env === 'object' ? env : defaultEnv);

// True for cookies the browser sends to the site: its own host and parent
// domains (e.g. .careerforce.link).
export const isSiteCookie = (cookie, env) =>
  hostOf(envArg(env)).endsWith(cookie.domain.replace(/^\./, ''));

// Drupal's session cookie (SSESS… on https, SESS… on http) for the site.
export const isDrupalSession = (cookie, env) =>
  /^S?SESS/.test(cookie.name) && isSiteCookie(cookie, envArg(env));

// A request context that sends these storageState cookies to the site.
export function siteRequest(storageState, env = defaultEnv) {
  return request.newContext({
    baseURL: env.baseURL,
    httpCredentials: credentialsFor(env),
    storageState,
    // A local DDEV site: reached directly, with DDEV's own certificate.
    proxy: env.local ? undefined : proxyFromEnv(),
    ignoreHTTPSErrors: !!env.local,
    timeout: 20_000,
  });
}

// Does the site accept this session, for any role? Having a session cookie
// isn't enough: when Drupal ends a session server-side (autologout after
// inactivity), the browser keeps the dead cookie. Drupal redirects /user to
// the user's own page when logged in, and to /user/login when not.
export async function sessionIsLoggedIn(storageState, env = defaultEnv) {
  const ctx = await siteRequest(storageState, env);
  try {
    const res = await ctx.get('/user', { maxRedirects: 0 });
    const location = res.headers().location ?? '';
    return (
      res.status() >= 300 &&
      res.status() < 400 &&
      !location.includes('/user/login')
    );
  } finally {
    await ctx.dispose();
  }
}
