import type { Env, Plan, PlanCase } from '../../api/types';
import { noProdGrep } from '../../lib/prod';

// What the user has picked on the plan page. The run panel and the cases
// table both read and change it.
export interface PlanChoice {
  projects: Set<string>;
  cases: Set<string>;
  headed: boolean;
  // What prompt cases that compare sites compare with: "default" (each
  // environment's own), "baseline" or an environment id.
  compare: string;
}

/** A prompt case with a usable prompt file. */
export const isPromptCase = (c: PlanCase) =>
  c.kind === 'prompt' && !!c.prompt && !c.promptProblems?.length;

/** Whether the case can run: it has tests or is a usable prompt case. */
export const canRun = (c: PlanCase) => c.testCount > 0 || isPromptCase(c);

/** Whether any of the plan's prompt cases compares with another site. */
export const comparesSites = (plan: Plan) =>
  plan.cases.some((c) => isPromptCase(c) && c.prompt!.compare !== 'none');

export const defaultChoice = (plan: Plan): PlanChoice => ({
  projects: new Set(plan.projects.filter((p) => p.selected).map((p) => p.name)),
  cases: new Set(),
  headed: false,
  compare: 'default',
});

// The body of POST /api/plans/:slug/run for this choice. `cases` overrides
// the ticked cases (to run one case on its own).
export const runBody = (choice: PlanChoice, cases = [...choice.cases]) => ({
  projects: [...choice.projects],
  cases,
  headed: choice.headed,
  ...(choice.compare !== 'default' ? { compare: choice.compare } : {}),
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
  // Prompt cases run with scripts/run-prompt.mjs, one at a time.
  const prompts = new Set(plan.promptCases ?? []);
  if (cases.length && cases.every((id) => prompts.has(id)))
    return cases.map((id) => promptCommand(id, choice, env)).join('\n');
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

// The command that runs one prompt case outside the dashboard.
export const promptCommand = (id: string, choice: PlanChoice, env: Env) =>
  [
    `npm run prompt -- ${id} --env ${env.id}`,
    choice.compare !== 'default' ? `--compare ${choice.compare}` : null,
  ]
    .filter(Boolean)
    .join(' ');

/**
 * What prompt case `c` compares `env` with on a run, by name: the run's
 * "Compare with" choice (`compare`), else the prompt's own. Mirrors
 * resolveCompare in scripts/lib/prompts.mjs.
 */
export function comparedWith(
  c: PlanCase,
  compare: string,
  env: Env,
  envById: (id: string) => Env | undefined,
): string {
  const own = c.prompt?.compare ?? 'none';
  if (own === 'none') return '—';
  let target = compare !== 'default' ? compare : own;
  if (target === 'default') target = env.compareWith ?? 'baseline';
  if (target === 'baseline' || target === env.id) return 'Its last run here';
  return envById(target)?.name ?? target;
}
