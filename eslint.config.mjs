// Minimal linting for the Playwright starter — intentionally small.
// It catches the Playwright patterns that most often turn into flaky tests
// (sleeps, page.pause, networkidle, focused/skipped tests left behind),
// without imposing a heavy style preset on a small, learning team.
//
// Run: npm run lint        Fix what can be fixed: npm run lint:fix
// Typecheck separately: npm run typecheck
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import playwright from 'eslint-plugin-playwright';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['playwright.config.ts', 'tests/**/*.ts'],
    ...playwright.configs['flat/recommended'],
    rules: {
      'playwright/no-wait-for-timeout': 'error',
      'playwright/no-page-pause': 'error',
      'playwright/prefer-web-first-assertions': 'error',
      'playwright/no-focused-test': 'error',
      'playwright/no-skipped-test': 'warn',
    },
  },
  // The Node scripts and the dashboard server run in Node: process, console,
  // URL, timers and the rest are defined there.
  {
    files: ['**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  // The dashboard's React app: the rules of hooks.
  {
    files: ['dashboard/src/**/*.{ts,tsx}'],
    ...reactHooks.configs.flat['recommended-latest'],
  },
  {
    ignores: [
      'dashboard/dist/',
      'node_modules/',
      'test-results/',
      'playwright-report/',
      'playwright/.auth/',
    ],
  },
);
