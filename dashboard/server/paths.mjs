// Where the dashboard finds things. ROOT is the repository, found from this
// file, not from where the server was started; index.mjs makes it the working
// directory, so the paths below (relative to ROOT, the way they appear on the
// page, in run.json and in prompts), the scripts' paths in
// scripts/lib/site.mjs, and the commands the server runs (npx playwright,
// claude) all work wherever it's started from.
//
// A module that resolves a path when it loads, before index.mjs changes
// directory, uses fromRoot().

import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** An absolute path from one relative to ROOT. */
export const fromRoot = (...parts) => join(ROOT, ...parts);

export const PLANS_DIR = 'test-plans';
export const SUITES_DIR = 'test-suites';
export const PROMPTS_DIR = join(SUITES_DIR, 'prompts');
// One folder per dashboard run (gitignored); see runs/lifecycle.mjs.
export const RUNS_DIR = join('reports', 'dashboard-runs');
// Saved explanations of plan cases (gitignored); see claude/explain.mjs.
export const EXPLANATIONS_DIR = join('reports', 'explanations');
export const APP_DIST_DIR = join('dashboard', 'dist');
export const VITE_CONFIG = join('dashboard', 'vite.config.mts');
