// Opens a plan, or some of its cases, in Playwright's UI mode
// (`npx playwright test … --ui`): an interactive window where you pick
// tests, run them, watch each step and time-travel through the trace.
//
// UI mode isn't a run: nothing is saved under reports/dashboard-runs and it
// doesn't hold the run lock. One window at a time: opening another closes
// the one before. The dashboard closes it when it stops.

import { spawn } from 'node:child_process';
import { killGroup } from './lib/processes.mjs';
import {
  checkPlanRunnable,
  planArgs,
  shownCommand,
} from './runs/playwright.mjs';

let child = null;

/** Close the UI mode window, if one is open. */
export function closeUiMode() {
  const open = child;
  child = null;
  if (!open || open.exitCode !== null) return;
  // Own process group: ends UI mode and the browsers it started.
  killGroup(open);
}

/**
 * Open UI mode on `env` with the plan's paths, the chosen projects and a
 * filter for the chosen cases. Resolves with { command } once it started.
 */
export function openUiMode(plan, { env, projects, cases = [] } = {}) {
  checkPlanRunnable(plan, env);
  const { args } = planArgs(plan, { projects, cases });
  const fullArgs = ['playwright', 'test', ...args, '--ui'];
  closeUiMode();

  return new Promise((resolve, reject) => {
    const proc = spawn('npx', fullArgs, {
      detached: true,
      env: { ...process.env, BASE_URL: env.baseURL },
      // Its messages show in the dashboard's terminal.
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    child = proc;
    proc.on('error', (err) => {
      if (child === proc) child = null;
      reject(new Error(`Couldn't start Playwright UI mode: ${err.message}`));
    });
    proc.on('exit', () => {
      if (child === proc) child = null;
    });
    proc.on('spawn', () => resolve({ command: shownCommand(env, fullArgs) }));
  });
}
