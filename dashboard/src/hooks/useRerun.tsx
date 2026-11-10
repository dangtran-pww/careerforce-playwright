// What the run page needs to run a plan, or one of its cases, again on the
// environment picked in the header.
//
// <RerunProvider> wraps the run page and loads every plan on the current
// environment once (for "changes data" and whether another run is going);
// <RerunButton> and the per-test buttons read it with useRerun(). The page
// is remounted when the environment changes (App.tsx), so this follows the
// header's pick.

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import type { PlanSummary, PlansResponse } from '../api/types';
import { useApi } from './useApi';

interface RerunState {
  planBySlug: (slug: string | undefined) => PlanSummary | undefined;
  activeRun: string | null;
}

const RerunContext = createContext<RerunState | null>(null);

// Null outside a <RerunProvider>: then there is nothing to run again from.
export const useRerun = () => useContext(RerunContext);

export function RerunProvider({
  envId,
  runStatus,
  children,
}: {
  envId: string;
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
    // reload changes every render; only the status matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runStatus]);

  const plans = data?.plans ?? [];
  return (
    <RerunContext.Provider
      value={{
        planBySlug: (slug) => plans.find((p) => p.slug === slug),
        activeRun: data?.activeRun ?? null,
      }}
    >
      {children}
    </RerunContext.Provider>
  );
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
