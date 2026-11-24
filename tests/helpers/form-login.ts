import type { Page } from '@playwright/test';

import { expect } from './fixtures';
import { currentEnv, type Environment } from './environments.mjs';

// Logging in with a dedicated username/password account through the Drupal
// login form for partners on /user/login, for the few cases that can't use a
// saved SSO session (see "Logging in with the partner login form" in
// README.md). The account's values live only in .env, one pair per
// environment: <PREFIX>_USER_<ENV> and <PREFIX>_PASSWORD_<ENV>.

export type FormAccount = { username: string; password: string };

/** Drupal's message for a missing account and for a wrong password alike. */
export const UNRECOGNIZED_LOGIN = 'Unrecognized username or password';

/** The .env names for an account on an environment, e.g. AUTO_LOGOUT_USER_QA. */
export function formAccountVars(prefix: string, env: Environment = currentEnv()) {
  const suffix = env.id.toUpperCase().replace(/-/g, '_');
  return { user: `${prefix}_USER_${suffix}`, password: `${prefix}_PASSWORD_${suffix}` };
}

/** The account for the current environment, or undefined when it isn't set. */
export function formAccount(
  prefix: string,
  env: Environment = currentEnv(),
): FormAccount | undefined {
  const vars = formAccountVars(prefix, env);
  const username = process.env[vars.user];
  const password = process.env[vars.password];
  if (!username || !password) return undefined;
  return { username, password };
}

/**
 * Logs in through the partner form. Returns 'unrecognized' when Drupal
 * answers "Unrecognized username or password" (the account doesn't exist,
 * or the password is wrong), and 'ok' once the browser has left
 * /user/login. Any other outcome fails the expectation.
 */
export async function loginWithPartnerForm(
  page: Page,
  account: FormAccount,
): Promise<'ok' | 'unrecognized'> {
  await page.goto('/user/login');
  await page
    .locator('summary')
    .filter({ hasText: 'CareerForce partner organization or a training program provider' })
    .click();
  const form = page.locator('#user-login-form');
  await form.getByLabel('Email address').fill(account.username);
  await form.getByLabel('Password', { exact: true }).fill(account.password);

  const recaptcha = form
    .frameLocator('iframe[title="reCAPTCHA"]')
    .getByRole('checkbox', { name: "I'm not a robot" });
  await recaptcha.click();
  await expect(recaptcha, 'reCAPTCHA passes (a test key on this environment)').toBeChecked();

  await form.getByRole('button', { name: 'Submit' }).click();
  await page.waitForLoadState();

  const unrecognized = page.getByText(UNRECOGNIZED_LOGIN);
  await expect
    .poll(
      async () =>
        (await unrecognized.count()) > 0
          ? 'unrecognized'
          : new URL(page.url()).pathname !== '/user/login'
            ? 'ok'
            : 'waiting',
      { message: 'the login form answers', timeout: 30_000 },
    )
    .not.toBe('waiting');
  return (await unrecognized.count()) > 0 ? 'unrecognized' : 'ok';
}
