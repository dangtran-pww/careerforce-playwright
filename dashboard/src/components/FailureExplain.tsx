import { useId, useState } from 'react';
import { post } from '../api/client';
import type {
  FailureExplanation,
  FailureExplanationResponse,
  TestRef,
} from '../api/types';
import { FAILURE_CAUSE } from '../lib/status';
import { Badge } from './Badge';
import { ClaudeUsageNote } from './ClaudeUsageNote';
import { Spinner } from './Spinner';

// "Why did it fail?" for a failed or flaky test on a run's page. The button
// asks Claude (claude -p, read-only) to look at the error, the screenshot and
// page snapshot the run saved, and the test code, and explain the failure; it
// takes about a minute. The answer is saved with the run, so `saved` shows it
// again on coming back.
//
//   const explain = useFailureExplain({ runId, test, saved });
//   <FailureExplainButton explain={explain} />  // with the test's buttons
//   <FailureExplainPanel explain={explain} />   // below them
//
// The button hides once there is an answer ("Explain again" then sits under
// the answer). The panel shows progress, error and answer; the answer's
// heading row folds the rest of it open and closed, and asking again opens it.
export function useFailureExplain({
  runId,
  test,
  saved,
}: {
  runId: string;
  test: TestRef;
  saved?: FailureExplanation;
}) {
  const [fresh, setFresh] = useState<FailureExplanation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const explanation = fresh ?? saved ?? null;

  async function explain() {
    setOpen(true);
    setBusy(true);
    setError(null);
    try {
      const res = await post<FailureExplanationResponse>(
        `/api/runs/${runId}/explanations`,
        { ...test, refresh: Boolean(explanation) },
      );
      setFresh(res.explanation);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return {
    test,
    explanation,
    busy,
    error,
    open,
    toggleOpen: () => setOpen((o) => !o),
    explain,
  };
}

type ExplainState = ReturnType<typeof useFailureExplain>;

// Asks Claude, or asks again. Pass `always` to show it once there is an
// answer too (the panel does, under the answer).
export function FailureExplainButton({
  explain: x,
  always = false,
}: {
  explain: ExplainState;
  always?: boolean;
}) {
  if (x.explanation && !always) return null;
  return (
    <button
      type="button"
      className={x.explanation ? 'ghost small' : 'danger small'}
      disabled={x.busy}
      onClick={x.explain}
    >
      {x.busy ? (
        <>
          <Spinner /> Looking into it…
        </>
      ) : x.explanation ? (
        'Explain again'
      ) : (
        'Why did it fail?'
      )}
    </button>
  );
}

// Progress, error and Claude's answer; nothing before the first ask.
export function FailureExplainPanel({ explain: x }: { explain: ExplainState }) {
  const bodyId = useId();
  const { explanation, busy, error, test } = x;
  if (!busy && !error && !explanation) return null;
  return (
    <div className="failure-explain">
      {busy && (
        <p className="note small" role="status">
          Claude is reading the error, the screenshot and the test code. This
          takes about a minute.
        </p>
      )}
      {error && <p className="callout callout-bad">{error}</p>}
      {explanation && (
        <section
          className="failure-explanation"
          aria-label={`Why "${test.title}" failed`}
        >
          <p className="failure-explanation-head">
            <button
              type="button"
              className="case-explain-toggle"
              aria-expanded={x.open}
              aria-controls={bodyId}
              onClick={x.toggleOpen}
            >
              Claude's explanation
            </button>
            <Badge map={FAILURE_CAUSE} value={explanation.cause} />
            <span className="note small">
              {explanation.confidence} confidence
            </span>
          </p>
          <p>
            <strong>{explanation.headline}</strong>
          </p>
          <div id={bodyId} hidden={!x.open}>
            <h6>What happened</h6>
            <p>{explanation.whatHappened}</p>
            <h6>Why</h6>
            <p>{explanation.why}</p>
            {explanation.evidence.length > 0 && (
              <>
                <h6>Evidence</h6>
                <ul>
                  {explanation.evidence.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </>
            )}
            {explanation.nextSteps.length > 0 && (
              <>
                <h6>What to do</h6>
                <ul>
                  {explanation.nextSteps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </>
            )}
            <div className="failure-explanation-foot">
              <ClaudeUsageNote usage={explanation} verb="Explained" />
              <FailureExplainButton explain={x} always />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
