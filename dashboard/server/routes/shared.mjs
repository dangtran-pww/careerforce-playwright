// What the route files share: path parameter patterns and request body
// checks. The environment a request names comes from ../environments.mjs.

import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { ApiError } from '../errors.mjs';

// Path parameter patterns, for Hono's `:name{pattern}`. A path that doesn't
// fit isn't matched at all, so it ends in the API's 404.
export const SLUG = '[\\w-]+';
export const CASE_ID = '[A-Z][A-Z0-9]*-\\d+';
export const ROLE = '[a-z-]+';

// Body fields several routes take.
export const strings = z.array(z.string());
export const envField = z.string().optional();
export const flag = z.boolean().optional();

/**
 * Middleware that checks the JSON body against a zod schema; the handler
 * reads the result with c.req.valid('json'). A body that doesn't fit is a
 * 400 with the { error } every API error has.
 */
export const jsonBody = (schema) =>
  zValidator('json', schema, (result) => {
    if (result.success) return;
    const issues = result.error.issues.map(
      (i) => `${i.path.join('.') || 'body'}: ${i.message}`,
    );
    throw new ApiError(400, `Bad request body. ${issues.join('; ')}`);
  });
