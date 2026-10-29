// Allowlist of accepted /admin/reports/status errors/warnings, keyed by
// environment, so AR-1 fails on a *new* error/warning instead of silently
// passing it through. `title` is matched as a substring of the status
// report row's heading (e.g. the Search API index label), case-insensitive.
//
// Ownership of keeping this current is an open question — see
// test-plans/smoke-admin-reports-test-plan.md, open question 1. Whoever notices a new
// accepted error/warning should add it here with a short reason, not widen
// the match to something vaguer.
export type KnownIssue = {
  title: string;
  severity: 'error' | 'warning';
  reason: string;
};

const BASE_KNOWN_ISSUES: KnownIssue[] = [
  {
    title: 'Content',
    severity: 'error',
    reason:
      'Search API "Content" index — known Solr connectivity error, accepted across environments.',
  },
];

// Same allowlist across prod/stage/QA today — split per environment here if
// one environment ever needs its own accepted entries.
export function knownIssuesFor(): KnownIssue[] {
  return BASE_KNOWN_ISSUES;
}

export function isKnownIssue(
  title: string,
  severity: 'error' | 'warning',
): boolean {
  const normalizedTitle = title.trim().toLowerCase();
  return knownIssuesFor().some(
    (issue) =>
      issue.severity === severity &&
      normalizedTitle.includes(issue.title.toLowerCase()),
  );
}
