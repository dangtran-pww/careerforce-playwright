// Text formatting: dates, durations, plurals.

export const dateFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const relativeFormat = new Intl.RelativeTimeFormat(undefined, {
  numeric: 'auto',
});

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
];

// "5 minutes ago", "yesterday", "just now".
export function relative(iso: string): string {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size)
      return relativeFormat.format(Math.round(seconds / size), unit);
  }
  return 'just now';
}

// "42s", "3m 5s", "1h 12m".
export function duration(ms: number | null | undefined): string {
  if (ms == null) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// Milliseconds from `startedAt` to `finishedAt`, or to now.
export const elapsed = (startedAt: string, finishedAt?: string) =>
  (finishedAt ? new Date(finishedAt).getTime() : Date.now()) -
  new Date(startedAt).getTime();

// "1 test", "3 tests".
export const plural = (n: number, word: string) =>
  `${n} ${word}${n === 1 ? '' : 's'}`;

// "48 on smoke and 40 on smoke-mobile", or "21 on job-search".
export function testsPerProject(
  projects: { name: string; testCount: number }[],
): string {
  const parts = projects.map((p) => `${p.testCount} on ${p.name}`);
  return parts.length > 1
    ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`
    : (parts[0] ?? '');
}

// "88 tests (48 on smoke and 40 on smoke-mobile)", or "21 tests on job-search".
export function testsSummary(
  projects: { name: string; testCount: number }[],
): string {
  const total = plural(
    projects.reduce((n, p) => n + p.testCount, 0),
    'test',
  );
  return projects.length > 1
    ? `${total} (${testsPerProject(projects)})`
    : `${total} on ${projects[0]?.name ?? 'no project'}`;
}

export const hostOf = (url: string) => new URL(url).host;

// "Stage (stage.example.com)", for <option>s.
export const envLabel = (env: { name: string; baseURL: string }) =>
  `${env.name} (${hostOf(env.baseURL)})`;

// "claude-sonnet-4-6" → "Claude Sonnet 4.6", "claude-haiku-4-5-20251001" →
// "Claude Haiku 4.5", "opus" → "Claude Opus". Anything else is returned as is.
export function modelName(id: string): string {
  const parts = id
    .replace(/\[.*\]$/, '') // "[1m]" context suffix
    .replace(/-\d{8}$/, '') // snapshot date
    .split('-');
  if (parts[0] === 'claude') parts.shift();
  const words = parts.filter((p) => !/^\d+$/.test(p));
  const version = parts.filter((p) => /^\d+$/.test(p)).join('.');
  if (words.length !== 1 || !/^[a-z]+$/.test(words[0])) return id;
  const family = words[0][0].toUpperCase() + words[0].slice(1);
  return ['Claude', family, version].filter(Boolean).join(' ');
}
