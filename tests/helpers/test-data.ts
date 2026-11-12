// Names for content a test creates, so a run's content is easy to spot and
// clean up by hand (see test-suites/README.md: "Created content is titled
// `Playwright test <timestamp>`").

/** A run-unique word with no spaces, e.g. `pw20261112153012ab3`. */
export function uniqueToken(): string {
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const random = Math.random().toString(36).slice(2, 5);
  return `pw${stamp}${random}`;
}

/** `Playwright test <token>`, or `<prefix> <token>`. */
export function uniqueTitle(prefix = 'Playwright test'): string {
  return `${prefix} ${uniqueToken()}`;
}
