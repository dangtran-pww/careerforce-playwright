import { useState } from 'react';
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

// "Why did it fail?" under a failed or flaky test on a run's page. The
// button asks Claude (claude -p, read-only) to look at the error, the
// screenshot and page snapshot the run saved, and the test code, and explain
// the failure; it takes about a minute. The answer is saved with the run, so
// `saved` shows it again on coming back.
export function FailureExplain({
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
  const explanation = fresh ?? saved ?? null;

  async function explain() {
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

  const button = (
    <button
      type="button"
      className="ghost small"
      disabled={busy}
      onClick={explain}
    >
      {busy ? (
        <>
          <Spinner /> Looking into it…
        </>
      ) : explanation ? (
        'Explain again'
      ) : (
        'Why did it fail?'
      )}
    </button>
  );

  return (
    <div className="failure-explain">
      {!explanation && button}
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
            <Badge map={FAILURE_CAUSE} value={explanation.cause} />
            <span className="note small">
              {explanation.confidence} confidence
            </span>
          </p>
          <p>
            <strong>{explanation.headline}</strong>
          </p>
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
            {button}
          </div>
        </section>
      )}
    </div>
  );
}
