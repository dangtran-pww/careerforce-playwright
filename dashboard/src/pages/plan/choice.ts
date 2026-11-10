import type { Env, Plan } from '../../api/types';

// What the user has picked on the plan page. The run panel and the cases
// table both read and change it.
export interface PlanChoice {
  projects: Set<string>;
  cases: Set<string>;
  headed: boolean;
}

export const defaultChoice = (plan: Plan): PlanChoice => ({
  projects: new Set(plan.projects.filter((p) => p.selected).map((p) => p.name)),
  cases: new Set(),
  headed: false,
});

// The body of POST /api/plans/:slug/run for this choice. `cases` overrides
// the ticked cases (to run one case on its own).
export const runBody = (choice: PlanChoice, cases = [...choice.cases]) => ({
  projects: [...choice.projects],
  cases,
  headed: choice.headed,
});

// The Playwright command for this choice, to copy and run by hand.
export function planCommand(plan: Plan, choice: PlanChoice, env: Env): string {
  const cases = [...choice.cases];
  return [
    `BASE_URL=${env.baseURL}`,
    'npx playwright test',
    ...plan.runPaths,
    ...[...choice.projects].map((p) => `--project ${p}`),
    cases.length ? `-g '\\b(?:${cases.join('|')})(?!\\d)'` : null,
    choice.headed ? '--headed' : null,
  ]
    .filter(Boolean)
    .join(' ');
}
