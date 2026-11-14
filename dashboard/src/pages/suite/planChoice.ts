import type { Env, Plan, PlanCase } from '../../api/types';
import { noProdGrep } from '../../lib/prod';

// What to run of one plan, for the commands the plan panel's cases show.
export interface PlanChoice {
  projects: Set<string>;
  cases: Set<string>;
  headed: boolean;
  // What prompt cases that compare sites compare with: "default" (each
  // environment's own), "baseline" or environment ids ("stage,prod").
  compare: string;
}

/** A prompt case with a usable prompt file. */
export const isPromptCase = (c: PlanCase) =>
  c.kind === 'prompt' && !!c.prompt && !c.promptProblems?.length;

/** Whether the case can run: it has tests or is a usable prompt case. */
export const canRun = (c: PlanCase) => c.testCount > 0 || isPromptCase(c);

export const defaultPlanChoice = (plan: Plan): PlanChoice => ({
  projects: new Set(plan.projects.filter((p) => p.selected).map((p) => p.name)),
  cases: new Set(),
  headed: false,
  compare: 'default',
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
 * The environment ids prompt case `c` compares `env` with on a run: the
 * run's "Compare with" choice (`compare`), else the prompt's own. [] means
 * its baseline (its last run here), null no comparison. Mirrors
 * resolveCompare in scripts/lib/prompts.mjs.
 */
export function comparedSites(
  c: PlanCase,
  compare: string,
  env: Env,
): string[] | null {
  const own = c.prompt?.compare ?? 'none';
  if (own === 'none') return null;
  // Like compareList: "Stage, Prod" and "stage and prod" are the same.
  const words = (text: string) =>
    text
      .toLowerCase()
      .split(/\s*(?:,|\band\b)\s*/)
      .map((w) => w.trim())
      .filter(Boolean);
  const override = words(compare);
  let targets =
    override.length && override.join() !== 'default' ? override : words(own);
  if (targets.join() === 'default')
    targets = [env.compareWith ?? 'baseline'].flat();
  if (targets.join() === 'none') return null;
  return targets.filter((id) => id !== 'baseline' && id !== env.id);
}

/** comparedSites() by name: "Stage and Production". */
export function comparedWith(
  c: PlanCase,
  compare: string,
  env: Env,
  envById: (id: string) => Env | undefined,
): string {
  const ids = comparedSites(c, compare, env);
  if (!ids) return '—';
  if (!ids.length) return 'Its last run here';
  const names = ids.map((id) => envById(id)?.name ?? id);
  return names.length < 2
    ? names[0]
    : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/**
 * The most screenshots a run of prompt case `c` on `env` may take: the
 * prompt's Screenshots, half as much again for each comparison site after
 * the first. Mirrors screenshotLimit in dashboard/server/runs/prompt.mjs.
 */
export function screenshotLimit(c: PlanCase, compare: string, env: Env) {
  const sites = comparedSites(c, compare, env)?.length ?? 0;
  return Math.ceil((c.prompt?.screenshots ?? 0) * Math.max(1, (sites + 1) / 2));
}
