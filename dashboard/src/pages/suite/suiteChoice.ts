import type { Suite } from '../../api/types';

// What the user has picked on the suite page.
export interface SuiteChoice {
  plans: Set<string>; // plan slugs
  headed: boolean;
  a11y: boolean; // scan every page the run reaches for accessibility
}

// Every plan that can run.
export function defaultSuiteChoice(suite: Suite): SuiteChoice {
  return {
    plans: new Set(suite.plans.filter((p) => p.runnable).map((p) => p.slug)),
    headed: false,
    a11y: false,
  };
}

// Every role the chosen plans log in as, without repeats.
export function neededRoles(suite: Suite, choice: SuiteChoice): string[] {
  const roles = new Set<string>();
  for (const p of suite.plans)
    if (choice.plans.has(p.slug))
      for (const role of p.roles ?? []) roles.add(role);
  return [...roles];
}
