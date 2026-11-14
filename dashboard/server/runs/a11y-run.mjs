// An accessibility journey started from the dashboard's Accessibility Scan
// page: Claude follows a journey described in plain words, as a visitor or
// a saved role, on one device. The browser scans every page and dialog it
// reaches with axe (tests/helpers/a11y-journey.ts), and Claude checks
// keyboard use and focus (runs/prompt.mjs). It is one prompt check built
// here instead of read from a prompt file, run like a plan's prompt case:
// one run at a time, a folder in reports/dashboard-runs/, shown on the run
// page (run kind "a11y-journey", its check in `prompts`).

import { hostOf } from '../../../scripts/lib/site.mjs';
import { publicEnv } from '../environments.mjs';
import { ApiError } from '../errors.mjs';
import { beginRun, endRun, launch, newRunId } from './lifecycle.mjs';
import { combinedStatus, requireLogins } from './plan-run.mjs';
import { promptsStatus, runCheckInRun } from './prompt-step.mjs';

export const A11Y_DEVICES = {
  desktop: { name: 'desktop', width: 1366, height: 768 },
  mobile: { name: 'phone', width: 390, height: 844 },
};

/**
 * Start Claude on `journey` (plain words) on `env` as `role` (none: a
 * visitor) on `device`. The role's login is checked first, as for a plan
 * run. Resolves with its run.json once it has started.
 */
export async function startA11yJourney({
  env,
  role,
  device,
  journey,
  checkLogin,
}) {
  const viewport = A11Y_DEVICES[device];
  if (!viewport) throw new ApiError(400, `Unknown device "${device}".`);
  if (role) await requireLogins(new Set([role]), env, checkLogin);

  const check = {
    slug: 'a11y-journey',
    name: 'Accessibility journey',
    role: role ?? null,
    compare: 'none',
    viewports: [viewport],
    screenshots: 12,
    parallel: false,
    a11y: true,
    prompt: journey,
    problems: [],
  };
  const firstLine = journey.split('\n')[0].trim();
  const short =
    firstLine.length > 70 ? `${firstLine.slice(0, 67)}…` : firstLine;
  const entry = {
    id: 'journey',
    title: `Journey: ${short}`,
    slug: check.slug,
    role: check.role,
    prompt: journey,
    viewports: check.viewports,
    a11y: true,
    status: 'pending',
  };
  const now = new Date();
  const meta = {
    id: newRunId(now, env.id, 'a11y-journey'),
    kind: 'a11y-journey',
    suite: null,
    planName: `Accessibility journey - ${short}`,
    projects: [],
    cases: [],
    headed: false,
    env: publicEnv(env),
    site: hostOf(env),
    command: null,
    journey: { role: check.role, device, text: journey },
    a11yScan: true,
    a11y: null,
    status: 'running',
    startedAt: now.toISOString(),
    finishedAt: null,
    prompts: [entry],
  };
  const dir = await beginRun(meta);

  launch(meta, async () => {
    await runCheckInRun(entry, check, {
      env,
      dir: `${dir}/prompts/journey`,
      meta,
    });
    meta.a11y = entry.a11y ?? null;
    meta.status = combinedStatus(null, promptsStatus([entry]));
    await endRun(meta);
  });
  return meta;
}
