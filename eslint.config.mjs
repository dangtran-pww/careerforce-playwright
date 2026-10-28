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
  {
    ignores: [
      'node_modules/',
      'test-results/',
      'playwright-report/',
      'playwright/.auth/',
    ],
  },
);
