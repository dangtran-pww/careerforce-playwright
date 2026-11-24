import { useId, useRef, useState } from 'react';
import { useCaseClaude } from '../hooks/useCaseClaude';
import { CaseReviewResult } from './CaseReviewResult';
import { ClaudeUsageNote } from './ClaudeUsageNote';
import { Spinner } from './Spinner';
import { ToggleButton } from './ToggleButton';

// "What the code does": Claude's plain-words account of a case's test code,
// step by step, each step tagged with the plan step it carries out ("Step
// 2", "Setup", "Not in plan"). Shows the saved one if there is one; the button asks Claude
// (claude -p, read-only) to read the code and explain it, which takes about
// a minute. The heading folds the section open and closed, and so does a
// "Show less" button at the bottom, so a long account folds from either end.
// "Review code against plan" asks Claude to compare the code with the plan's row
// for the case; it doesn't need an explanation first. Reviews are not written to
// disk: the server keeps the latest one in memory, so it is shown again on
// coming back to the page, and each click asks Claude again.
export function CaseExplain({
  planSlug,
  caseId,
}: {
  planSlug: string;
  caseId: string;
}) {
  const {
    explanation,
    explanationLoading,
    explaining: busy,
    explainError: error,
    explain,
    review,
    reviewing: reviewBusy,
    reviewError,
    runReview,
  } = useCaseClaude(planSlug, caseId);
  const [open, setOpen] = useState(true);
  const bodyId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Folding from the bottom hides the button just pressed and can leave the
  // page scrolled past the section. Move focus to the heading toggle, which
  // also scrolls it back into view.
  function foldFromBottom() {
    setOpen(false);
    requestAnimationFrame(() => toggleRef.current?.focus());
  }

  return (
    <section className="case-explain" aria-label={`What ${caseId}'s code does`}>
      <div className="case-explain-head">
        <h4>
          <button
            type="button"
            ref={toggleRef}
            className="case-explain-toggle"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOpen((o) => !o)}
          >
            What the code does
          </button>
        </h4>
        {explanationLoading ? null : (
          <button
            type="button"
            className="ghost small"
            disabled={busy}
            onClick={() => {
              setOpen(true);
              explain();
            }}
          >
            {busy ? (
              <>
                <Spinner /> Reading the code…
              </>
            ) : explanation ? (
              'Explain again'
            ) : (
              'Explain the steps'
            )}
          </button>
        )}
      </div>
      <div id={bodyId} hidden={!open}>
        {busy && (
          <p className="note small" role="status">
            Claude is reading the test and the helpers it uses. This takes about
            a minute.
          </p>
        )}
        {error && <p className="callout callout-bad">{error}</p>}
        {!explanation && !busy && !error && !review && !reviewBusy && (
          <p className="note small">
            Ask Claude to read this case's test code and explain each step it
            performs and what it checks, or to review it against the plan.
          </p>
        )}
        {explanation && (
          <>
            {explanation.stale && (
              <p className="callout callout-warn">
                The test code changed after this was written. Explain again for
                an up-to-date account.
              </p>
            )}
            {explanation.summary && <p>{explanation.summary}</p>}
            <ol className="case-explain-steps">
              {explanation.steps.map((s, i) => (
                <li key={i}>
                  {s.planStep && (
                    <span className="case-explain-plan-step">{s.planStep}</span>
                  )}
                  {s.action}
                  {s.checks.length > 0 && (
                    <ul>
                      {s.checks.map((c, j) => (
                        <li key={j}>{c}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
            <ClaudeUsageNote usage={explanation} verb="Explained" />
          </>
        )}
        {reviewBusy && (
          <p className="note small" role="status">
            Claude is comparing the test code with the plan. This takes about a
            minute.
          </p>
        )}
        {reviewError && <p className="callout callout-bad">{reviewError}</p>}
        {review && <CaseReviewResult review={review} />}
        <div className="case-review-actions">
          <button
            type="button"
            className="ghost small"
            disabled={reviewBusy}
            onClick={() => {
              setOpen(true);
              runReview();
            }}
          >
            {reviewBusy ? (
              <>
                <Spinner /> Reviewing…
              </>
            ) : review ? (
              'Review again'
            ) : (
              'Review code against plan'
            )}
          </button>
        </div>
        {(explanation || review) && (
          <ToggleButton open controls={bodyId} onToggle={foldFromBottom}>
            Show less
          </ToggleButton>
        )}
      </div>
    </section>
  );
}
