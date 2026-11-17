import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Page } from '@playwright/test';

import { expect } from '../../helpers/fixtures';
import { addDays, siteDate, weekday } from '../../helpers/dates';
import { currentEnv } from '../../helpers/environments.mjs';
import { EventsSearchPage } from '../../pages/events-search.page';
import type { CatalogItem, Session } from '../../pages/event-session-form.page';

// Shared by the no-prod Smoke Events specs (01-schedule to 04-cleanup):
// EA-1 creates the catalog item and EA-2 session S; ER, ES and EA-3 use
// them. The files run in name order with one worker, and pass the IDs on
// through a small JSON file per environment in the system temp folder (not
// the run's output folder, which Playwright empties). EA-1 overwrites it
// first thing, so a later file never picks up an earlier run's events.
// See test-suites/smoke/smoke-events.md → Login and test data.

export type EventsState = {
  name: string;
  catalogId?: string;
  /** Session S's occurrences, in date order. */
  occurrences?: { id: string; date: string }[];
};

function stateFile(): string {
  return join(tmpdir(), `careerforce-smoke-events-${currentEnv().id}.json`);
}

export function saveState(state: EventsState) {
  writeFileSync(stateFile(), JSON.stringify(state, null, 2));
}

/** The state 01-schedule saved in this run, or undefined. */
export function readState(): EventsState | undefined {
  const file = stateFile();
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as EventsState) : undefined;
}

/** The state, failing with a clear reason when EA-1/EA-2 didn't get there. */
export function requireState(need: 'catalog' | 'occurrences'): Required<EventsState> {
  const state = readState();
  expect(state?.catalogId, 'EA-1 did not create the catalog item in this run (run 01-schedule.spec.ts first)').toBeTruthy();
  if (need === 'occurrences') {
    expect(
      state?.occurrences?.length ?? 0,
      'EA-2 did not schedule session S in this run (run 01-schedule.spec.ts first)',
    ).toBeGreaterThanOrEqual(2);
  }
  return { occurrences: [], ...state } as Required<EventsState>;
}

export function catalogItem(name: string): CatalogItem {
  return {
    name,
    description: 'Synthetic event created by an automated smoke test.',
    service: 'Resume Writing Assistance',
    sponsor: 'Local Only',
    topic: 'Resumes',
    eventType: 'Workshop',
  };
}

/** Session S: weekdays, from the next weekday at least 2 days ahead, for 7 days. */
export function sessionS(): Session {
  let date = addDays(siteDate(), 2);
  while ([0, 6].includes(weekday(date))) date = addDays(date, 1);
  return {
    date,
    startTime: '10:00 AM',
    endTime: '11:00 AM',
    until: addDays(date, 7),
    serviceLocation: 'CareerForce in Aitkin',
    phone: '555-555-0100',
    seats: '10',
  };
}

/** Every weekday from the session's date to its Until date. */
export function sessionWeekdays(s: Session): string[] {
  const days: string[] = [];
  for (let d = s.date; d <= s.until; d = addDays(d, 1)) {
    if (![0, 6].includes(weekday(d))) days.push(d);
  }
  return days;
}

/** "2026-11-23" -> "11/23/2026". */
export function shortDate(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  return `${m}/${d}/${y}`;
}

/**
 * The event's CareerForce occurrences on the Events search, as a visitor, in
 * date order.
 */
export async function searchOccurrences(page: Page, name: string): Promise<{ id: string; date: string }[]> {
  const search = new EventsSearchPage(page);
  await search.search({ fq: name });
  const cards = search.cards.filter({ hasText: name });
  return (
    await cards.evaluateAll((els) =>
      els.map((el) => ({
        href: el.querySelector('a.cf-events-search-card-link')?.getAttribute('href') ?? '',
        datetime: el.querySelector('.cf-events-search-card-icon-date time')?.getAttribute('datetime') ?? '',
      })),
    )
  )
    .map((c) => ({ id: c.href.match(/^\/events\/event-occurrence\/(\d+)$/)?.[1] ?? c.href, date: c.datetime.slice(0, 10) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
