import { devices } from '@playwright/test';

// The devices the tests run on. playwright.config.ts makes one project per
// device, named after it (`desktop`, `mobile`), and each runs every suite
// under tests/. To add a device, add it here and a `device('<name>')`
// project to playwright.config.ts.
//
// Chromium only (`npm run install:browsers`): a phone is Pixel 7 in
// Chromium, which covers small-screen layout and touch, not Safari.
export const DEVICES = {
  desktop: devices['Desktop Chrome'],
  mobile: devices['Pixel 7'],
} as const;

export type DeviceName = keyof typeof DEVICES;

// Tags that keep a single test off one device: `@desktop-only` (not on
// mobile) and `@mobile-only` (not on desktop).
export const SKIP_TAG: Record<DeviceName, RegExp> = {
  desktop: /@mobile-only/,
  mobile: /@desktop-only/,
};

// Smoke areas (tests/smoke/<area>/, test-suites/smoke/smoke-<area>.md) tested on
// desktop only: admin and editor screens. The mobile project ignores their
// folders. Every other area runs on both devices.
export const DESKTOP_ONLY_SMOKE_AREAS = [
  'admin-reports',
  'admin-maintenance',
  'alerts',
  'auto-logout',
  'block-placement',
  'ckeditor',
  'content-lifecycle',
  'media',
];
