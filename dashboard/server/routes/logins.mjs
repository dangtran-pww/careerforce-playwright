// /api/roles and /api/sessions: the header's Logins menu. See sessions.mjs.

import { Hono } from 'hono';
import { checkSessionOnce, knownRoles } from '../sessions.mjs';
import { envParam } from '../environments.mjs';
import { ROLE } from './shared.mjs';

export const roleRoutes = new Hono();

// GET /api/roles?env=<id> — every role to list in the Logins menu.
roleRoutes.get('/', async (c) =>
  c.json({ roles: await knownRoles(envParam(c.req.query('env'))) }),
);

export const sessionRoutes = new Hono();

// GET /api/sessions/:role?env=<id> — is the saved session for that role
// (playwright/.auth/<env>/<role>.json) still logged in?
sessionRoutes.get(`/:role{${ROLE}}`, async (c) =>
  c.json(
    await checkSessionOnce(c.req.param('role'), envParam(c.req.query('env'))),
  ),
);
