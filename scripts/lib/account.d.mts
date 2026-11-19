// Types for account.mjs, for the tests that import it (tests/helpers/roles.ts).
import type { APIRequestContext } from '@playwright/test';

export const PROFILE_TYPES: Record<string, string>;

export const PEOPLE_LIST_ROLES: string[];

export function accountInfo(
  ctx: APIRequestContext,
  userPage?: string,
): Promise<{ email?: string; profileTypeId?: string; profileType?: string }>;

export function accountRoles(
  email: string,
  role: string,
  env: { id: string; baseURL: string },
  ctx: APIRequestContext,
): Promise<{ roles?: string[]; detailsNote?: string }>;

export function accountGroups(
  email: string,
  role: string,
  env: { id: string; baseURL: string },
  ctx: APIRequestContext,
): Promise<{ groups?: string[]; locations?: string[]; detailsNote?: string }>;

export function ownRoles(
  ctx: APIRequestContext,
  userPage?: string,
): Promise<{ roles?: string[]; detailsNote?: string }>;
