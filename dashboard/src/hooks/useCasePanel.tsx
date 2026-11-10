// Which plan case shows in the run page's right-hand panel. <RunPage> owns
// the choice; the "Explain" button on each test row (TestResults) reads and
// changes it with useCasePanel(). Null outside the run page: then the
// buttons don't show.

import { createContext, useContext } from 'react';

export interface ShownCase {
  planSlug: string;
  caseId: string;
}

interface CasePanelState {
  shown: ShownCase | null;
  show: (c: ShownCase | null) => void;
}

export const CasePanelContext = createContext<CasePanelState | null>(null);

export const useCasePanel = () => useContext(CasePanelContext);

export const CASE_PANEL_ID = 'case-panel';

export const sameCase = (a: ShownCase | null, b: ShownCase) =>
  a?.planSlug === b.planSlug && a.caseId === b.caseId;
