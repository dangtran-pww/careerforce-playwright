import type { Env, Plan } from '../../api/types';
import { noProdGrep } from '../../lib/prod';

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

// The chosen projects that run at least one of the chosen cases (all of the
// chosen projects when no case is picked). A @desktop-only case such as HP-3
// has no tests in smoke-mobile, and Playwright fails a project/grep pair
// that matches nothing. Mirrors planArgs in dashboard/server/runs/playwright.mjs.
export function projectsForCases(plan: Plan, choice: PlanChoice): string[] {
  const projects = [...choice.projects];
  if (!choice.cases.size) return projects;
  const forCases = projects.filter((name) =>
    plan.cases.some(
      (c) => choice.cases.has(c.id) && c.projects.some((p) => p.name === name),
    ),
  );
  // None left: keep the choice, so the command still shows what was picked
  // (the server refuses that run and says why).
  return forCases.length ? forCases : projects;
}

// The Playwright command for this choice, to copy and run by hand. On
// production it leaves out the no-prod cases, as the dashboard's run does.
export function planCommand(plan: Plan, choice: PlanChoice, env: Env): string {
  const noProd = env.production ? plan.noProdCases : [];
  const cases = [...choice.cases].filter((id) => !noProd.includes(id));
  return [
    `BASE_URL=${env.baseURL}`,
    'npx playwright test',
    ...plan.runPaths,
    ...projectsForCases(plan, choice).map((p) => `--project ${p}`),
    cases.length ? `-g '\\b(?:${cases.join('|')})(?!\\d)'` : null,
    noProd.length ? `--grep-invert ${noProdGrep(noProd)}` : null,
    choice.headed ? '--headed' : null,
  ]
    .filter(Boolean)
    .join(' ');
}
