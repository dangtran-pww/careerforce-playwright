// The environments the tests can run against, and what differs between them.
// One list, shared by:
//   - playwright.config.ts and the specs (which login file to use);
//   - scripts/login-manual.mjs and scripts/open-browser.mjs;
//   - the dashboard (dashboard/server/), which
//     lets you pick the environment and sets BASE_URL for the run.
// (Node runs this .mts file directly, like blocked-hosts.mts.)
//
// The test runner still takes the site from BASE_URL. The environment is
// worked out from BASE_URL's hostname, so `BASE_URL=... npx playwright test`
// keeps working on its own.

export type Environment = {
  /** Short id: used in folder names (playwright/.auth/<id>/) and the API. */
  id: string;
  name: string;
  baseURL: string;
  /** Production: plans that create, edit or delete content never run here. */
  production: boolean;
};

const KNOWN: Environment[] = [
  {
    id: 'qa',
    name: 'QA',
    baseURL: 'https://qa.careerforce.link',
    production: false,
  },
  {
    id: 'stage',
    name: 'Stage',
    baseURL: 'https://stage.careerforce.link',
    production: false,
  },
  {
    id: 'prod',
    name: 'Production',
    baseURL: 'https://careerforce.mn.gov',
    production: true,
  },
];

const DEFAULT_BASE_URL = 'https://qa.careerforce.link';

// Hostnames that also mean production (the old domain redirects there).
const PROD_HOSTS = ['careerforce.mn.gov', 'careerforcemn.com'];

/** Every environment offered. Sandbox only when SANDBOX_URL is set. */
export function environments(): Environment[] {
  const list = [...KNOWN];
  if (process.env.SANDBOX_URL) {
    list.push({
      id: 'sandbox',
      name: 'Sandbox',
      baseURL: process.env.SANDBOX_URL.replace(/\/$/, ''),
      production: false,
    });
  }
  return list;
}

/** The environment with this id, or undefined. */
export function environmentById(id: string): Environment | undefined {
  return environments().find((e) => e.id === id);
}

/**
 * The environment a URL belongs to. A host that isn't in the list (a local
 * site, say) gets an environment of its own named after the host.
 */
export function envFor(baseURL: string): Environment {
  const host = new URL(baseURL).hostname;
  const known = environments().find(
    (e) => new URL(e.baseURL).hostname === host,
  );
  if (known) return known;
  const production = PROD_HOSTS.some((h) => host.endsWith(h));
  if (production) return { ...KNOWN[2], baseURL: baseURL.replace(/\/$/, '') };
  return {
    id: host.replace(/[^a-z0-9-]/gi, '-').toLowerCase(),
    name: host,
    baseURL: baseURL.replace(/\/$/, ''),
    production: false,
  };
}

/** The environment BASE_URL points at (QA when it isn't set). */
export function currentEnv(): Environment {
  return envFor(process.env.BASE_URL ?? DEFAULT_BASE_URL);
}

/**
 * HTTP Basic Auth for the gate in front of QA/Stage.
 * BASIC_AUTH_USER_<ID> / BASIC_AUTH_PASSWORD_<ID> (e.g. BASIC_AUTH_USER_STAGE)
 * win over the shared BASIC_AUTH_USER / BASIC_AUTH_PASSWORD. The browser only
 * sends them when the site asks, so setting them for production is harmless.
 */
export function credentialsFor(
  env: Environment,
): { username: string; password: string } | undefined {
  const suffix = env.id.toUpperCase().replace(/-/g, '_');
  const username =
    process.env[`BASIC_AUTH_USER_${suffix}`] ?? process.env.BASIC_AUTH_USER;
  if (!username) return undefined;
  const password =
    process.env[`BASIC_AUTH_PASSWORD_${suffix}`] ??
    process.env.BASIC_AUTH_PASSWORD ??
    '';
  return { username, password };
}

/**
 * The saved login for a role on an environment:
 * playwright/.auth/<env>/<role>.json. Cookies belong to one host, so each
 * environment needs its own login (`npm run login:manual -- <role> --env <id>`).
 */
export function authFile(
  role: string,
  env: Environment | string = currentEnv(),
): string {
  const id = typeof env === 'string' ? env : env.id;
  return `playwright/.auth/${id}/${role}.json`;
}

/** The command that saves that login. */
export function loginCommand(role: string, env: Environment | string): string {
  const id = typeof env === 'string' ? env : env.id;
  return `npm run login:manual -- ${role} --env ${id}`;
}

// ---- What differs between environments ------------------------------------

// GTM container ID differs by environment: one ID for prod, one shared across
// the lower environments (QA, stage, sandbox) per the source smoke-testing
// checklist. Confirmed on prod, QA, and stage (HP-3 run against stage,
// 2026-10-30); sandbox uses the same ID as QA.
const PROD_GTM_ID = 'GTM-WL36T6M';
const LOWER_ENV_GTM_ID = 'GTM-P8D2THV';

export function isProd(baseUrl: string): boolean {
  return envFor(baseUrl).production;
}

export function isStage(baseUrl: string): boolean {
  return envFor(baseUrl).id === 'stage';
}

export function expectedGtmId(baseUrl: string): string {
  return isProd(baseUrl) ? PROD_GTM_ID : LOWER_ENV_GTM_ID;
}
