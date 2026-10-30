// Date helpers for pages that render dates in the site's own timezone
// (Minnesota). Comparing against the test machine's local date would break
// when the runner is in another timezone or runs close to midnight.
const SITE_TIME_ZONE = 'America/Chicago';

// YYYY-MM-DD in the site timezone — the format the events (`fs`/`fe`) and
// appointments (`start`) query params use.
export function siteDate(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SITE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

// Adds whole days to a YYYY-MM-DD string. Works in UTC so DST changes
// don't shift the result by a day.
export function addDays(ymd: string, days: number): string {
  const date = new Date(`${ymd}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// 0 = Sunday … 6 = Saturday, for a YYYY-MM-DD string.
export function weekday(ymd: string): number {
  return new Date(`${ymd}T00:00:00Z`).getUTCDay();
}

// "Thursday, October 29, 2026" — how the appointments page writes a day.
export function longDate(ymd: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${ymd}T00:00:00Z`));
}
