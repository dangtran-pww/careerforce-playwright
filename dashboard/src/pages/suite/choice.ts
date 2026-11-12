import type { Env, Suite } from '../../api/types';

// What the user has picked on the suite page.
export interface SuiteChoice {
  plans: Set<string>; // plan slugs
  headed: boolean;
}

// Every plan that can run.
export function defaultChoice(suite: Suite): SuiteChoice {
  return {
    plans: new Set(suite.plans.filter((p) => p.runnable).map((p) => p.slug)),
    headed: false,
  };
}

// Every { role, env } the chosen plans log in as, without repeats.
export function neededLogins(suite: Suite, choice: SuiteChoice, env: Env) {
  const roles = new Set<string>();
  for (const p of suite.plans)
    if (choice.plans.has(p.slug))
      for (const role of p.roles ?? []) roles.add(role);
  return [...roles].map((role) => ({ role, env }));
}
