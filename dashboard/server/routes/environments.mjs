// /api/environments

import { Hono } from 'hono';
import {
  defaultEnv,
  environments,
  isActive,
} from '../../../scripts/lib/site.mjs';
import { publicEnv } from '../environments.mjs';

export const environmentRoutes = new Hono();

// GET /api/environments — the environments to pick from, and the default.
// The default is BASE_URL's environment, even when it isn't in the list
// (some other host). The local DDEV site is listed only while it's running;
// checked on each page load, so starting DDEV and reloading brings it back.
environmentRoutes.get('/', async (c) => {
  const all = environments();
  if (!all.some((e) => e.id === defaultEnv.id)) all.push(defaultEnv);
  const up = await Promise.all(all.map((e) => isActive(e)));
  const list = all.filter((_, i) => up[i]);
  const fallback = list.some((e) => e.id === defaultEnv.id)
    ? defaultEnv.id
    : list[0]?.id;
  return c.json({ default: fallback, environments: list.map(publicEnv) });
});
