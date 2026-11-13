import { useId, useState } from 'react';
import { post } from '../api/client';
import type { RunSummaryResponse } from '../api/types';
import { useApi } from '../hooks/useApi';
import { ClaudeUsageNote } from './ClaudeUsageNote';
import { RunIssueItem } from './RunIssueItem';
import { Spinner } from './Spinner';

// A quick summary of a finished run's failures, above its results: a plan
// run's tests, or all the plan steps' tests of a suite run together.
// The button asks Claude (claude -p, no tools) to read the errors of every
// failed and flaky test and group them into the issues that repeat across
// tests; it takes seconds. The answer is saved with the run, so it shows
// again on coming back. The heading folds the card's body open and closed;
// summarizing again opens it.
export function RunSummary({ runId }: { runId: string }) {
  const path = `/api/runs/${runId}/summary`;
  const saved = useApi<RunSummaryResponse>(path).data?.summary;
  const [fresh, setFresh] = useState<RunSummaryResponse['summary']>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const bodyId = useId();
  const summary = fresh ?? saved ?? null;

  async function summarize() {
    setOpen(true);
    setBusy(true);
    setError(null);
    try {
      const res = await post<RunSummaryResponse>(path, {
        refresh: Boolean(summary),
      });
      setFresh(res.summary);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card run-summary" aria-labelledby="run-summary-heading">
      <div className="card-head">
        <h2 id="run-summary-heading">
          <button
            type="button"
            className="case-explain-toggle"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOpen((o) => !o)}
          >
            Summary
          </button>
        </h2>
        <button
          type="button"
          className={summary ? 'ghost small' : 'small'}
          disabled={busy}
          onClick={summarize}
        >
          {busy ? (
            <>
              <Spinner /> Summarizing…
            </>
          ) : summary ? (
            'Summarize again'
          ) : (
            'Summarize the failures'
          )}
        </button>
      </div>
      <div id={bodyId} hidden={!open}>
        {busy && (
          <p className="note small" role="status">
            Claude is reading the errors of the failed tests. This takes about
            15 seconds.
          </p>
        )}
        {!summary && !busy && (
          <p className="note small">
            Ask Claude to group the failed and flaky tests by the problem behind
            them.
          </p>
        )}
        {error && <p className="callout callout-bad">{error}</p>}
        {summary && (
          <>
            <p>
              <strong>{summary.headline}</strong>
            </p>
            {summary.overview && <p>{summary.overview}</p>}
            {summary.issues.length > 0 && (
              <>
                <h6>Issues</h6>
                <ul className="run-issues">
                  {summary.issues.map((issue, i) => (
                    <RunIssueItem key={i} issue={issue} />
                  ))}
                </ul>
              </>
            )}
            {summary.nextSteps.length > 0 && (
              <>
                <h6>What to do first</h6>
                <ul>
                  {summary.nextSteps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </>
            )}
            {summary.model && (
              <ClaudeUsageNote usage={summary} verb="Summarized" />
            )}
          </>
        )}
      </div>
    </section>
  );
}
