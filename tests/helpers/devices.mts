import { devices } from '@playwright/test';

// The devices every suite can run on. playwright.config.ts makes one project
// per suite and device, named `<suite>-<device>` (smoke-desktop,
// smoke-mobile, ...). To add a device, add it here and to the `devices` list
// of the suites that should run on it.
//
// Chromium only (`npm run install:browsers`): a phone is Pixel 7 in
// Chromium, which covers small-screen layout and touch, not Safari.
export const DEVICES = {
  desktop: devices['Desktop Chrome'],
  mobile: devices['Pixel 7'],
} as const;

export type DeviceName = keyof typeof DEVICES;

// Tags that keep a single test off one device, inside a suite that runs on
// both: `@desktop-only` (not on mobile) and `@mobile-only` (not on desktop).
export const SKIP_TAG: Record<DeviceName, RegExp> = {
  desktop: /@mobile-only/,
  mobile: /@desktop-only/,
};

// Smoke areas (tests/smoke/<area>/, test-plans/smoke-<area>.md) tested on
// desktop only: admin and editor screens. smoke-mobile ignores their
// folders. Every other area runs on both devices.
export const DESKTOP_ONLY_SMOKE_AREAS = [
  'admin-reports',
  'admin-maintenance',
  'block-placement',
  'ckeditor',
  'content-lifecycle',
  'media',
];
