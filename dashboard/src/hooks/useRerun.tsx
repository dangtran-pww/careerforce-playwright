// What the run page needs to run a plan, or one of its cases, again on the
// environment picked in the header.
//
// <RerunProvider> wraps the run page and loads every plan on the current
// environment once (for its no-prod cases and whether another run is going);
// <RerunButton> and the per-test buttons read it with useRerun(). The page
// is remounted when the environment changes (App.tsx), so this follows the
// header's pick.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import type { PlanSummary, PlansResponse } from '../api/types';
import { hostOf } from '../lib/format';
import { offProdReason } from '../lib/prod';
import { useApi } from './useApi';
import { useEnv } from './useEnv';

interface RerunState {
  planBySlug: (slug: string | undefined) => PlanSummary | undefined;
  activeRun: string | null;
  suite: string | null; // the shown run's suite, recorded on reruns
}

const RerunContext = createContext<RerunState | null>(null);

// Null outside a <RerunProvider>: then there is nothing to run again from.
export const useRerun = () => useContext(RerunContext);

export function RerunProvider({
  envId,
  runStatus,
  suite,
  children,
}: {
  envId: string;
  suite: string | null | undefined;
  runStatus: string; // reloads when the shown run starts or stops
  children: ReactNode;
}) {
  const { data, reload } = useApi<PlansResponse>(`/api/plans?env=${envId}`);

  // Ask again when the status changes, not on mount (useApi just asked).
  const lastStatus = useRef(runStatus);
  useEffect(() => {
    if (lastStatus.current === runStatus) return;
    lastStatus.current = runStatus;
    reload();
  }, [runStatus, reload]);

  // Memoized, so the run page's polls don't re-render every reader.
  const value = useMemo<RerunState>(() => {
    const plans = data?.plans ?? [];
    return {
      planBySlug: (slug) => plans.find((p) => p.slug === slug),
      activeRun: data?.activeRun ?? null,
      suite: suite ?? null,
    };
  }, [data, suite]);
  return (
    <RerunContext.Provider value={value}>{children}</RerunContext.Provider>
  );
}

// For a button that runs `cases` of a plan again (all of them when left
// out): the plan, and why the button is disabled, if it is. Null when there
// is nothing to run again from (outside a <RerunProvider>, or the plan
// can't run). Disabled while any run is going, and on production when
// everything it would run is no-prod.
//
//   const gate = useRunGate(planSlug, body.cases);
//   if (!gate) return null;
//   <button disabled={!!gate.blocked} title={gate.blocked ?? 'Run it'}>
export function useRunGate(planSlug: string | undefined, cases?: string[]) {
  const { currentEnv } = useEnv();
  const rerun = useRerun();
  const plan = rerun?.planBySlug(planSlug);
  if (!rerun || !plan?.runnable) return null;
  const blocked = rerun.activeRun
    ? 'Another run is in progress'
    : currentEnv.production
      ? offProdReason(plan, cases)
      : null;
  return {
    plan,
    suite: rerun.suite,
    blocked,
    // "QA (qa.example.org)", for the button's title.
    where: `${currentEnv.name} (${hostOf(currentEnv.baseURL)})`,
  };
}

// The plan case a test belongs to, from the ID at the start of its title
// ("SR-1: empty keyword…" → "SR-1"), when the plan has that case.
export function caseOfTest(
  plan: PlanSummary | undefined,
  title: string,
): string | undefined {
  const id = title.match(/\b([A-Z][A-Z0-9]*-\d+)(?!\d)/)?.[1];
  return id && plan?.cases.some((c) => c.id === id) ? id : undefined;
}
