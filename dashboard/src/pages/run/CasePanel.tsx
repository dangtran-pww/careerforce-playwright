import { useEffect, useRef } from 'react';
import { CaseDetails } from '../../components/CaseDetails';
import { CloseButton } from '../../components/CloseButton';
import { CASE_PANEL_ID, type ShownCase } from '../../hooks/useCasePanel';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { useRerun } from '../../hooks/useRerun';

// The top of the run page's right column, above the output: one case of the
// plan, with what the plan expects (its steps, expected result, …) and, on request, Claude's
// account of what the test code does and its review against the plan.
// Escape or the close button hides it. Give it a key per case so a new case
// starts fresh.
export function CasePanel({
  shown,
  onClose,
}: {
  shown: ShownCase;
  onClose: () => void;
}) {
  const plan = useRerun()?.planBySlug(shown.planSlug);
  const testCase = plan?.cases.find((c) => c.id === shown.caseId);
  const ref = useRef<HTMLElement>(null);

  // Move focus into the panel when it opens, so keyboard and screen reader
  // users land on what they asked for, and scroll the column back to its top
  // so the case shows from its start.
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    ref.current?.parentElement?.scrollTo({ top: 0 });
  }, []);

  useEscapeToClose(onClose);

  return (
    <aside
      id={CASE_PANEL_ID}
      ref={ref}
      tabIndex={-1}
      className="side-panel card"
      aria-labelledby="case-panel-heading"
    >
      <div className="card-head">
        <h2 id="case-panel-heading">
          {testCase ? `${shown.caseId} : ${testCase.title}` : shown.caseId}
        </h2>
        <CloseButton label="Close case details" onClick={onClose} />
      </div>
      {testCase ? (
        <CaseDetails planSlug={shown.planSlug} testCase={testCase} />
      ) : (
        <p className="note">
          {plan ? 'This case is no longer in the plan.' : 'Loading…'}
        </p>
      )}
    </aside>
  );
}
