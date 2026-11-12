// The environment a request or a run is about. The environments themselves
// are defined in scripts/lib/site.mjs, shared with the scripts.

import { defaultEnv, environmentById } from '../../scripts/lib/site.mjs';
import { ApiError } from './errors.mjs';

/** The environment a request names (?env= or body.env), else the default. */
export function envParam(id) {
  if (!id) return defaultEnv;
  const env = environmentById(id);
  if (!env) throw new ApiError(400, `Unknown environment "${id}".`);
  return env;
}

/**
 * A run's "Compare with" choice for prompt checks that compare sites: an
 * environment id, "baseline" or "default" (undefined means default).
 */
export function compareParam(choice) {
  if (!choice || choice === 'default' || choice === 'baseline') return choice;
  return envParam(choice).id;
}

/**
 * What the page is told, and a run's run.json records, about an
 * environment: no credentials.
 */
export const publicEnv = (env) => ({
  id: env.id,
  name: env.name,
  baseURL: env.baseURL,
  production: env.production,
  compareWith: env.compareWith ?? 'baseline',
});
