// Label and colour (tone) for every status the API returns. <Badge> turns a
// map and a key into a coloured tag. Tones match the .badge-<tone> classes
// in styles.css.

export type Tone = 'good' | 'bad' | 'warn' | 'neutral';
export type StatusMap = Record<string, { label: string; tone: Tone }>;

// A saved login session (GET /api/sessions/:role), plus "checking".
export const SESSION_STATUS: StatusMap = {
  valid: { label: 'Valid', tone: 'good' },
  expired: { label: 'Expired', tone: 'bad' },
  missing: { label: 'Not saved', tone: 'bad' },
  'no-access': { label: 'Not an admin', tone: 'bad' },
  error: { label: "Couldn't check", tone: 'warn' },
  checking: { label: 'Checking…', tone: 'neutral' },
};

// test-plans/README.md → "Status on every plan".
export const PLAN_STATUS: StatusMap = {
  implemented: { label: 'Implemented', tone: 'good' },
  'partially implemented': { label: 'Partially implemented', tone: 'warn' },
  'needs update': { label: 'Needs update', tone: 'warn' },
  'ready to generate': { label: 'Ready to generate', tone: 'neutral' },
};

// A whole run (plan or suite).
export const RUN_STATUS: StatusMap = {
  running: { label: 'Running…', tone: 'neutral' },
  passed: { label: 'Passed', tone: 'good' },
  failed: { label: 'Failed', tone: 'bad' },
  attention: { label: 'Needs a look', tone: 'warn' },
  stopped: { label: 'Stopped', tone: 'warn' },
  interrupted: { label: 'Interrupted', tone: 'warn' },
  error: { label: "Didn't run", tone: 'bad' },
};

// One step of a suite run.
export const STEP_STATUS: StatusMap = {
  pending: { label: 'Waiting', tone: 'neutral' },
  running: { label: 'Running…', tone: 'neutral' },
  passed: { label: 'Passed', tone: 'good' },
  failed: { label: 'Failed', tone: 'bad' },
  unsure: { label: 'Unsure', tone: 'warn' },
  skipped: { label: 'Skipped', tone: 'neutral' },
  stopped: { label: 'Stopped', tone: 'warn' },
  interrupted: { label: 'Interrupted', tone: 'warn' },
  error: { label: 'Error', tone: 'bad' },
};

// The kind of a suite step (plain labels, no badge).
export const STEP_KIND: Record<string, string> = {
  plan: 'Test plan',
  prompt: 'Claude check',
};

// Playwright's outcome for one test.
export const TEST_OUTCOME: StatusMap = {
  expected: { label: 'Passed', tone: 'good' },
  unexpected: { label: 'Failed', tone: 'bad' },
  flaky: { label: 'Flaky', tone: 'warn' },
  skipped: { label: 'Skipped', tone: 'neutral' },
};

// Claude's guess at why a test failed (server/failure.mjs).
export const FAILURE_CAUSE: StatusMap = {
  site: { label: 'Looks like the site', tone: 'bad' },
  test: { label: 'Looks like the test', tone: 'warn' },
  environment: { label: 'Looks like the environment', tone: 'warn' },
  flaky: { label: 'Looks like timing', tone: 'warn' },
  unclear: { label: 'Cause unclear', tone: 'neutral' },
};
